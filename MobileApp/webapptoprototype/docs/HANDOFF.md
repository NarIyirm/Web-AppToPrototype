# 移动项目续接

2026-10-21 iPhone 局域网修复：用户确认本地网络开关已开启。原正式包优先走原生固定证书 HTTPS，Expo Go 走 v2 AES-GCM 认证加密通道，且连接失败提示错误地一律建议开启权限。现 iOS 对 v2 二维码统一使用既有加密通道，配对/状态/文件分块保持同一连接；不因失败跨通道重试，保留旧版与 Android 固定证书支持。移动 64 项测试、契约/lint/类型及电脑真实接收器的加密配对/大分块/续传/重放与篡改拒绝/断连测试通过。build3 IPA 已有本地网络用途说明和 NSAllowsLocalNetworking，非缺少声明。具体旧原生链路失败原因尚无手机原始错误证明；新 iOS production 包准备构建，真机复验仍待用户。

2026-10-21 最终打包结果：Windows x64与Mac ARM64包生成；iOS production 1.0.0（3）构建2112359e、Android preview 1.0.0（1）构建e7eeae3b均FINISHED并下载至根release。Windows打包版30流程、Mac归档/6项Python/9项路径、移动59测试/契约/lint/类型、IPA双目标版本与AppGroup/分发profile、APK内置JS/3本地模块/4架构/签名区块检查通过。真实手机安装、Mac本机及本轮Figma未执行；未上传App Store Connect或发布TestFlight。新增构建说明与验证记录；首次native构建暴露的Gradle版本字段、Kotlin列表泛型、Swift UIKit View注册均已修复。

2026-10-21 打包执行：用户授权 Windows/Mac 桌面包、Android preview APK 与 iOS production，并明确允许上传移动源码至现有 Expo 项目。应用名称 WebAppToFigma、新图标及 com.nariyirm.webapptofigma 平台标识在 app.config.ts 中配置；新增 eas.json，保留 owner/slug/projectId/app.json。Windows 打包 EXE 的30项工作流检查通过；Mac ARM64归档校验、6项Python与9项路径规则通过，不声称Mac本机运行或Apple公证完成。首次Android云编译暴露SDK57本地模块缺少defaultConfig版本字段，已修复并重试。iOS签名由用户在本机配置，production随后提交。最新状态见[打包与TestFlight](BUILD-AND-TESTFLIGHT.md)。此前“不触发构建”属于历史轮次限制，已被本次用户授权覆盖。

2026-10-21 仓库整理：按用户确认，将桌面、Figma 插件和移动端作为一个完整仓库上传 NarIyirm/Web-AppToPrototype，使用根目录 Git/main；移动端原 Git 元数据及53份原暂存索引保存在 `.local-maintenance/mobile-git-before-monorepo`。旧安装包/重复解压目录/测试缓存已清理，最新发布包与历史证据保留本地。详见仓库清理说明；此前“尚未提交/独立仓库/保持原暂存”均为历史阶段记录，不再作为当前 Git 操作约束。

更新时间：2026-10-20，Australia/Sydney。实际目录 E:\WebToPrototype\MobileApp\webapptoprototype；Git 由 E:\WebToPrototype 根仓库统一管理，根工程同时包含桌面和Figma插件。最新SDK为57.0.30 / RN0.86.3 / React19.2.3，按用户明确要求从58降级，见PROGRESS第8节。

## 必读

根AGENTS.md、package.json、app.json→本文件→[PROGRESS](PROGRESS.md)第7–10节→[APP-PLAN](APP-PLAN.md)→[ROADMAP](ROADMAP.md)→[PROTOCOL-DRAFT](PROTOCOL-DRAFT.md)→[DESIGN](DESIGN.md)→[ACCEPTANCE](ACCEPTANCE.md)。用户验证入口：[USER-VERIFICATION](USER-VERIFICATION.md)。

## 用户持续指示

- 直接实施，Android/iOS同等优先；最终手机/Figma验证由用户执行，开发最后给步骤并按反馈修复。只做必要自动检查，不扩展手工UI验收。
- 复用当前工程；用户明确要求SDK58→57，后续按SDK57官方文档/已装类型实现。保留app.json、EAS关联、修改和暂存，不reset、不重建、不force push。
- 手机构建走已有GitHub→Expo官方流程。Android preview APK，iOS用户自有Apple Developer/TestFlight。当前不本地打手机包或触发云构建，不擅建Apple项目/证书。
- 桌面Windows/Mac原范围已获认可，保留简约布局/长页/原生图层，只回归本次受影响代码。
- 最新要求：优先功能和UI可操作性，减少抽象文案与开发说明，只做必要自动检查，手机最终体验由用户反馈。

