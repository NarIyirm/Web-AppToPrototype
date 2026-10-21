package expo.modules.mobilevision

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class MobileVisionModule : Module() {
  private fun load(uri: String): Bitmap {
    val context = requireNotNull(appContext.reactContext) { "M_SOURCE_UNAVAILABLE" }
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "M_ASSET_INVALID" }
    val root = File(context.filesDir, "mobile-captures/assets").canonicalFile
    val file = File(requireNotNull(parsed.path)).canonicalFile
    // Expo's document directory is Context.filesDir on Android.
    require(file.parentFile == root && file.name.matches(Regex("[a-f0-9]{64}\\.png"))
      && file.isFile && file.length() in 1..(10L * 1024 * 1024)) { "M_ASSET_INVALID" }
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    require(bounds.outWidth in 1..4096 && bounds.outHeight in 1..4096) { "M_LIMIT_EXCEEDED" }
    return requireNotNull(BitmapFactory.decodeFile(file.path)) { "M_ASSET_INVALID" }
  }

  override fun definition() = ModuleDefinition {
    Name("MobileVision")
    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val bitmap = load(uri)
      val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
      recognizer.process(InputImage.fromBitmap(bitmap, 0))
        .addOnSuccessListener { result ->
          try {
            val lines = result.textBlocks.flatMap { it.lines }
            require(lines.size <= 5000 && lines.sumOf { it.text.length } <= 500000) { "M_LIMIT_EXCEEDED" }
            val observations = lines.mapNotNull { line ->
              line.boundingBox?.let { box ->
                val x = box.left.coerceIn(0, bitmap.width)
                val y = box.top.coerceIn(0, bitmap.height)
                val width = (box.right.coerceIn(0, bitmap.width) - x)
                val height = (box.bottom.coerceIn(0, bitmap.height) - y)
                if (width <= 0 || height <= 0) null else mapOf(
                  "text" to line.text,
                  "bounds" to mapOf("x" to x, "y" to y, "width" to width, "height" to height),
                  // A missing or engine-specific score is explicitly unknown.
                  "confidence" to null,
                  "provenance" to "ocr"
                )
              }
            }
            promise.resolve(mapOf("width" to bitmap.width, "height" to bitmap.height, "observations" to observations))
          } catch (error: Exception) { promise.reject("M_OCR_FAILED", "文字识别结果超出预算。", error) }
        }
        .addOnFailureListener { error -> promise.reject("M_OCR_FAILED", "本机文字识别失败。", error) }
        .addOnCompleteListener { recognizer.close(); bitmap.recycle() }
    }
    AsyncFunction("redact") { uri: String, regions: List<Map<String, Double>> ->
      require(regions.size in 1..100) { "M_LIMIT_EXCEEDED" }
      val original = load(uri)
      val bitmap = requireNotNull(original.copy(Bitmap.Config.ARGB_8888, true))
      original.recycle()
      try {
        val canvas = Canvas(bitmap)
        val paint = Paint().apply { color = Color.BLACK; style = Paint.Style.FILL; isAntiAlias = false }
        for (region in regions) {
          val x = requireNotNull(region["x"]); val y = requireNotNull(region["y"])
          val width = requireNotNull(region["width"]); val height = requireNotNull(region["height"])
          require(listOf(x, y, width, height).all { it.isFinite() } && x >= 0 && y >= 0 && width > 0 && height > 0
            && x + width <= bitmap.width && y + height <= bitmap.height) { "M_ASSET_INVALID" }
          canvas.drawRect(x.toFloat(), y.toFloat(), (x + width).toFloat(), (y + height).toFloat(), paint)
        }
        val context = requireNotNull(appContext.reactContext)
        val output = File(context.cacheDir, "redacted-${UUID.randomUUID()}.png")
        output.outputStream().use { stream -> require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) }
        Uri.fromFile(output).toString()
      } finally { bitmap.recycle() }
    }
  }
}
