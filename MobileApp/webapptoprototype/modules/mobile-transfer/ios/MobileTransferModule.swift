import ExpoModulesCore
import Foundation
import Security
import CryptoKit

private final class PinnedDelegate: NSObject, URLSessionDelegate, URLSessionTaskDelegate {
  let pin: String
  let host: String
  init(pin: String, host: String) { self.pin = pin; self.host = host }
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
  func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
      challenge.protectionSpace.host == host, let trust = challenge.protectionSpace.serverTrust,
      let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], chain.count == 1
    else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    let certificate = chain[0], bytes = SecCertificateCopyData(certificate) as Data
    let actual = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    guard actual == pin else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    SecTrustSetPolicies(trust, SecPolicyCreateSSL(true, host as CFString))
    SecTrustSetAnchorCertificates(trust, [certificate] as CFArray)
    SecTrustSetAnchorCertificatesOnly(trust, true)
    guard SecTrustEvaluateWithError(trust, nil) else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    completionHandler(.useCredential, URLCredential(trust: trust))
  }
}
public final class MobileTransferModule: Module {
  private static func request(_ base: String, _ pin: String, _ path: String, _ method: String, _ token: String, _ body: Data) async throws -> String {
    guard let endpoint = URLComponents(string: base), endpoint.scheme == "https", endpoint.user == nil, endpoint.password == nil,
      endpoint.path.isEmpty, endpoint.query == nil, endpoint.fragment == nil, let host = endpoint.host, let port = endpoint.port, (1024...65535).contains(port),
      pin.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
      path.range(of: "^/mobile/(pair|session|disconnect|uploads(/[a-f0-9]{64}(/([0-9]+|commit))?)?)$", options: .regularExpression) != nil,
      ["GET", "POST", "PUT"].contains(method), body.count <= 262144,
      token.isEmpty || token.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
      let url = URL(string: base + path)
    else { throw NSError(domain: "M_REQUEST", code: 1) }
    let parts = host.split(separator: ".").compactMap { Int($0) }
    guard parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }),
      parts[0] == 10 || parts[0] == 192 && parts[1] == 168 || parts[0] == 172 && (16...31).contains(parts[1])
    else { throw NSError(domain: "M_ENDPOINT", code: 1) }
    let timeout: TimeInterval = path == "/mobile/pair" ? 90 : 15
    var request = URLRequest(url: url, timeoutInterval: timeout)
    request.httpMethod = method
    if !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if method != "GET" { request.httpBody = body; request.setValue(method == "PUT" ? "application/octet-stream" : "application/json", forHTTPHeaderField: "Content-Type") }
    let config = URLSessionConfiguration.ephemeral
    config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCache = nil
    config.timeoutIntervalForRequest = timeout; config.timeoutIntervalForResource = timeout + 5
    let delegate = PinnedDelegate(pin: pin, host: host)
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    // Stream the small response so an unexpected peer cannot allocate an unbounded Data.
    let (stream, response) = try await session.bytes(for: request)
    var data = Data()
    for try await byte in stream { guard data.count < 16384 else { throw NSError(domain: "M_RESPONSE_LIMIT", code: 1) }; data.append(byte) }
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), let text = String(data: data, encoding: .utf8)
    else { throw NSError(domain: "M_HTTP_REJECTED", code: (response as? HTTPURLResponse)?.statusCode ?? 0, userInfo: [NSLocalizedDescriptionKey: String(data: data.prefix(200), encoding: .utf8) ?? "连接被拒绝"]) }
    return text
  }
  public func definition() -> ModuleDefinition {
    Name("MobileTransfer")
    AsyncFunction("request") { (base: String, pin: String, path: String, method: String, token: String, body: String) async throws -> String in
      guard body.utf8.count <= 4096 else { throw NSError(domain: "M_BODY_LIMIT", code: 1) }
      return try await Self.request(base, pin, path, method, token, Data(body.utf8))
    }
    AsyncFunction("chunk") { (base: String, pin: String, path: String, token: String, uri: String, offset: Double, length: Int) async throws -> String in
      guard let url = URL(string: uri), url.isFileURL,
        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
        url.resolvingSymlinksInPath().deletingLastPathComponent() == cache.appendingPathComponent("mobile-exports").resolvingSymlinksInPath(),
        url.lastPathComponent.range(of: "^b-[a-z0-9-]+\\.w2pm\\.zip$", options: .regularExpression) != nil,
        offset.isFinite, offset >= 0, offset.rounded() == offset, (1...262144).contains(length)
      else { throw NSError(domain: "M_UPLOAD_FILE", code: 1) }
      let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
      guard size > 0, size <= 64 * 1024 * 1024, offset + Double(length) <= Double(size) else { throw NSError(domain: "M_UPLOAD_RANGE", code: 1) }
      let handle = try FileHandle(forReadingFrom: url); defer { try? handle.close() }
      try handle.seek(toOffset: UInt64(offset))
      guard let data = try handle.read(upToCount: length), data.count == length else { throw NSError(domain: "M_UPLOAD_READ", code: 1) }
      return try await Self.request(base, pin, path, "PUT", token, data)
    }
  }
}
