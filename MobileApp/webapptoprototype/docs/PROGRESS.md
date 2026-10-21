# 移动端进度

2026-10-21 TestFlight最后一步已完成：用户完成1.0.1(5)出口合规问卷；重新读取Apple状态，processingState=VALID、internalState=IN_BETA_TESTING，内部测试已可安装/更新。externalState=READY_FOR_BETA_SUBMISSION，未提交外测审核或公开App Store审核。已更新发布记录和GitHub Release说明，不重新构建或上传同一包。

2026-10-21 新版产物与 GitHub 发布完成：桌面0.1.1 Windows x64 / Mac ARM64、移动1.0.1 Android preview(2) / iOS production(5)全部生成并核验；GitHub Release v0.1.1已公开，9个附件的服务端SHA与本地一致。iOS构建87d30bc9、Android07508fea均FINISHED；iOS提交9ee8e95c已FINISHED，Apple处理VALID，但内外部TestFlight状态MISSING_EXPORT_COMPLIANCE，已提示用户在App 6825243915的1.0.1(5)完成问卷，不能宣称已可测试。桌面166测试/类型/构建、移动64测试/lint/类型、Windows真包30流程、Mac6归档/9路径与实际ZIP检查、IPA双目标/配置、APK实际Manifest/新UI/原生模块/同旧签名证书核验通过。未做Mac原生运行/Developer ID/公证或手机新包真机测试。记录见docs/33-release-0.1.1-mobile-1.0.1.md与docs/verification/2026-10-21-release-0.1.1.json；产物在根release，旧包保留。

2026-10-21 新版发布已获授权：用户要求先同步 GitHub，再发布桌面及移动端，并选择自动上传 iOS 至现有 App Store Connect/TestFlight。桌面版本0.1.1，移动版本1.0.1；Windows包改读取根版本，Android preview自动递增构建号，iOS submit指定现有App 6825243915与团队U57D6BB6H7。此授权覆盖前一轮仅本地验证/暂不推送限制。类型/166桌面测试/构建、移动lint/类型/64测试已通过；正在同步源码和生成四平台产物，结果见docs/33-release-0.1.1-mobile-1.0.1.md。

2026-10-21 移动 UI 本地待验收：用户已确认上一轮采集/拆层验证通过；本轮按用户要求统一蓝色/系统字体/原生符号、三入口说明、项目缩略图/勾选、设备状态与底部固定发送/进度，预览工具及帮助按需展开，保留全部既有传输/采集流程。新增键盘避让，沿用独立安全区与裁切弹窗。lint/类型/64业务测试、7页面多视口浅深色受控UI、9安全区/裁切回归、3采集控件检查及双平台本地JS导出通过；原生键盘/大字体/真实图标仍待手机验证。未留启动服务，用户自行 npm run start:go；未打安装包、云构建、提交或推送，必须等本轮确认。详见移动 DESIGN.md、docs/USER-VERIFICATION.md、docs/verification/2026-10-21-mobile-ui-local-check.json。

2026-10-21 最终打包结果：Windows x64与Mac ARM64包生成；iOS production 1.0.0（3）构建2112359e、Android preview 1.0.0（1）构建e7eeae3b均FINISHED并下载至根release。Windows打包版30流程、Mac归档/6项Python/9项路径、移动59测试/契约/lint/类型、IPA双目标版本与AppGroup/分发profile、APK内置JS/3本地模块/4架构/签名区块检查通过。真实手机安装、Mac本机及本轮Figma未执行；未上传App Store Connect或发布TestFlight。新增构建说明与验证记录；首次native构建暴露的Gradle版本字段、Kotlin列表泛型、Swift UIKit View注册均已修复。

2026-10-21 打包执行：用户授权 Windows/Mac 桌面包、Android preview APK 与 iOS production，并明确允许上传移动源码至现有 Expo 项目。应用名称 WebAppToFigma、新图标及 com.nariyirm.webapptofigma 平台标识在 app.config.ts 中配置；新增 eas.json，保留 owner/slug/projectId/app.json。Windows 打包 EXE 的30项工作流检查通过；Mac ARM64归档校验、6项Python与9项路径规则通过，不声称Mac本机运行或Apple公证完成。首次Android云编译暴露SDK57本地模块缺少defaultConfig版本字段，已修复并重试。iOS签名由用户在本机配置，production随后提交。最新状态见[打包与TestFlight](BUILD-AND-TESTFLIGHT.md)。此前“不触发构建”属于历史轮次限制，已被本次用户授权覆盖。

2026-10-21 仓库整理：按用户确认，将桌面、Figma 插件和移动端作为一个完整仓库上传 NarIyirm/Web-AppToPrototype，使用根目录 Git/main；移动端原 Git 元数据及53份原暂存索引保存在 `.local-maintenance/mobile-git-before-monorepo`。旧安装包/重复解压目录/测试缓存已清理，最新发布包与历史证据保留本地。详见仓库清理说明；此前“尚未提交/独立仓库/保持原暂存”均为历史阶段记录，不再作为当前 Git 操作约束。

更新时间：2026-10-20（Australia/Sydney）。当前阶段：业务alpha源码与桌面集成已实施，原生编译/安装及最终验收待用户执行。第1–5节保留规划轮历史，第7节为当前结果。

## 1. 规划轮基线（历史）

