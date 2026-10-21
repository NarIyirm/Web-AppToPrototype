# Web to Prototype · Mobile

Expo 57.0.30 / React Native 0.86.3 / React 19.2.3。按用户要求从SDK58降级，手机采集网页和App画面，保存项目，再交电脑重建并导入Figma。

已实现业务alpha：项目与截图整理、裁切/旋转/像素遮挡、OCR校对、WebView视口/元素/矩形采集、原始素材包、扫码加密分块传输、桌面收件与2.0设计包兼容导入。Android系统共享与iOS ReplayKit广播扩展已接入源码，原生编译/安装及真实效果待用户验证。

开发先读[AGENTS](AGENTS.md)、[HANDOFF](docs/HANDOFF.md)、[PROGRESS](docs/PROGRESS.md)。使用与反馈见[用户验证步骤](docs/USER-VERIFICATION.md)，完整范围见[ROADMAP](docs/ROADMAP.md)。视频挑帧、手机长页/多选及复杂重建等尚未完成，不能当作完整发布版。

## 开发命令

```sh
npm ci
npm run verify
npm run web
```

verify包含契约产物一致性、lint、严格类型与逻辑测试，可在新克隆中运行。普通开发检查可用npm run check；协议修改后运行npm run contract:build和npm run contract:check，并同步版本化桌面消费副本。`npm run verify -- --check-initialization`仅用于核对首次提交前的历史初始化快照，不作为提交后的开发门槛。

手机运行`npm run start:go`。当前Expo Go可导入截图、采集网页，并通过同一Wi-Fi扫码发送到电脑；无需手动分享ZIP。OCR、系统录制和原生证书固定路径需要包含本地模块的独立安装包。

主入口为“添加画面 / 我的项目 / 发送到电脑”。电脑在`E:\WebToPrototype`运行`npm start`，打开“手机收件箱→生成手机配对码”。手机扫码、确认电脑名，再在电脑允许连接；勾选画面发送后，电脑收件箱会自动刷新，点击“转换并打开”继续。

SDK切换后先关闭旧Metro，在本目录运行`npx expo start --clear`并重新打开客户端。`assets/kitchmemo-icon.png`为旧素材URL的兼容副本，与现有`assets/images/icon.png`完全相同；app.json图标配置继续保留。

手机打包由用户现有GitHub→Expo流程处理，当前没有触发构建/发布。保留app.json的owner/projectId/图标/scheme；额外原生配置在app.config.ts、plugins和modules内。不运行reset-project搬走业务代码。
