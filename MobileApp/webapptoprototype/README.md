# WebAppToFigma · Mobile

当前版本 1.0.1，配套桌面 0.1.1。Android preview 从 [GitHub Releases](https://github.com/NarIyirm/Web-AppToPrototype/releases/tag/v0.1.1) 下载，iOS production 通过现有 TestFlight App 分发。实际构建与上传状态见[发布记录](../../docs/33-release-0.1.1-mobile-1.0.1.md)。

打包与 TestFlight 请读[构建说明](docs/BUILD-AND-TESTFLIGHT.md)。应用显示名、图标及平台标识由 app.config.ts 提供；owner、slug 和 Expo 项目关联继续复用。

Expo 57.0.30 / React Native 0.86.3 / React 19.2.3。按用户要求从SDK58降级，手机采集网页和App画面，保存项目，再交电脑重建并导入Figma。

已实现：项目与截图整理、裁切/旋转/像素遮挡、OCR校对、WebView视口/元素/矩形/整页采集、原始素材包、扫码加密分块传输、桌面收件与2.0设计包兼容导入。Android系统共享与iOS ReplayKit广播扩展已接入独立安装包，真实设备的系统采集效果仍需设备验证。

开发先读[AGENTS](AGENTS.md)、[HANDOFF](docs/HANDOFF.md)、[PROGRESS](docs/PROGRESS.md)。使用与反馈见[用户验证步骤](docs/USER-VERIFICATION.md)，完整范围见[ROADMAP](docs/ROADMAP.md)。视频挑帧、自动探索及复杂画面的完全重建不在当前支持范围。

## 开发命令

```sh
npm ci
npm run verify
npm run web
```

verify包含契约产物一致性、lint、严格类型与逻辑测试，可在新克隆中运行。普通开发检查可用npm run check；协议修改后运行npm run contract:build和npm run contract:check，并同步版本化桌面消费副本。`npm run verify -- --check-initialization`仅用于核对首次提交前的历史初始化快照，不作为提交后的开发门槛。

手机运行`npm run start:go`。当前Expo Go可导入截图、采集网页，并通过同一Wi-Fi扫码发送到电脑；无需手动分享ZIP。OCR 和系统录制需要包含本地模块的独立安装包。iPhone 独立安装包与 Expo Go 优先使用同一条 v2 加密局域网通道；Android 独立包及旧版二维码保留原生证书固定通道。

主入口为“添加画面 / 我的项目 / 发送到电脑”。电脑在`E:\WebToPrototype`运行`npm start`，打开“手机收件箱→生成手机配对码”。手机扫码、确认电脑名，再在电脑允许连接；勾选画面发送后，电脑收件箱会自动刷新，点击“转换并打开”继续。

SDK切换后先关闭旧Metro，在本目录运行`npx expo start --clear`并重新打开客户端。`assets/kitchmemo-icon.png`为旧素材URL的兼容副本，与现有`assets/images/icon.png`完全相同；app.json图标配置继续保留。

手机已通过现有 Expo 项目完成 Android preview APK 与 iOS production IPA 云构建；本轮未上传 App Store Connect 或发布 TestFlight，操作见构建说明。保留app.json的owner/projectId/图标/scheme；额外原生配置在app.config.ts、plugins和modules内。不运行reset-project搬走业务代码。
