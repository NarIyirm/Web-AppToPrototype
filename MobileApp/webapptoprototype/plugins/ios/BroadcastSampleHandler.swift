import ReplayKit
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import Darwin

/// Runs in the broadcast extension process; audio samples are never retained.
final class BroadcastSampleHandler: RPBroadcastSampleHandler {
  private let context = CIContext(options: [.cacheIntermediates: false])
  private var folder: URL?
  private var lastFrame = Date.distantPast
  private var started = Date()
  private var count = 0
  private var sessionFiles: [URL] = []
  private var paused = false
  private var finishing = false
  private var lockDescriptor: Int32 = -1
  private func releaseSession() {
    if lockDescriptor >= 0 { flock(lockDescriptor, LOCK_UN); close(lockDescriptor); lockDescriptor = -1 }
  }
  deinit { releaseSession() }
  private func finish(_ error: Error) {
    finishing = true; releaseSession(); finishBroadcastWithError(error)
  }
  private var lastStatus = Date.distantPast
  private func status(_ running: Bool, _ message: String, phase: String = "capturing") {
    guard let folder else { return }
    lastStatus = Date()
    let value: [String: Any] = ["running": running, "message": message, "updatedAt": lastStatus.timeIntervalSince1970,
      "startedAt": started.timeIntervalSince1970 * 1000, "phase": phase]
    if let bytes = try? JSONSerialization.data(withJSONObject: value) {
      try? bytes.write(to: folder.deletingLastPathComponent().appendingPathComponent("capture-status.json"), options: .atomic)
    }
  }
  override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "MobileCaptureAppGroup") as? String,
      let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { finish(NSError(domain: "M_CAPTURE_APP_GROUP_MISSING", code: 1)); return }
    folder = root.appendingPathComponent("frames", isDirectory: true)
    do {
      try FileManager.default.createDirectory(at: folder!, withIntermediateDirectories: true)
      lockDescriptor = open(root.appendingPathComponent("capture.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
      guard lockDescriptor >= 0, flock(lockDescriptor, LOCK_EX | LOCK_NB) == 0 else {
        throw NSError(domain: "M_CAPTURE_BUSY", code: 1, userInfo: [NSLocalizedDescriptionKey: "已有采集正在运行，请先停止。"])
      }
      count = try FileManager.default.contentsOfDirectory(at: folder!, includingPropertiesForKeys: nil).filter { $0.pathExtension == "png" }.count
      guard count < 20 else { throw NSError(domain: "M_CAPTURE_LIMIT", code: 1, userInfo: [NSLocalizedDescriptionKey: "请先回到应用整理已有 20 帧。"] ) }
      started = Date(); status(true, "请打开目标 App，在需要的页面停留约 3 秒，再从系统录屏入口停止。")
    } catch { status(false, error.localizedDescription, phase: "failed"); finish(error) }
  }
  override func broadcastPaused() { paused = true; status(true, "系统采集已暂停，请通过系统录屏入口继续或停止。", phase: "paused") }
  override func broadcastResumed() { paused = false; status(true, "系统采集已恢复") }
  override func broadcastFinished() {
    if !finishing { status(false, "采集已结束，返回应用预览并发送。", phase: "stopped") }
    finishing = true; releaseSession()
  }
  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    guard sampleBufferType == .video, !paused, !finishing, let folder else { return }
    let now = Date()
    if now.timeIntervalSince(started) >= 60 {
      finishing = true; status(false, "本次采集已结束，请返回应用预览。", phase: "stopped")
      finish(NSError(domain: "M_CAPTURE_FINISHED", code: 0, userInfo: [NSLocalizedDescriptionKey: "本次有界采集已结束。"])); return
    }
    // The host writes this atomically from native app lifecycle callbacks, independent
    // of React rendering/JS suspension. Never replace the target with our own preview.
    let hostFile = folder.deletingLastPathComponent().appendingPathComponent("capture-host.json")
    guard let hostBytes = try? Data(contentsOf: hostFile), hostBytes.count < 4096,
      let host = try? JSONSerialization.jsonObject(with: hostBytes) as? [String: Any],
      let visible = host["visible"] as? Bool else { return }
    if visible {
      if now.timeIntervalSince(lastStatus) >= 2 { status(true, "请通过顶部系统录屏状态或控制中心停止，再预览画面。") }
      return
    }
    let backgroundAt = host["updatedAt"] as? Double ?? now.timeIntervalSince1970
    guard now.timeIntervalSince1970 - backgroundAt >= 1.2 else { return }
    guard now.timeIntervalSince(lastFrame) >= 3, let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    lastFrame = now
    autoreleasepool {
      var image = CIImage(cvPixelBuffer: buffer)
      if let raw = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber,
        let orientation = CGImagePropertyOrientation(rawValue: raw.uint32Value) { image = image.oriented(orientation) }
      let scale = min(1, 2048 / max(image.extent.width, image.extent.height))
      image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      guard let rendered = context.createCGImage(image, from: image.extent) else { return }
      let output = folder.appendingPathComponent("frame-\(UUID().uuidString.lowercased()).png")
      let bytes = NSMutableData()
      guard let destination = CGImageDestinationCreateWithData(bytes, UTType.png.identifier as CFString, 1, nil) else { return }
      CGImageDestinationAddImage(destination, rendered, nil)
      guard CGImageDestinationFinalize(destination), bytes.length <= 10 * 1024 * 1024 else { return }
      do {
        // Keep the newest candidates from THIS session as a bounded rolling history.
        // Pictures from previous sessions are never removed automatically.
        let previous = count >= 20 ? sessionFiles.first : nil
        if count >= 20 && previous == nil { return }
        try (bytes as Data).write(to: output, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        count += 1; sessionFiles.append(output)
        if let previous {
          try FileManager.default.removeItem(at: previous)
          sessionFiles.removeFirst(); count -= 1
        }
        status(true, "已取得画面，在目标页面停留后通过系统录屏入口停止。")
      }
      catch { status(false, "采集帧保存失败", phase: "failed"); finish(error) }
    }
  }
}