| 项目 | 状态 |
|---|---|
| 用户初始化Expo工程 | 已存在，src/app为模板Home/Explore |
| GitHub关联 | origin已配置，之前只读验证通过；无首次提交/推送，本轮未执行Git写入 |
| Expo/RN | 实装Expo58.0.16、RN0.88.0、React19.3.0；不据版本号推断真机可用 |
| 用户配置 | app.json已有scheme/图标/EAS关联，保留原有工作区修改 |
| 产品与执行计划 | docs文档包已建立；业务功能未实施 |
| 类型检查 | 本轮运行，exit 1；3处模板错误，见下表 |
| lint | 本轮运行，缺配置时明确选择No结束；未完成检查、未安装依赖，不能写为通过 |
| 移动业务/原生模块/传输 | 未实施 |
| iPhone16Pro | 用户已提供机型；实际iOS/签名/安装/系统采集未验证 |
| Android | 设备/系统未提供，尚无真机证据 |
| 手机到电脑四组合/Figma | 未验证，不借用桌面结果 |

## 2. 当前检查失败

运行位置为移动项目根；实际命令：`./node_modules/.bin/tsc.cmd --noEmit`（Windows）与`npm.cmd run lint`。后者进入交互询问，选择No，以保留本轮只写计划的范围。

| 文件 | 诊断 |
|---|---|
| src/components/animated-icon.web.tsx:5 | TS2307：animated-icon.module.css缺类型声明 |
| src/components/app-tabs.web.tsx:38 | TS2322：传入Pressable的ref类型不兼容 |
| src/constants/theme.ts:6 | TS2882：global.css副作用导入缺声明 |

没有将其静默关闭、删除Web平台或用any处理。本轮未修复业务代码；下一开发批次MOB-BASE负责按SDK58建立工程基线。

## 3. 下一项

MOB-BASE-01→02→03→04，然后MOB-00a–e。详见[任务表](ROADMAP.md)。缺少设备/签名时，记录对应平台待测并继续合同、文件/任务、界面和可在当前环境执行的验证；系统采集不可用不应阻挡截图导入，但该能力不能被标完成。

首个可审查结果：工程检查通过，app.json用户配置保持，计划中的核心API已有对应官方SDK依据和探针结果/具体待测条件。

## 4. 2026-10-20 / 计划与新对话交接文档

用户要求生成详细计划供稍后新对话实施。本轮核对已有工程/AGENTS、SDK58文档与当前Git状态，建立产品计划、细分任务、手机原始包/传输草案、页面交互、验收矩阵和可复制续接提示词；原生采集与网页分级，双平台同等优先。父项目首轮方案更新为此目录的入口。

仅增加/编辑文档，未创建采集模块、安装依赖、变更app.json/锁文件/src、启动LAN服务、执行手机权限或修改Git暂存/分支/远端。没有移动端或Figma真实验收。文档/源文件保持性核对的最终结果写入本目录verification，不能把文档检查当运行测试通过。

## 5. 本轮文档收尾核对

8份移动文档、30项首版执行任务已完整建立。合并检查父项目与移动仓库41份Markdown、296个本地链接和代码围栏，无错误；阶段估算合计一致。49份源码/配置/素材与检查前摘要一致，53份初始化暂存内容、分支和origin保持原样，只有README与docs为本轮文档改动。

证据：`docs/verification/2026-10-20-document-check.json`；本机复核命令为父项目根`node .runtime/check-mobile-handoff.mjs`，该临时检查器不作为移动仓库的既有开发命令。类型检查失败和lint未配置如实记录，不计为工程检查通过。没有真机运行、移动业务实施、Git提交或推送。新对话从MOB-BASE开始。

## 6. 后续追加格式

每批记录日期、任务ID、实际改动、命令与退出结果、证据、Android/iOS各自结论、已知问题、下一任务、实际Git提交/推送状态。这里是移动进度唯一入口，任务表摘要应保持一致，历史失败不删除。

## 7. 2026-10-20 / 工程修复与业务alpha

用户已授权直接实施，并明确最终手机/Figma验证由用户执行；本轮不做手机打包、不触发Expo/GitHub构建。Android/iOS同等优先。

| ID | 实际实现 | 状态 |
|---|---|---|
| BASE-01–03 | Git/文件摘要基线；兼容ESLint；CSS声明、Router ref、主题水合修复；严格类型/测试/保持性报告 | development_complete |
| BASE-04 | Web入口曾启动，用自建素材完成项目→导入→真实像素遮挡→重开→导出；之后停止扩展手工验收 | Web开发证据；两端安装待测 |
| 00a / 03a | 原生WebView、受控消息/epoch/预算；视口/元素/矩形截图与基础DOM观察 | 两端native_verification_pending |
| 00b / 04a | Android捆绑中文ML Kit、iOS Vision；真实/未知置信度；文字显式保存校对 | 两端编译/OCR待测；视频未做 |
| 00c / 05A | MediaProjection、系统授权、前台通知停止、原生线程采样、尺寸变化/资源释放 | Android编译/真机待测 |
| 00c / 05I | ReplayKit系统picker、广播扩展、App Group共享帧/方向处理；CNG target/entitlements | iOS编译/签名/真机待测 |
| 01a/b | 三个业务tab；项目、名称/顺序/删除；截图裁切/旋转另存、实际像素遮挡；Web IndexedDB/手机私有文件 | 共享逻辑完成；两端媒体待测 |
| 01c | 双清单恢复、串行写入、SHA资源与限额，不自动回收旧素材 | 部分完成；回收/存储管理待补 |
| 02a/b | alpha.1双Schema/生成校验器、STORE ZIP流式导出、严格离线读取、版本化源码/摘要产物 | development_complete |
| 02c / 04b/c | 桌面读手机包→最终2.0，保留旧1.0；真实来源；基础DOM层；可靠背景清除原字后输出文字，其余保留图片 | 支持子集完成；视觉待用户 |
| 00d / 06a/b/c | 单次2分钟QR、电脑确认、15分钟会话、独立HTTPS端口、原生证书固定、256KiB分块、查询续传、完整SHA/合同检查、持久收件箱 | 桌面自动测试通过；两端TLS/四组合待测 |
| 07 | 手机素材加入既有桌面多状态项目，使用手工热点/跳转/Overlay/关闭弹窗 | 集成检查通过；真实Figma待用户 |

