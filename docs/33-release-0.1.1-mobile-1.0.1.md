# 桌面 0.1.1 / 移动 1.0.1

2026-10-21。用户在本地采集/拆层验证后，要求同步 GitHub、再次发布桌面及移动端，并明确选择自动上传 iOS 至 App Store Connect/TestFlight。该授权取代上一轮“仅本地验证、暂不构建或推送”的限制。

本次包含：App 截图拆为可靠 OCR 文字、平色背景/基础控件及局部图片；iOS 系统录屏按钮非零尺寸和明确指引；移动 UI 的采集入口、项目缩略图/勾选、状态、固定发送操作及浅深色主题。已有局域网传输和网页采集保持原流程。截图推断不能恢复原 App 组件树，转换后的文字仍可校对。

## 发布范围

- GitHub main：同步完整桌面、Figma 插件、移动端源码与验证记录。
- Windows x64 / Mac ARM64：桌面 0.1.1 ZIP，内含配套 Figma 插件。
- Android preview：移动 1.0.1 APK，递增 versionCode，复用现有签名。
- iOS production：移动 1.0.1，递增 buildNumber，复用主应用与录屏扩展的签名；上传现有 App Store Connect App `6825243915` 供 TestFlight 测试，不提交公开 App Store 审核。

源版本保持可追溯；产物实际路径、摘要、构建及提交结果在本页完成后记录。Mac ZIP 沿用当前跨平台构建方式；Developer ID / Apple 公证及真实 Mac 运行不因归档检查通过而视为通过。
