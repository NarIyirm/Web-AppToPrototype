package expo.modules.mobiletransfer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import java.io.File
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.security.cert.X509Certificate
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

class MobileTransferModule : Module() {
  private fun endpoint(value: String): URL {
    val url = URL(value)
    val parts = url.host.split(".").map { it.toIntOrNull() ?: -1 }
    require(parts.size == 4 && parts.all { it in 0..255 } && (parts[0] == 10 || parts[0] == 192 && parts[1] == 168 || parts[0] == 172 && parts[1] in 16..31)) { "M_ENDPOINT" }
    require(url.protocol == "https" && url.port in 1024..65535 && url.userInfo == null && url.query == null && url.ref == null && url.path.isNullOrEmpty()) { "M_ENDPOINT" }
    return url
  }
  private fun request(base: String, pin: String, path: String, method: String, token: String, bytes: ByteArray): String {
    endpoint(base)
    require(pin.matches(Regex("[a-f0-9]{64}")) && path.matches(Regex("/mobile/(pair|session|disconnect|uploads(/[a-f0-9]{64}(/([0-9]+|commit))?)?)"))) { "M_REQUEST" }
    require(method in listOf("GET", "POST", "PUT") && (token.isEmpty() || token.matches(Regex("[a-f0-9]{64}"))) && bytes.size <= 262144)
    val trust = object : X509TrustManager {
      override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
      override fun checkClientTrusted(chain: Array<X509Certificate>, type: String) { throw java.security.cert.CertificateException("M_CLIENT_CERT") }
      override fun checkServerTrusted(chain: Array<X509Certificate>, type: String) {
        if (chain.size != 1) throw java.security.cert.CertificateException("M_CERT_CHAIN")
        chain[0].checkValidity()
        val digest = MessageDigest.getInstance("SHA-256").digest(chain[0].encoded).joinToString("") { "%02x".format(it.toInt() and 255) }
        if (!MessageDigest.isEqual(digest.toByteArray(), pin.toByteArray())) throw java.security.cert.CertificateException("M_CERT_PIN")
      }
    }
    val tls = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trust), null) }
    val connection = URL(base + path).openConnection() as HttpsURLConnection
    try {
      connection.sslSocketFactory = tls.socketFactory
      connection.hostnameVerifier = HttpsURLConnection.getDefaultHostnameVerifier()
      connection.instanceFollowRedirects = false; connection.connectTimeout = 15000; connection.readTimeout = if (path == "/mobile/pair") 90000 else 15000
      connection.requestMethod = method
      if (token.isNotEmpty()) connection.setRequestProperty("Authorization", "Bearer $token")
      if (method != "GET") {
        connection.doOutput = true; connection.setFixedLengthStreamingMode(bytes.size)
        connection.setRequestProperty("Content-Type", if (method == "PUT") "application/octet-stream" else "application/json")
        connection.outputStream.use { it.write(bytes) }
      }
      val code = connection.responseCode
      val stream = if (code in 200..299) connection.inputStream else connection.errorStream
      val output = stream?.use { input ->
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(2048)
        while (true) { val n = input.read(buffer); if (n < 0) break; check(output.size() + n <= 16384) { "M_RESPONSE_LIMIT" }; output.write(buffer, 0, n) }
        output.toByteArray()
      } ?: byteArrayOf()
      check(output.size <= 16384) { "M_RESPONSE_LIMIT" }
      check(code in 200..299) { "M_HTTP_$code: ${output.toString(Charsets.UTF_8).take(200)}" }
      return output.toString(Charsets.UTF_8)
    } finally { connection.disconnect() }
  }
  override fun definition() = ModuleDefinition {
    Name("MobileTransfer")
    AsyncFunction("request") { base: String, pin: String, path: String, method: String, token: String, body: String ->
      require(body.length <= 4096); request(base, pin, path, method, token, body.toByteArray(Charsets.UTF_8))
    }
    AsyncFunction("chunk") { base: String, pin: String, path: String, token: String, uri: String, offset: Double, length: Int ->
      val context = requireNotNull(appContext.reactContext)
      val file = File(requireNotNull(android.net.Uri.parse(uri).path)).canonicalFile
      val root = File(context.cacheDir, "mobile-exports").canonicalFile
      require(uri.startsWith("file://") && file.parentFile == root && file.name.matches(Regex("b-[a-z0-9-]+\\.w2pm\\.zip")) && file.length() in 1..(64L*1024*1024)) { "M_UPLOAD_FILE" }
      require(offset >= 0 && offset % 1.0 == 0.0 && length in 1..262144 && offset + length <= file.length()) { "M_UPLOAD_RANGE" }
      val data = ByteArray(length)
      RandomAccessFile(file, "r").use { it.seek(offset.toLong()); it.readFully(data) }
      request(base, pin, path, "PUT", token, data)
    }
  }
}