系统采集每3秒一帧、最多20帧/60秒，由原生进程执行，不保存音频。iOS采用ReplayKit兼容入口，没有假定iPhone机型对应某个新系统版本。受保护内容不绕过，黑帧诊断仍需补充。

开发检查与证据（均在docs/verification）：

- 移动`npm run verify`：contract、lint、typecheck、37项测试；`latest-check.json`记录退出码和输出，appJsonUnchanged/indexUnchanged为true、unexpectedChanges为空。
- Expo Doctor：20/20，`2026-10-20-expo-doctor.log`。没有升级SDK。
- 双平台autolinking找到三个本地模块，`2026-10-20-autolinking-{android,ios}.json`，只证明发现模块。
- 配置introspection检查相机说明、Android CAMERA和禁用音频；`2026-10-20-native-config.json`。合成Xcode target测试检查独立entitlements及幂等生成；没有生成根ios/android。
- 旧开发会话停止前输出过FastRefresh异常；干净重启后Android/iOS/Web开发入口JavaScript均编译HTTP200，见`2026-10-20-entry-bundles.json`。不将此当原生编译或冷启动验收；本轮未再做手工UI验证，检查后已停止自建Metro服务。
- 桌面`npm run check`：151项自动测试、类型和桌面/插件编译，`2026-10-20-desktop-check.log`。覆盖TLS指纹/重放/丢回执、混合状态、原字像素清除、旧包/新包及模拟Figma宿主，不能替代真实手机/Figma。
- 自建`synthetic-capture.png`，编辑证据`2026-10-20-capture-editor.jpg`，实际UI导出`2026-10-20-ui-export.w2pm.zip`并由inspect:bundle读取通过。素材均为合成样例。

中途失败保留：初次桌面147/148，HTTP回环被沙箱EACCES拒绝，允许本机网络后通过；传输测试曾因Buffer.slice共享内存导致断言失败，改用独立副本后通过。曾尝试expo export --platform all，在沙箱hermesc临时路径权限处失败；按用户暂不关注打包的指示未继续，不计手机编译成功。

保持性：app.json字节摘要和53份暂存内容保持；owner=gress-26s2，projectId=9b9900b7-a3e1-446a-9352-94547e2143b6。新增能力放app.config.ts/本地模块/config plugin。没有commit/push、eas init、手机构建/发布或全局TLS例外；43821仍仅回环。父工程暂存也未改变。

未完：视频挑帧、手机长页/多选/排除/父级、完整CSS/层叠/复杂视觉重建、资源回收UI、跨进程恢复和性能/故障矩阵。续传限原会话有效且当前待发包仍在页面内；电脑重启需重新授权/发送，成功收件保留。不得标成完整发布版。

用户按[验证步骤](USER-VERIFICATION.md)提供安装/首条链路结果，开发按反馈修复并继续ROADMAP未完子项。打包仍沿用户GitHub→Expo流程，需要安装时再处理真实iOS bundle identifier/App Groups/扩展签名，当前不擅自创建Apple项目。

## 8. 2026-10-20 / 用户要求SDK58降57与图标修复

用户明确要求当前SDK58降为57，并报告Metro找不到assets/kitchmemo-icon.png。本节覆盖第7节中的SDK58当前版本信息，历史检查不删除。

完成：

- 按Expo57.0.30官方npm包bundledNativeModules表，通过expo install对齐现有依赖：RN0.86.3、React/DOM19.2.3、Router57、Reanimated4.5.1、Worklets0.10.1、WebView13.16.1、view-shot5.1.0等；同步package-lock。@types/react19.2与eslint-config-expo57保留在devDependencies，未用force/legacy-peer-deps跳过兼容。
- 适配SDK57没有的API：原生标签入口改unstable-native-tabs；File.digest改为256KiB流式SHA-256，每块后让出JS；FileHandle使用同步writeBytes；图像先用expo-image的maxWidth/maxHeight解码，再通过ImageManipulator单参数SharedRef接口处理，保持4096边限；修正TextStyle类型。
- 动态app.config.ts补Expo57安装工具要求的font/image/sharing/status-bar/web-browser插件。app.json保持字节一致，EAS owner/projectId和暂存未变，未生成根ios/android，未触发手机/云构建、提交或推送。
- 源码/动态配置没有kitchmemo-icon引用，旧请求来源可能为客户端缓存，未断言已定位客户端来源。补assets/kitchmemo-icon.png为现有assets/images/icon.png的相同副本，兼容旧URL且不改变配置中的品牌/图标。清缓存启动后实际素材HTTP请求返回有效PNG/200。