## 当前实现

2026-10-21 最新安全区反馈：用户截图显示框选 Modal 的标题/按钮覆盖 iPhone 状态栏。共用 SafeAreaModal 现在在原生 Modal 内建立独立 Provider；Screen、自定义 WebWorkspace、诊断页统一使用 SafeAreaSurface，在各自页面根节点测量四边安全区，不沿用窗口外 Provider 或固定机型高度。滚动/WebView 不再叠加自动 inset；补齐详情等无 tab 页底部。src/AGENTS.md 与 lint 限制后续页面绕过共用布局，负向回归覆盖别名导入。verify 的59测试及受控安全区事件下真实 RNWeb 组件九项检查通过，真实 iPhone/Android 测量仍待用户，见 PROGRESS 第16节。Expo Router 已提供应用根 Provider，无需再堆一个根 Provider。无需打包，app.json/EAS/暂存保持，未构建/提交/推送。

2026-10-21 最新反馈修复：用户在 Expo Go 体验中报告框选时整页跟随滚动、选框抖动/偏小。ImageRegionPicker 已改独立全屏原生 Modal，编辑区无 ScrollView，确认/取消后回预览；只在按下取局部起点，后续用固定 pageX/pageY 位移计算，遮罩/边框不可成为触摸目标，单指捕获，取消不改原选区。共用组件同时修复 demo/native 预览，不需新包。58逻辑测试/保持性与真实RNWeb组件五项交互检查通过，iPhone复验待用户，见 PROGRESS 第15节和 USER-VERIFICATION 最新段。不要把此反馈记为全部演示/原生功能验收通过。

2026-10-21 最新：用户想先在 Expo Go 看效果再决定打包，已加“体验采集流程（无需打包）”主入口（系统采集不可用时），指向 /capture/demo。内置示例商店/待办可以浏览详情/勾选，ViewShot 真实截图示例 View → 共用手势预览/裁切 → 真实保存/扫码发送/电脑转换；系统授权与跨 App 采集明确为演示，不伪造原生状态。示例保存为 imported_image，名称/告警标注示例来源，也可换自己的截图。未加依赖或改原生模块/app.json/EAS/暂存，未构建/提交/推送。见 PROGRESS 第14节、USER-VERIFICATION 最新段与父 docs/31。原生采集仍按第13节待安装包验证。

2026-10-21 最新：用户授权落地 App 引导采集。src/app/capture/native.tsx 已改开始/打开目标 App/预览发送，单张默认预览、手势框选、先保存再直传，项目/其他帧/批量按需展开；已有连接直接发，未连接扫码确认后继续发，不自动反复重试。Android 新版原生模块需要悬浮权限，点击按钮后隐藏窗口、读取新帧、保存单张并停止；iOS 用系统广播/停止，原生前后台标记跳过本应用画面、进程锁判断广播存活，返回选最后一张候选。旧包能力门控，Expo Go 保留截图预览。三个 podspec/CNG 的 Swift 语言模式修为5.0。详见父 docs/30 与 PROGRESS 第13节。未触发构建，Android/iOS 原生编译与真机仍待用户；不要把本次57逻辑测试写成原生通过。app.json/EAS/暂存保留。

最新：用户确认上一批验收通过，接着要求完整长/宽网页及手机 App 转换。本批已改横纵网格“一键转换整页”，最高12k每轴/1800万面积/40块/60秒循环，完整行矩形才会保存；旧 LONG_PAGE 纵向实现保留给已通过的底层测试，实际工作台使用 core/web-page.ts。App 页面支持1–5截图、系统帧缩略选择/批次原子保存、可用时手机自动OCR；电脑接收可本机离线OCR/可靠文字转换/校对，Expo Go截图链即可使用。完整说明在父 docs/29；本批检查见 PROGRESS 第12节。真实Mac OCR与Android/iOS原生系统采集尚无本轮安装证据；沿用户Expo构建流程，不主动触发。

