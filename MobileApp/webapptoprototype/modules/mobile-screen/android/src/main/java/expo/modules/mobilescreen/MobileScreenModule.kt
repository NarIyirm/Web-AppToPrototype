package expo.modules.mobilescreen

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private class CaptureContract : AppContextActivityResultContract<String, Intent?> {
  override fun createIntent(context: Context, input: String): Intent =
    (context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager).createScreenCaptureIntent()
  override fun parseResult(input: String, resultCode: Int, intent: Intent?): Intent? = if (resultCode == Activity.RESULT_OK) intent else null
}
class MobileScreenModule : Module() {
  private lateinit var launcher: AppContextActivityResultLauncher<String, Intent?>
  private var requesting = false
  override fun definition() = ModuleDefinition {
    Name("MobileScreen")
    OnActivityEntersForeground { CaptureService.hostVisibility(true) }
    OnActivityEntersBackground { CaptureService.hostVisibility(false) }
    RegisterActivityContracts { launcher = registerForActivityResult(CaptureContract()) { _, _ -> /* Destruction cancels; never reuse a grant. */ } }
    AsyncFunction("start") Coroutine { returnUrl: String ->
      check(!requesting && !CaptureService.running) { "M_CAPTURE_BUSY" }
      check(Settings.canDrawOverlays(requireNotNull(appContext.reactContext))) { "请先允许悬浮采集按钮，或使用截图导入。" }
      requesting = true
      try {
        val grant = launcher.launch("new-session")
        if (grant == null) false else {
          val context = requireNotNull(appContext.reactContext)
          require(returnUrl.length <= 2048 && Uri.parse(returnUrl).scheme != null)
          ContextCompat.startForegroundService(context, Intent(context, CaptureService::class.java).putExtra("grant", grant).putExtra("returnUrl", returnUrl))
          true
        }
      } finally { requesting = false }
    }
    AsyncFunction("stop") {
      val context = requireNotNull(appContext.reactContext)
      context.stopService(Intent(context, CaptureService::class.java))
    }
    AsyncFunction("status") { CaptureService.status(requireNotNull(appContext.reactContext)) }
    AsyncFunction("requestOverlay") {
      val activity = requireNotNull(appContext.currentActivity)
      activity.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${activity.packageName}")))
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("frames") {
      val folder = File(requireNotNull(appContext.reactContext).filesDir, "system-frames")
      folder.listFiles()?.filter { it.name.matches(Regex("frame-[a-f0-9-]+\\.png")) && it.length() in 1..(10L * 1024 * 1024) }
        ?.sortedBy { it.lastModified() }?.take(20)?.map { mapOf("id" to it.name, "uri" to Uri.fromFile(it).toString(), "createdAt" to it.lastModified()) } ?: emptyList()
    }
    AsyncFunction("removeFrame") { id: String ->
      require(id.matches(Regex("frame-[a-f0-9-]+\\.png")))
      File(requireNotNull(appContext.reactContext).filesDir, "system-frames/$id").delete()
    }
  }
}