检查：npm run verify（契约/lint/typecheck/40项测试与保持性）通过；expo install --check在线通过；Expo Doctor21/21；npm ls顶层版本正确，锁文件声明匹配且无58版Expo包。Android/iOS/Web入口开发编译均HTTP200；当前/旧图标请求均HTTP200。原生编译/真机仍待用户，不能把开发JS编译写成手机构建。

证据：verification/2026-10-20-sdk57-before.json、sdk57-compatible-versions.json、sdk57-native-config.json、sdk57-dependencies.log、sdk57-expo-doctor.log、sdk57-entry-bundles.json及latest-check.json（文件均带2026-10-20前缀，latest-check除外）。

过程记录：expo install安装依赖完成后因无法自动写动态配置返回1，已显式补插件并用introspection/Doctor核对；npm迁移中曾提示旧19.3依赖peer警告，最终声明和安装树已对齐。一次过早类型检查发生在依赖替换中，不计有效结果；最终类型检查通过。保持性检查还发现前轮业务README改写没有列入允许清单，现将明确授权的SDK文档更新纳入，原有app.json/index守卫继续保持。

用户重开方式：关闭旧Metro终端，在本项目运行npx expo start --clear，再重新打开客户端。若继续反馈原生问题，记录实际SDK57客户端/安装包版本。

## 9. 2026-10-20 / iPhone Expo Go加载JS后闪退反馈

