# 桌面 0.1.1 / 移动 1.0.1

2026-10-21。用户在本地采集/拆层验证后，要求同步 GitHub、再次发布桌面及移动端，并明确选择自动上传 iOS 至 App Store Connect/TestFlight。该授权取代上一轮“仅本地验证、暂不构建或推送”的限制。

本次包含：App 截图拆为可靠 OCR 文字、平色背景/基础控件及局部图片；iOS 系统录屏按钮非零尺寸和明确指引；移动 UI 的采集入口、项目缩略图/勾选、状态、固定发送操作及浅深色主题。已有局域网传输和网页采集保持原流程。截图推断不能恢复原 App 组件树，转换后的文字仍可校对。

## 发布范围

- GitHub main：同步完整桌面、Figma 插件、移动端源码与验证记录。
- Windows x64 / Mac ARM64：桌面 0.1.1 ZIP，内含配套 Figma 插件。
- Android preview：移动 1.0.1 APK，递增 versionCode，复用现有签名。
- iOS production：移动 1.0.1，递增 buildNumber，复用主应用与录屏扩展的签名；上传现有 App Store Connect App `6825243915` 供 TestFlight 测试，不提交公开 App Store 审核。

## 本次结果

[GitHub 发布页](https://github.com/NarIyirm/Web-AppToPrototype/releases/tag/v0.1.1) 提供 Windows x64、Mac ARM64、Android preview、独立 Figma 插件及校验文件。所有产物也保存在根 `release/`，旧包保留。

| 平台 | 版本 | 产物 / 分发 |
|---|---|---|
| Windows x64 | 0.1.1 | WebToPrototype-0.1.1-win-x64-2026-10-21T12-06-38-794Z.zip |
| Mac ARM64 | 0.1.1 | WebToPrototype-0.1.1-mac-arm64-2026-10-21T12-07-36-899Z.zip |
| Android preview | 1.0.1（2） | WebAppToFigma-1.0.1-android-preview-2.apk |
| iOS production | 1.0.1（5） | WebAppToFigma-1.0.1-ios-production-5.ipa，已自动上传 App Store Connect |

iOS [构建](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/87d30bc9-d6db-4740-8641-9abdebf1c236)、Android [构建](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/07508fea-dd79-4e5c-8deb-7938fc951e5a)均 FINISHED；iOS [提交](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/submissions/9ee8e95c-7ea0-4e24-acfe-ae63d56164a1) FINISHED。Apple processingState 为 VALID，当前内外部测试均为 MISSING_EXPORT_COMPLIANCE；需 App 管理者在 [TestFlight](https://appstoreconnect.apple.com/apps/6825243915/testflight/ios) 打开 1.0.1（5）完成出口合规问卷，才能开始测试。没有提交公开 App Store 审核。

源码先同步 `78079d3`；桌面产物元数据进一步修正为 `9ef6075`。两者移动源码一致，移动云构建引用 `78079d3`，桌面发布标签固定到 `9ef6075`。源码/产物核验详见[机器可读记录](verification/2026-10-21-release-0.1.1.json)，其中保留 SHA-256。

## 实际验证

- 桌面类型检查、166 项测试及构建通过；真正打包后的 Windows EXE 在独立数据目录通过 30 项流程，包含重启后的项目与历史恢复。
- Windows/Mac ZIP 的 CRC、SHA-256、应用版本和关键 payload 与最终构建匹配。Mac 检查 632 条目、321 文件、14 链接、39 源文件；6 项归档规则及 9 项准备脚本路径测试通过。
- 移动 lint、类型及 64 项测试通过；UI 7 个页面和 9 项安全区/裁切回归记录见移动验证目录。
- IPA 的主应用/录屏扩展版本、分发描述文件、App Group、局域网配置及新版界面 bundle 核对通过。
- APK 的实际 Manifest 版本、采集服务、三个本地模块、四种架构及新版界面 bundle 核对通过，v2 签名证书摘要与旧版一致，可沿用旧版签名更新；未执行 APK 完整密码学签名验证。

Mac ZIP 沿用当前跨平台构建方式；Developer ID / Apple 公证及真实 Mac 运行未执行。手机新包的设备安装、原生系统采集和最终 Figma 图层效果仍需设备使用确认；不把云编译/归档核对当作真机验证。