2026-10-21 最新：已补手机父级/多选/排除/撤销/清空、有界长页单画面合成；字体族/字重/行高/对齐观察，复杂背景等保留图片。电脑源图/转换预览、图层筛选、指定当前/整批加入项目、热点标记/定位、本地跳转与弹窗试播已接入。使用步骤见 USER-VERIFICATION“本批验证”，实现/边界见 PROGRESS 第11节与父 docs/28。替代下方历史“长页/多选未做”描述；完整复杂样式、内嵌滚动/虚拟列表仍未覆盖。两端真机、真实 Figma 仍待用户。

BASE-01–03通过开发检查；三tab业务、项目/截图/裁切/遮挡/OCR校对、原生WebView采集、alpha.1素材包、桌面2.0兼容导入、扫码HTTPS分块传输和收件箱已编码。Android MediaProjection与iOS ReplayKit广播扩展已接入源码，两端均未取得原生编译/安装/真机证据。

本地模块在 modules/mobile-{vision,screen,transfer}。iOS扩展由 plugins/with-system-capture.cjs 生成，模板在 plugins/ios；不要手工创建根ios/android。生成扩展时必须有用户确定的真实ios.bundleIdentifier，由其推导扩展ID/App Group；当前没有替用户选标识。

源契约在contracts。npm run contract:build生成带SHA清单的contracts/artifacts/0.1.0-alpha.1；桌面只消费packages/mobile-contracts/0.1.0-alpha.1副本，移动不import父项目。修改时重新生成、核对摘要、同步副本和夹具，运行双方检查。

## 检查与保持性

移动运行npm run verify，桌面根运行npm run check，证据在docs/verification。Expo Doctor20/20，autolinking双平台发现三个模块、配置introspection和扩展target合成检查通过，均不能证明Kotlin/Swift编译成功。Windows沙箱HTTP测试可能EACCES，允许测试本机网络后再运行。

没有Android设备/JDK、Mac/Xcode或已签名iOS包证据。53份初始化暂存、用户app.json摘要、owner/projectId/extra.router修改保留。没有commit/push、eas init或触发构建。当前原生模块只能在包含它们的手机安装包验证，Expo Go/Web不能代替。

SDK57额外适配：NativeTabs来自expo-router/unstable-native-tabs；FileHandle.writeBytes同步写入；File.digest改为256KiB流式SHA-256；手机图像先用expo-image有界解码再交ImageManipulator。不要重新加回仅SDK58存在的调用。新增字体/图像/分享/状态栏/浏览器插件在app.config.ts。旧kitchmemo图标URL已用现有图标副本兼容，app.json字节未改。

用户已明确确认更新客户端后能进入App，启动恢复可记user_verified；不要继续围绕旧闪退扩展排查。main仍保留index.js版本检查，不要改成提前执行的静态Router import；项目继续SDK57。

最新功能：Expo Go已新增无需自定义模块的加密LAN扫码发送，原生包保留固定证书TLS。电脑生成w2p-mobile-2 QR（旧字段+lan endpoint/key/id），Expo Go用SDK自带AES-GCM/HKDF对请求/响应加密；仅私网，需电脑确认，2分钟码/15分钟会话，256KiB分块/SHA/素材检查/收件箱复用。详见PROTOCOL-DRAFT。手机wire/client独立，桌面只消费packages/mobile-lan/v2副本；勿让移动依赖父工程。不能将加密HTTP网关误改成明文上传，也不要关闭TLS校验或加全局网络例外。

手机三tab为“添加画面 / 我的项目 / 发送到电脑”。首页突出导截图/开网页；画面和项目可带选中项直接进入发送；扫码为主、粘贴配对信息为备用，显示真实连接/等待确认/发送/重试状态。裁切、OCR、排序、文件导出与删除按需展开，技术探针退出主流程。电脑收件箱打开时自动刷新，网卡名称可见、Wi-Fi优先。用户需重启电脑npm start，手机刷新即可测试，不需本轮EAS构建。扫码/相机/本地网络与真实收件仍待用户反馈；没有把桌面自动测试当手机通过。

## 未完与下一步

视频挑帧、手机长页/多选/排除/父级、复杂CSS/视觉重建、存储回收UI、跨进程恢复和完整异常/性能矩阵未完，见ROADMAP。当前为首个业务alpha，不能称完整发布版。

先按用户安装/链路反馈修复原生编译、权限、坐标、TLS和Figma问题，再补未完子项；无反馈时可继续独立实现。区分development_complete、native_verification_pending、user_verified，不重复BASE，不凭模拟宿主或autolinking将两端/Figma标为通过。