用户补充：iPhone，Expo Go客户端57.0.0，JS下载完成后退出，没有终端红色错误。官方问题[expo/expo#48390](https://github.com/expo/expo/issues/48390)记录了同类无红屏崩溃及Worklets JS/原生版本不匹配；维护者公布修复客户端为iOS57.0.6、Android57.0.3。项目使用的Reanimated4.5.1 / Worklets0.10.1是当前SDK57兼容表版本。旧客户端是目前最有依据的原因，但未拿到本机崩溃栈，不能断言已完成真机修复。

实施：package.main改为index.js，在同步require expo-router/entry之前读取Expo Go版本。只拦已知早期57.0客户端；旧iOS0–5/Android0–2使用基础RN组件显示客户端更新提示，不初始化业务路由、存储、手势或动画库。更新后的客户端和独立构建继续原Expo Router路径；不能将Router改成静态import，否则会先执行依赖。没有修改项目SDK、Reanimated/Worklets版本或压掉兼容检查，也没有用空模块替换动画库。

三个自定义原生模块在Expo Go中跳过查询；原生广播Picker也不注册。根路由增加可恢复JS渲染错误页并显示错误文字/客户端版本，SplashScreen隐藏失败得到处理。这些措施不能捕获SIGSEGV/EXC_BAD_ACCESS等原生进程崩溃。新增npm run start:go使用--go --clear，避免已装expo-dev-client时选错运行目标。

检查：npm run verify通过契约、lint、类型、43项测试，app.json字节与53份暂存内容保持不变。新增启动测试实际执行index.js入口并模拟两平台：旧客户端绝不require Router，新版与独立构建只注册一次Router。iOS/Android/Web的新index.bundle均HTTP200且包含客户端检查/提示组件，见verification/2026-10-20-expo-go-startup-bundles.json；这些不是原生运行证据。完整检查存2026-10-20-expo-go-startup-check.json。检查后停止自建Metro，无手机构建、发布、commit或push。

过程：初次本机HTTP因沙箱EACCES失败；跨沙箱访问随后超时，使用允许本机网络的临时Metro后成功。首轮编译检查以原始中文匹配JS输出而误报提示缺失，实为Babel Unicode转义；核对组件后修正检查并通过。一次只读npm元数据查询因DNS不可用结束，没有改变依赖。

待用户：更新支持SDK57的Expo Go（iOS至少57.0.6），完全退出重开，用npm run start:go重新扫码；确认首屏、三tab、新建项目/导入小截图和重开持久化。旧57.0.0预期显示更新页。如果新客户端仍退出，按实际版本和系统崩溃报告继续定位。详细见USER-VERIFICATION第0节。

## 10. 2026-10-20 / Expo Go局域网扫码发送与简化UI

用户已确认更新客户端后能进入App，启动恢复记user_verified；不再围绕旧闪退扩展检查。用户要求减少文件分享步骤，继续局域网/二维码配对，并明确以功能和UI可操作性为主，简约、直白，最后手机/Figma由其反馈。

实施结果：

- 电脑生成v2 QR，保留原HTTPS身份与一次性码，增加同私网主机的加密LAN端点。Expo Go用现有expo-crypto AES-GCM及HKDF方向密钥直接发送，手机不需自定义传输模块/新构建；包含MobileTransfer的独立包仍走固定证书TLS。未加依赖、未修改app.json/EAS、未绕过TLS或增加全局明文网络许可。
- LAN网关只接受加密信封，绑定方向/配对ID/随机请求ID并拒绝重放。配对、会话令牌、元数据与图片块均加密；复用原电脑确认、2分钟码/15分钟会话、256KiB分块/查询续传、SHA/ZIP合同检查及持久收件。旧v1码在Expo Go提示更新电脑；原生客户端继续兼容旧格式。
- 手机三个入口改为“添加画面 / 我的项目 / 发送到电脑”，配常见图标。导截图与网页为直接入口；画面/项目详情主按钮直接发送且携带已选项。连接页先扫码确认电脑，再显示项目和缩略图复选列表；粘贴配对信息作为折叠备用。显示等待电脑允许、准备、上传进度、收到、暂停/重试与连接中断；错误文案说明下一步。
- 移除主界面的装饰标识和开发探针，裁切/识别/排序/文件导出/删除按需展开；隐藏Expo Go不支持的识别/遮挡主操作。系统录制不可用时简短说明并提供截图入口，不显示一页禁用控制。
- 电脑收件箱打开时自动刷新、保留当前选择；网卡显示名称并优先Wi-Fi，二维码到期隐藏并提示重新生成。手机断开会话在电脑失效；旧连接中断时可重新扫码。原生模块增会话查询/断开白名单，配对确认等待延长；本轮没有原生编译。

开发检查：移动verify通过契约、lint、严格类型、44项逻辑测试及app.json/53份暂存保持性。桌面check通过类型、152项测试与桌面/插件编译。新增单个真实服务集成用例使用与手机相同的LanClient，验证加密配对、完整256KiB块、重放/篡改/Origin拒绝、重复块/查询、真实素材SHA收件及断开；未添加UI快照测试或扩展手工验收。桌面消费packages/mobile-lan/v2独立副本，摘要核对一致。证据：verification/2026-10-20-lan-{desktop-check.log,mobile-check.json,summary.json}。

手机实际扫码/权限/网络与Figma仍由用户执行：重启电脑npm start，刷新手机，按USER-VERIFICATION“先用”段扫码发送。此状态为development_complete、device_feedback_pending，不能把Node crypto适配器测试写成expo-crypto真机运行已通过。没有commit/push、手机本地/云构建或发布。


## 11. 2026-10-21 / 网页采集增强与电脑原型操作

用户明确授权落地建议的第一/第二项。共享手机工作台新增父级、多选、排除、撤销/清空与反馈；多选合并保留相对位置，排除不输出对应图层。导航/滚动/尺寸变化使旧选择失效。底部工具使用固定高度，避免选择信息出现时改变 WebView 尺寸并自行清掉选区。

长页按实际滚动位置分段采集并以现有 fflate 合成单张 PNG，最多12,000 CSS px、20段、45秒循环；读取超时8秒，编码/保存额外耗时。先移除覆盖层，后续段隐藏固定/已经出现的吸顶内容；末段重叠仅拼接新增范围，文字在合并边界被截断时保留像素。单个有界预览缓冲，图像最长4096、10MiB，逻辑坐标不随预览缩小。到上限保存部分并告警；取消不保存新状态；finally恢复原位置/样式。内嵌滚动区、虚拟列表、持续动态页面不保证完整。

网页样式新增可选字体族、字重、行高、对齐。祖先滚动裁切、基础图片/文字/背景读取已加；渐变/阴影/变换/透明叠层/表单等保留图片区域，不伪称全量CSS支持。alpha契约可选字段已生成并同步父packages/mobile-contracts/0.1.0-alpha.1，摘要可核对，旧素材仍能读取。

电脑新增源图/转换预览、当前画面图层分类筛选定位与合并提醒；当前/整批画面入项目时只保留所选画面、有效连线及引用资源。项目增加缩略列表、源参考/转换画面、放大、可见热点/已有连线定位；保存后可试播跳转、打开/关闭弹窗，文字动作按钮可替代小画布点击。预览是浏览器示意，最终字体/字距/复杂效果和真实Figma播放仍由用户检查。

检查：移动verify通过契约、lint、严格类型和48项逻辑测试；appJsonUnchanged/indexUnchanged为true、unexpectedChanges为空。桌面check通过类型、154项测试和桌面/插件构建。独立隐藏Electron在合成页检查真实注入脚本的父级/多选/排除/撤销、双向矩形、长页滚动/固定项隐藏及原样式位置恢复，再检查真实桌面采集→预览→入项目→热点→试播→生成流程；最终运行记录见父.runtime/web-workflow-check.json。本轮未进行手机授权/截图性能或真实Figma验证，Android/iOS均device_feedback_pending。

过程问题：首次手机新增测试因Node strip-only不支持参数属性失败，已改显式字段；桌面测试首次三项本机网络被沙箱EACCES拦截，允许本机回环后通过；最小窗口检查发现画布挤入面板内边距，已加max-width。没有改app.json/EAS/锁文件或暂存，没有提交、推送或手机构建。用户步骤见USER-VERIFICATION“本批验证”，完整边界在父docs/28。


## 12. 2026-10-21 / 二维整页与 App 转换

用户确认上一批验收通过，继续要求覆盖长/宽整页及手机App转换。共享工作台已改横纵网格“一键转换整页”，实际滚动位置映射到不重叠分块；末块夹紧、跨块文字保留像素，结束/取消恢复样式与原位置。上限每轴12k、1800万逻辑面积、40块、60秒循环，预览400万像素/4096边/10MiB。仅保存完整行矩形，不以空洞画面冒充完整结果；尺寸增长/达到预算有提示。旧web-long-page保留PNG/旧已验收逻辑，实际使用core/web-page。电脑增加整页按钮、横向加载DOM范围和宽度变化检测，宽最多12k，不拉宽视口重排。

App页面支持1–5截图、批内去重、项目选择/新建和整体保存；系统帧缩略勾选、停止后批量整理，写入成功后才删除源帧。原生Vision可用时自动识别，无模块/失败则交电脑。Expo Go截图链不需新构建；系统录制仍需含既有MediaProjection/ReplayKit模块的安装包，本轮无原生编译/签名证据。

电脑接手机图片后调用Windows.Media.Ocr / macOS JXA Vision，无网络/模型下载/Swift编译器依赖；45秒超时、500行/10万字预算与坐标校验，失败保留图片，取消不替换旧成功结果。只有可靠背景去字后输出TEXT并采样原字颜色，其余保留图片。结果页可校对文字并保存，再加入原型项目。素材契约本轮未改。

检查：移动verify通过契约/lint/类型/51测试、app.json与53份暂存保持；桌面类型/159测试/构建通过。独立隐藏Electron合成宽长网页覆盖右侧/底部与二维拼接，自建截图走真实Windows OCR→可靠文字/颜色→校对→项目生成；识别2行，可靠1行转TEXT，另1行保留图片。Mac桥仅模拟坐标逻辑，未在Mac执行；两端手机二维截图/系统录制及真实Figma由用户反馈。

过程：WinRT在沙箱拒绝读取，允许本机后成功；合成宽页断言因自身文字换行失败，固定测试容器宽度后通过；OCR初次不当地要求所有识别行转TEXT，已按背景规则检查。Mac最初拟用Swift辅助，最终改为JXA；仅本轮生成的旧辅助已删除。证据父evidence/2026-10-21/MOB-whole-page-app与verification/2026-10-21-whole-page-app-check.json。未新增依赖、改app.json/EAS/暂存或触发构建/提交/推送。用户步骤见USER-VERIFICATION最新一节及父docs/29。

## 13. 2026-10-21 / App 引导采集、手势预览与直接发送

用户授权落地上一轮讨论的流程：开始时说明状态与操作，进入目标 App 定位，采集后返回预览并发送。共享 native 路由现在默认一个画面，顶部三步反馈；项目更换、其他帧与批量按需展开。从相册导入单张也直接预览，ImageRegionPicker 支持反向拖动/边界夹紧的像素框选和精确输入，裁切只修改实际输出副本。

Android modules/mobile-screen 增 SYSTEM_ALERT_WINDOW 权限/设置入口、可拖动悬浮按钮、当前页单帧采集。按钮隐藏、丢弃旧缓冲、同一 VirtualDisplay 恢复输出，等待新帧；4 秒无新帧提示重试，不发旧缓冲；输出后停止共享。取消/返回本应用/系统停止阻止后续保存，服务最长60秒。通知可返回原采集路由；通知未获系统许可时手动返回。保留旧系统 API 分支和工作线程资源释放。

iOS 扩展与 MobileScreen 的原生前后台文件标记跳过本应用/1.2秒切换；系统停止后选本次最后候选，保留其他帧选择。每约3秒候选、最长60秒，当前会话可在总20帧预算内滚动替换自己的旧候选，未自动删其他会话素材。App Group 中 flock 进程锁区分暂停/退出/崩溃，旧JSON不是唯一存活依据。iPhone没有在其他 App 里显示自定义按钮的能力，继续使用公开系统广播/停止入口。旧原生模块通过 guidedCapture 门控，不调用新增 API；Expo Go 保留截图路径。

先保存项目，后删所选源帧，清理失败仍可发送。相同画面/选区/项目返回后复用保存回执。新 direct-send 内存请求绑定项目/画面集合、一次性、15分钟/最多8个，只有实际点击发送产生，外部深链不能授权上传。Connect 已连接则核实连接后发送；未连接则扫码确认后继续，失败需主动重试；常规旧入口继续手动发送。React19.2 Effect Event 读取当前发送操作，开发 Strict Mode 重放不重复消费请求；隐藏路由暂停采集轮询。电脑收件/转换/Figma回执继续区分。

修正三个自定义模块 podspec 与 CNG 扩展的 Swift 语言模式5.9→5.0，保留现有Swift5兼容代码而非使用工具链版本作为语言模式。未新增依赖、改SDK/app.json/EAS/锁文件/暂存或触发构建/提交/推送。CNG通过现有插件生成，没有创建根ios/android目录。

检查：npm run verify 通过素材契约、lint、严格类型、57项逻辑测试和app.json/53份暂存保持性。新增 tests/app-capture 覆盖新会话不回退旧图、恢复顺序、框选反向/越界/微动/非有限值；tests/send-request 覆盖外部链接、项目/集合、一次性、过期、数量预算；native-config核对合法Swift语言模式。初轮lint拒绝effect同步setState、随后拒绝EffectEvent引用后声明函数，已按异步加载/声明顺序修正并通过，不关闭规则。

证据：verification/2026-10-21-guided-app-capture-check.json，父 evidence/2026-10-21/MOB-guided-app-capture。未进行Android/iOS原生编译、系统权限/悬浮/ReplayKit、手机手势/直传或真实Figma；这些保持native_verification_pending，由用户按USER-VERIFICATION最新段反馈。桌面代码/协议未改变，不重跑已接受桌面范围。当前可运行命令仍为npm run start:go（截图预览与发送）、npm run verify；实际系统采集待用户之后沿已有GitHub→Expo安装包流程，未替其选Apple标识或触发构建。详细说明父docs/30。

## 14. 2026-10-21 / Expo Go 先体验 App 采集

用户想在Expo Go先看效果再决定打包。系统采集不可用/未配置的App入口新增“体验采集流程（无需打包）”，不再只提供相册。src/app/capture/demo.tsx按开始指引→浏览示例App→预览发送组织；src/features/capture/example-app.tsx提供商店首页/商品详情、待办列表/任务详情，支持进入/返回详情和勾选。示例名称与画面始终标注内置示例，不读取已安装应用或伪造系统授权。

用户点击iPhone“模拟停止并返回预览”/Android“采集当前示例页”，用已装react-native-view-shot5.1.0真实截图示例View，再用既有normalizeImage/私有存储、ImageRegionPicker手势裁切、先保存后发送流程；临时截图finally释放。已连接直接发送，未连接扫码确认后继续，发送失败可重试；也可先保存或换自己的App截图。重复发送相同选区/项目复用保存回执。示例保存sourceKind=imported_image，名称“流程演示·…”，告警明确没有跨App采集；不增加素材字段或改协议。未动原生模块、app.json/EAS/SDK/锁文件/暂存，未新增依赖或触发构建/提交/推送。

检查npm run verify：契约、lint、typecheck、既有57项逻辑测试及app.json/53份暂存保持性通过。首轮lint把普通操作函数useOwnScreenshot识别为Hook，已改名chooseOwnScreenshot，没有屏蔽规则。Expo SDK57官方captureRef文档及已装5.1.0实现确认API/Go内置；未将此检查记作手机ViewShot/手势/扫码成功。该批是可逆UI与复用链路，不新增镜像实现的测试或扩大旧桌面验收。

证据docs/verification/2026-10-21-expo-go-demo-check.json及父evidence/2026-10-21/MOB-expo-go-demo。真实Expo Go操作和电脑转换效果由用户按USER-VERIFICATION最新段反馈；原生MOB-05状态仍native_verification_pending，本体验不能代替ReplayKit/MediaProjection/签名/权限真机验证。启动仍npm run start:go，当前不需构建；详细边界见父docs/31。

## 15. 2026-10-21 / MOB-UI-01 框选滚动冲突修复

用户在Expo Go体验后报告：预览框选时整屏移动，选框不稳定且偏小。代码中原先在Screen的ScrollView里用触摸locationX/Y直接更新选区；外层滚动与手势争用，遮罩出现时触摸相对元素也可能变化。用户反馈只证明到达该步骤，不记整条体验或原生能力已验收。

共用src/features/capture/image-region-picker.tsx改独立全屏RN Modal，SafeArea顶部固定取消/完成、底部尺寸/重置，编辑区没有ScrollView。原预览只展示选区；打开时复制草稿、拖动只改草稿，完成才应用，取消/Android系统返回保留原选区。编辑图按可用空间放大，遮罩/图片不接收触摸，固定box-only/不可折叠画布接收单指，拒绝中途交出，尺寸变化重建手势起点。精确输入移到主预览按需展开，避免编辑区出现字段后改变图片布局。

src/core/app-capture.ts新增dragRegionFromPage：仅在按下时读取局部坐标，后续使用pageX/pageY相对固定起点的位移，松手保留最后范围，越界/反向/微动沿用原像素映射。tests/app-capture新增不同Modal偏移仍输出同一选区及大幅反向拖动回归。演示/native两页共用该组件，无需分别切换父ScrollView的挂载状态，也不需新安装包。

检查：npm run verify通过契约/lint/严格类型/58项逻辑测试及app.json、53份暂存保持性。单个隐藏独立Electron检查实际组件和RNWeb Modal/responder：拖180×260逻辑点时选框尺寸匹配，编辑时外层滚动不变，完成才提交，取消保留原值，关闭后恢复滚动，五项通过。只替换image/safe-area/router平台端口，不是iPhone原生测试；实际保存区域为792×1144像素（源1200×2400）。本轮未重复旧桌面/传输/原生采集验收。

证据父.runtime/crop-modal-check/result.json、crop-modal.png，归档evidence/2026-10-21/MOB-crop-gesture及verification/2026-10-21-crop-gesture-check.json。检查夹具最初在沙箱不能启动Electron；获准本机检查后，首版夹具误将Electron包绝对路径作为运行时模块导致超时，改为内置electron后通过，非产品错误。检查实例完成后关闭，没有更改用户应用数据。

状态development_complete_user_verification_pending：请用户刷新Expo Go，正反方向框选、完成后滚动、重画后取消，再按需发电脑检查裁切范围。原生MOB-05保持待安装包验证。没有新增依赖、原生模块/SDK/app.json/EAS/锁文件/暂存改动，没有构建、提交或推送。实际命令npm run verify；局部UI夹具在父目录运行node .runtime/check-crop-modal.mjs（本机Electron可能需沙箱外权限）。

## 16. 2026-10-21 / MOB-UI-02 全局安全区统一

用户截图显示框选 Modal 的取消/标题/完成与 iPhone 时间、信号、电量重叠。此前 SafeAreaView 在原生 Modal 内但 Provider 仍在外面的原生视图树；已装 safe-area-context 5.7.0 的 Fabric 实现按 native superview 寻找最近 Provider，不会跨 Modal 自动找到 React 父级。Expo Router 57 已在 ExpoRoot 设置应用根 Provider，因此在 RootLayout 再堆 Provider 不能修复独立窗口。按 SDK57 官方 safe-area-context 文档及已装实现处理。

新增 src/ui/safe-area.tsx：SafeAreaSurface 在每个页面根测量 Provider + 原生 SafeAreaView 四边，SafeAreaModal 将该边界放进 Modal 内。没有缓存 initialWindowMetrics 或写死 iPhone 高度。共用 Screen（加载/错误/三 tab/项目/画面详情/体验/原生采集页）、自定义 WebView 工作台、旧诊断页统一使用；无效网页地址改走 Screen，防错误页遗漏。补无 tab 页底部系统手势区；tab 场景按已经在 tab bar 上方的实际 frame 测量，不再额外预留一份底部。Screen/诊断 ScrollView 与 WebView 明确关闭二次自动 inset，保留独立 WebView 截图 frame 和原框选草稿/坐标/无滚动交互。

src/AGENTS.md 规定新路由入口与独立 Modal 边界、禁止固定状态栏尺寸/重复 inset。eslint.config.js 限制业务源码直接导入 RN Modal、RN SafeAreaView 或 safe-area-context API，统一收口到 UI 文件；tests/safe-area.test.ts 用负向夹具验证别名 Modal、旧 SafeAreaView、直接 Provider 等都会报错，共用入口可通过。该约束降低同类遗漏，不能保证未来任意新增代码绝无布局问题。

检查 npm run verify：契约/lint/typecheck/59测试通过，app.json 摘要、53份暂存及其他基线文件保持。额外一次隐藏独立 Electron 对实际 Screen/Picker/Modal 和已装 SafeAreaProvider、context、SafeAreaView.web 进行九项检查：普通页顶部、tab 无重复底部、独立 Modal 59/34、横屏左右59/底21、重开顶部62、无 tab 底部、拖动尺寸/滚动隔离、完成/取消、关闭恢复滚动。工具栏 y=59、底部结束于900−34；横屏左右各59。原生测量桥以受控事件替换，图片/router 端口替换，**未替换安全区 JS 实现为普通 View**，也不作为 UIKit/Android 测量成功证据。原旧 crop 夹具仅兼容新增 Provider 导出，新的检查覆盖其手势项。

证据 docs/verification/2026-10-21-safe-area-check.json 与父 evidence/2026-10-21/MOB-safe-area；本地夹具 node .runtime/check-safe-area.mjs（Windows 沙箱不能启动隐藏 Electron 时需本机执行权限，本轮已获准完成，窗口已关闭）。文档记录官方来源 https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/ 。

状态 development_complete_user_verification_pending：用户刷新 Expo Go 检查框选顶部/底部和其他页面，有条件时检查横屏及 Android 系统栏；见 USER-VERIFICATION 最新段。无需新包，没有 SDK/依赖/锁文件/原生模块/app.json/EAS/暂存改动，未构建/提交/推送。真实两端和 Figma 仍由用户验证。

## 2026-10-21 / iPhone 独立包局域网连接

2026-10-21 iPhone 局域网修复：用户确认本地网络开关已开启。原正式包优先走原生固定证书 HTTPS，Expo Go 走 v2 AES-GCM 认证加密通道，且连接失败提示错误地一律建议开启权限。现 iOS 对 v2 二维码统一使用既有加密通道，配对/状态/文件分块保持同一连接；不因失败跨通道重试，保留旧版与 Android 固定证书支持。移动 64 项测试、契约/lint/类型及电脑真实接收器的加密配对/大分块/续传/重放与篡改拒绝/断连测试通过。build3 IPA 已有本地网络用途说明和 NSAllowsLocalNetworking，非缺少声明。具体旧原生链路失败原因尚无手机原始错误证明；修复包 iOS production 1.0.0（4）构建 e638f6f8-c197-4493-8a48-ccd52cb2a542 已 FINISHED，已下载至 release/WebAppToFigma-1.0.0-ios-production-4.ipa；IPA CRC、双目标版本/标识/App Group/分发描述文件、内置修复函数与本地网络声明核对通过。未自动提交 App Store Connect，真机复验仍待用户。

## 2026-10-21 / App 采集入口及可编辑拆层，本地验收

2026-10-21 本地待用户验收：用户已确认 iPhone build4 局域网连接恢复，反馈系统采集按钮空白、App 转 Figma 只有整图。ReplayKit 控件改非零 64 点初始化/布局、明确入口和控制中心指引；Go 明确不能真实跨 App 录屏。桌面新增截图重建：可靠 OCR 文本、原生背景/基础控件、局部图案及透明度保留。实际反馈图按电脑 2000px OCR 流程，旧版 0 Text/1整图，新版20 Text/36局部图像；字体/内容需校对，非原组件树恢复。166桌面测试/类型/构建、64移动测试/契约/lint/类型、JS入口3项、合成Figma宿主原生Text/Rectangle可修改检查通过。UIKit/真实Figma待用户。用户明确要求先 Expo Go 本地验证，未打包/云构建/提交/推送，后续必须等用户确认。Metro 8082、本地新版桌面使用独立 .runtime/local-user-test-2026-10-21 测试目录；旧安装包已正常退出，原项目数据未修改。详见 docs/32-mobile-app-editable-local-test.md 和移动 verification/2026-10-21-app-capture-layers-local-check.json。
