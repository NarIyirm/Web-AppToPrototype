import ExpoModulesCore
import Foundation
import ReplayKit
import UIKit
import Darwin

final class BroadcastPicker: ExpoView {
  // ReplayKit builds its button during initialization. A zero-sized initial
  // frame can leave that button invisible even after the outer Expo view grows.
  private let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 64, height: 64))
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.preferredExtension = Bundle.main.object(forInfoDictionaryKey: "MobileBroadcastExtension") as? String
    picker.showsMicrophoneButton = false
    picker.tintColor = .systemBlue
    picker.accessibilityLabel = "开始或停止系统界面采集"
    picker.accessibilityHint = "打开系统广播面板，选择界面采集，然后开始广播"
    addSubview(picker)
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    // Keep the public system control at its intended touch size, including
    // the first Fabric layout pass; do not simulate taps on private subviews.
    picker.bounds = CGRect(x: 0, y: 0, width: 64, height: 64)
    picker.center = CGPoint(x: bounds.midX, y: bounds.midY)
    picker.setNeedsLayout()
    picker.layoutIfNeeded()
  }
}
public final class MobileScreenModule: Module {
  private static func broadcastAlive(_ folder: URL) -> Bool? {
    let path = folder.deletingLastPathComponent().appendingPathComponent("capture.lock").path
    let descriptor = open(path, O_RDWR)
    guard descriptor >= 0 else { return nil }
    defer { close(descriptor) }
    if flock(descriptor, LOCK_EX | LOCK_NB) == 0 { flock(descriptor, LOCK_UN); return false }
    return errno == EWOULDBLOCK ? true : nil
  }
  private static func markHostVisible(_ visible: Bool) {
    guard let folder = try? inbox() else { return }
    let value: [String: Any] = ["visible": visible, "updatedAt": Date().timeIntervalSince1970]
    if let bytes = try? JSONSerialization.data(withJSONObject: value) {
      try? bytes.write(to: folder.deletingLastPathComponent().appendingPathComponent("capture-host.json"), options: .atomic)
    }
  }
  private static func inbox() throws -> URL {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "MobileCaptureAppGroup") as? String,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { throw NSError(domain: "M_CAPTURE_APP_GROUP_MISSING", code: 1) }
    let folder = container.appendingPathComponent("frames", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
  }
  public func definition() -> ModuleDefinition {
    Name("MobileScreen")
    View(BroadcastPicker.self) {}
    OnCreate {
      DispatchQueue.main.async { Self.markHostVisible(UIApplication.shared.applicationState != .background) }
    }
    OnAppEntersForeground { Self.markHostVisible(true) }
    OnAppEntersBackground { Self.markHostVisible(false) }
    AsyncFunction("status") { () throws -> [String: Any] in
      guard let folder = try? Self.inbox() else {
        return ["configured": false, "guidedCapture": true, "running": false,
          "message": "此安装包尚未配置系统采集，请使用截图导入。"]
      }
      let statusFile = folder.deletingLastPathComponent().appendingPathComponent("capture-status.json")
      var result: [String: Any] = ["configured": true, "guidedCapture": true, "running": false, "phase": "idle",
        "message": "开始后打开目标 App，在目标页面停留约 3 秒，再通过系统录屏入口停止。"]
      if let bytes = try? Data(contentsOf: statusFile), bytes.count < 4096,
        let status = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] {
        let updated = (status["updatedAt"] as? Double) ?? 0
        result["running"] = (status["running"] as? Bool ?? false) && Date().timeIntervalSince1970 - updated < 10
        result["message"] = status["message"] as? String ?? ""
        result["startedAt"] = status["startedAt"] as? Double ?? 0
        result["phase"] = status["phase"] as? String ?? "stopped"
      }
      // A paused extension retains the lock. A crashed extension releases it through
      // the OS, so stale JSON is never the sole source of a running/stopped receipt.
      if let alive = Self.broadcastAlive(folder) {
        result["running"] = alive
        if !alive && ["capturing", "paused"].contains(result["phase"] as? String ?? "") {
          result["phase"] = "stopped"; result["message"] = "系统采集已结束，请检查预览画面。"
        }
      }
      return result
    }
    AsyncFunction("frames") { () throws -> [[String: Any]] in
      let folder = try Self.inbox()
      let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey, .creationDateKey])
      return try files.filter { $0.lastPathComponent.range(of: "^frame-[a-f0-9-]+\\.png$", options: .regularExpression) != nil }
        .sorted {
          let left = (try? $0.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? .distantPast
          let right = (try? $1.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? .distantPast
          return left < right
        }.suffix(20).map { url in
          let values = try url.resourceValues(forKeys: [.fileSizeKey, .creationDateKey])
          guard (1...10 * 1024 * 1024).contains(values.fileSize ?? 0) else { throw NSError(domain: "M_CAPTURE_LIMIT", code: 1) }
          return ["id": url.lastPathComponent, "uri": url.absoluteString, "createdAt": (values.creationDate ?? Date()).timeIntervalSince1970 * 1000]
        }
    }
    AsyncFunction("removeFrame") { (id: String) throws in
      guard id.range(of: "^frame-[a-f0-9-]+\\.png$", options: .regularExpression) != nil else { throw NSError(domain: "M_CAPTURE_ID", code: 1) }
      try FileManager.default.removeItem(at: Self.inbox().appendingPathComponent(id))
    }
  }
}
