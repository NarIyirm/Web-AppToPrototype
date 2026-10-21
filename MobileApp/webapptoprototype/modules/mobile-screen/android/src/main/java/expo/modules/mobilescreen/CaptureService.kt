package expo.modules.mobilescreen

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.io.File
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

/** Projection and one-shot capture run natively, including while JS is suspended. */
class CaptureService : Service() {
  companion object {
    @Volatile var running = false
    @Volatile private var hostVisible = true
    private var current: CaptureService? = null // Main-thread only.
    fun hostVisibility(visible: Boolean) {
      hostVisible = visible
      Handler(Looper.getMainLooper()).post { current?.updateOverlay() }
    }
    fun status(context: Context): Map<String, Any> {
      val stored = context.getSharedPreferences("mobile-screen", Context.MODE_PRIVATE)
      val phase = stored.getString("phase", "idle") ?: "idle"
      val interrupted = !running && phase in listOf("ready", "capturing")
      return mapOf("configured" to true, "guidedCapture" to true, "running" to running,
        "overlayGranted" to Settings.canDrawOverlays(context), "startedAt" to stored.getLong("startedAt", 0),
        "phase" to if (interrupted) "stopped" else phase,
        "message" to if (interrupted) "采集已结束，未生成新画面。可以重新开始。" else (stored.getString("message", "准备好后开始采集") ?: ""))
    }
  }
  private val main = Handler(Looper.getMainLooper())
  private var projection: MediaProjection? = null
  private var display: VirtualDisplay? = null
  private var reader: ImageReader? = null
  private var latest: Image? = null // Owned and closed only on the worker.
  private var thread: HandlerThread? = null
  private var worker: Handler? = null
  private var overlay: View? = null
  @Volatile private var stopped = false
  @Volatile private var taking = false
  @Volatile private var saved = false
  @Volatile private var failed = false
  private var requestSerial = 0
  private var returnUrl: String? = null
  override fun onBind(intent: Intent?): IBinder? = null
  private fun record(phase: String, text: String) {
    getSharedPreferences("mobile-screen", MODE_PRIVATE).edit().putString("phase", phase).putString("message", text).apply()
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "stop") { stopSelf(); return START_NOT_STICKY }
    if (running) return START_NOT_STICKY
    if (stopped) { stopSelf(); return START_NOT_STICKY }
    try {
      current = this
      returnUrl = intent?.getStringExtra("returnUrl")
      getSharedPreferences("mobile-screen", MODE_PRIVATE).edit().putLong("startedAt", System.currentTimeMillis()).apply()
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("capture", "界面采集", NotificationManager.IMPORTANCE_LOW))
      val stop = PendingIntent.getService(this, 1, Intent(this, CaptureService::class.java).setAction("stop"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "capture") else Notification.Builder(this)
      val notification = builder.setContentTitle("请打开要转换的 App")
        .setContentText("定位页面后，点击悬浮按钮“采集当前页”。60 秒内有效。")
        .setSmallIcon(android.R.drawable.ic_menu_camera).setOngoing(true).setContentIntent(returnIntent())
        .addAction(Notification.Action.Builder(null, "停止采集", stop).build()).build()
      if (Build.VERSION.SDK_INT >= 29) startForeground(41782, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION) else startForeground(41782, notification)
      check(Settings.canDrawOverlays(this)) { "悬浮按钮权限已关闭，请返回应用重新授权。" }
      @Suppress("DEPRECATION") val grant = intent?.getParcelableExtra<Intent>("grant") ?: error("M_CAPTURE_GRANT_MISSING")
      val folder = File(filesDir, "system-frames").apply { mkdirs() }
      check((folder.listFiles()?.count { it.name.endsWith(".png") } ?: 0) < 20) { "请先整理已有采集画面，再开始新采集。" }
      thread = HandlerThread("mobile-screen").apply { start() }; worker = Handler(thread!!.looper)
      projection = (getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager).getMediaProjection(android.app.Activity.RESULT_OK, grant)
      projection!!.registerCallback(object : MediaProjection.Callback() {
        override fun onStop() {
          if (!stopped && !saved && !failed) record("stopped", "系统共享已停止")
          stopped = true; running = false; main.post { stopSelf() }
        }
        override fun onCapturedContentResize(width: Int, height: Int) { worker?.post { resize(width, height) } }
      }, worker)
      val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val size = if (Build.VERSION.SDK_INT >= 30) wm.maximumWindowMetrics.bounds else {
        val metrics = resources.displayMetrics
        android.graphics.Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
      }
      val (width, height) = bounded(size.width(), size.height())
      reader = makeReader(width, height)
      display = projection!!.createVirtualDisplay("WebToPrototype", width, height, resources.configuration.densityDpi,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, worker)
      running = true; record("ready", "请打开目标 App，定位后点击悬浮按钮“采集当前页”。")
      updateOverlay()
      main.postDelayed({ if (!stopped) { record("stopped", "本次采集已到 60 秒时限，请重新开始。"); stopSelf() } }, 60_000)
    } catch (error: Exception) { failed = true; record("failed", error.message ?: "系统采集启动失败，请重试。"); stopSelf() }
    return START_NOT_STICKY
  }
  private fun returnIntent(): PendingIntent? = packageManager.getLaunchIntentForPackage(packageName)?.let {
    returnUrl?.let { url -> it.action = Intent.ACTION_VIEW; it.data = Uri.parse(url) }
    PendingIntent.getActivity(this, 2, it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
  private fun updateOverlay() {
    if (!running || stopped || hostVisible || taking) { removeOverlay(); return }
    if (overlay != null) return
    try {
      val wm = getSystemService(WINDOW_SERVICE) as WindowManager
      val box = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; setPadding(dp(10), dp(8), dp(10), dp(8)); setBackgroundColor(Color.rgb(21, 33, 50))
      }
      val hint = TextView(this).apply { text = "定位目标页面，再点采集 · 可拖动"; setTextColor(Color.WHITE); textSize = 13f; setPadding(0, dp(8), 0, dp(8)) }
      val action = Button(this).apply { text = "采集当前页"; minHeight = dp(48); contentDescription = "采集当前页面并停止共享"; setOnClickListener { captureOnce() } }
      val cancel = Button(this).apply { text = "取消采集"; minHeight = dp(48); setOnClickListener { stopSelf() } }
      box.addView(hint); box.addView(action); box.addView(cancel)
      val params = WindowManager.LayoutParams(dp(248), WindowManager.LayoutParams.WRAP_CONTENT,
        if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else {
          @Suppress("DEPRECATION") val legacyType = WindowManager.LayoutParams.TYPE_PHONE; legacyType
        }, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT).apply {
        gravity = Gravity.TOP or Gravity.START; x = dp(12); y = dp(100)
      }
      var downX = 0f; var downY = 0f; var originalX = 0; var originalY = 0
      hint.setOnTouchListener { _, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> { downX = event.rawX; downY = event.rawY; originalX = params.x; originalY = params.y; true }
          MotionEvent.ACTION_MOVE -> {
            val bounds = resources.displayMetrics
            params.x = (originalX + event.rawX - downX).roundToInt().coerceIn(0, max(0, bounds.widthPixels - box.width))
            params.y = (originalY + event.rawY - downY).roundToInt().coerceIn(0, max(0, bounds.heightPixels - box.height))
            try { wm.updateViewLayout(box, params) } catch (_: Exception) { }; true
          }
          MotionEvent.ACTION_UP -> { hint.performClick(); true }
          else -> false
        }
      }
      wm.addView(box, params); overlay = box
    } catch (_: Exception) { failed = true; record("failed", "悬浮按钮无法显示，请检查权限或使用截图导入。"); stopSelf() }
  }
  private fun removeOverlay() {
    overlay?.let { try { (getSystemService(WINDOW_SERVICE) as WindowManager).removeView(it) } catch (_: Exception) { } }
    overlay = null
  }
  private fun captureOnce() {
    if (taking || stopped || hostVisible) return
    taking = true; removeOverlay(); record("capturing", "正在保存当前页面…")
    worker?.post {
      // Discard pre-click buffers. Resume the SAME display after removing the overlay,
      // requesting a fresh frame even for an otherwise static target page.
      latest?.close(); latest = null
      val serial = ++requestSerial
      display?.surface = null
      worker?.postDelayed({ if (!stopped && serial == requestSerial) display?.surface = reader?.surface }, 80)
      worker?.postDelayed({ if (!stopped && serial == requestSerial) savePending(serial) }, 350)
      worker?.postDelayed({
        if (!stopped && taking && serial == requestSerial) {
          taking = false; requestSerial++; record("ready", "未取得新画面，请保持目标页面打开后重试采集。")
          main.post { updateOverlay(); Toast.makeText(this, "未取得新画面，请重试采集", Toast.LENGTH_LONG).show() }
        }
      }, 4_000)
    }
  }
  private fun savePending(serial: Int) {
    if (stopped || !taking || serial != requestSerial) return
    if (hostVisible) { taking = false; record("stopped", "已返回本应用，请重新打开目标页面采集。"); main.post { stopSelf() }; return }
    val image = latest
    if (image == null) { worker?.postDelayed({ savePending(serial) }, 100); return }
    latest = null
    try {
      val plane = image.planes[0]
      check(plane.pixelStride == 4 && plane.rowStride % 4 == 0) { "不支持的系统图像格式，请使用截图导入。" }
      val padded = Bitmap.createBitmap(plane.rowStride / 4, image.height, Bitmap.Config.ARGB_8888)
      try {
        padded.copyPixelsFromBuffer(plane.buffer)
        val cropped = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
        try {
          val folder = File(filesDir, "system-frames").apply { mkdirs() }
          val id = UUID.randomUUID(); val temp = File(folder, "frame-$id.tmp"); val output = File(folder, "frame-$id.png")
          try {
            temp.outputStream().use { check(cropped.compress(Bitmap.CompressFormat.PNG, 100, it)) }
            if (stopped) return
            if (hostVisible) { taking = false; record("stopped", "已返回本应用，请重新打开目标页面采集。"); main.post { stopSelf() }; return }
            check(temp.length() <= 10L * 1024 * 1024 && temp.renameTo(output)) { "画面保存失败，请重试。" }
          } finally { temp.delete() }
          saved = true; taking = false; record("saved", "画面已采集，请返回应用预览并发送。")
          main.post {
            val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "capture") else Notification.Builder(this)
            val note = builder.setContentTitle("画面已采集")
              .setContentText("点击返回应用，预览并发送到电脑转换。")
              .setSmallIcon(android.R.drawable.ic_menu_camera).setAutoCancel(true).setContentIntent(returnIntent()).build()
            getSystemService(NotificationManager::class.java).notify(41783, note)
            Toast.makeText(this, "画面已采集，请返回应用预览", Toast.LENGTH_LONG).show(); stopSelf()
          }
        } finally { if (cropped !== padded) cropped.recycle() }
      } finally { padded.recycle() }
    } catch (error: Exception) {
      if (!stopped) { failed = true; record("failed", error.message ?: "采集保存失败，请重试。"); main.post { stopSelf() } }
    } finally { image.close() }
  }
  private fun dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()
  private fun bounded(w: Int, h: Int): Pair<Int, Int> {
    require(w > 0 && h > 0)
    val scale = minOf(1.0, 2048.0 / max(w, h))
    return Pair(max(1, (w * scale).roundToInt()), max(1, (h * scale).roundToInt()))
  }
  private fun resize(w: Int, h: Int) {
    if (stopped || display == null) return
    if (w <= 0 || h <= 0) return
    val (width, height) = bounded(w, h)
    if (reader?.width == width && reader?.height == height) return
    latest?.close(); latest = null
    val old = reader; val next = makeReader(width, height)
    display!!.resize(width, height, resources.configuration.densityDpi); display!!.surface = next.surface
    reader = next; old?.close()
  }
  private fun makeReader(width: Int, height: Int): ImageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3).apply {
    setOnImageAvailableListener({ source ->
      val image = try { source.acquireLatestImage() } catch (_: IllegalStateException) { null } ?: return@setOnImageAvailableListener
      if (stopped) { image.close(); return@setOnImageAvailableListener }
      latest?.close(); latest = image
    }, worker)
  }
  override fun onDestroy() {
    stopped = true; running = false; main.removeCallbacksAndMessages(null); removeOverlay()
    if (current === this) current = null
    val phase = getSharedPreferences("mobile-screen", MODE_PRIVATE).getString("phase", "idle")
    if (phase == "ready" || phase == "capturing") record("stopped", "采集已停止，未保存新画面。")
    val handler = worker
    val cleanup = Runnable { latest?.close(); latest = null; display?.release(); display = null; reader?.close(); reader = null; projection?.stop(); projection = null; thread?.quitSafely() }
    if (handler != null) handler.post(cleanup) else cleanup.run()
    if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else {
      @Suppress("DEPRECATION") stopForeground(true)
    }
    super.onDestroy()
  }
}
