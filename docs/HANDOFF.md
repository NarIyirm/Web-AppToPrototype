# 续接说明

2026-10-21 最终打包结果：Windows x64与Mac ARM64包生成；iOS production 1.0.0（3）构建2112359e、Android preview 1.0.0（1）构建e7eeae3b均FINISHED并下载至根release。Windows打包版30流程、Mac归档/6项Python/9项路径、移动59测试/契约/lint/类型、IPA双目标版本与AppGroup/分发profile、APK内置JS/3本地模块/4架构/签名区块检查通过。真实手机安装、Mac本机及本轮Figma未执行；未上传App Store Connect或发布TestFlight。新增构建说明与验证记录；首次native构建暴露的Gradle版本字段、Kotlin列表泛型、Swift UIKit View注册均已修复。

2026-10-21 本次打包：Windows x64与Mac ARM64最新ZIP已生成，路径见release/latest-*.json。Windows真实打包EXE的30项流程、Mac归档结构及准备脚本检查通过；移动应用命名WebAppToFigma，新logo与EAS profile已接入，用户已授权并执行云构建。手机包进度与ASC/TestFlight步骤见[移动构建说明](../MobileApp/webapptoprototype/docs/BUILD-AND-TESTFLIGHT.md)。真实Mac/手机/Figma结果仍需实际设备验证。

2026-10-21 仓库整理：按用户确认，将桌面、Figma 插件和移动端作为一个完整仓库上传 NarIyirm/Web-AppToPrototype，使用根目录 Git/main；移动端原 Git 元数据及53份原暂存索引保存在 `.local-maintenance/mobile-git-before-monorepo`。旧安装包/重复解压目录/测试缓存已清理，最新发布包与历史证据保留本地。详见仓库清理说明；此前“尚未提交/独立仓库/保持原暂存”均为历史阶段记录，不再作为当前 Git 操作约束。

最新（2026-10-21）：用户截图反馈 iPhone 框选标题栏与状态栏重叠。移动端新增共用 SafeAreaSurface/SafeAreaModal，在每个页面/原生 Modal 内测量安全区，覆盖 Screen、网页工作台、诊断页及底部操作；新增 src/AGENTS.md/lint 防绕过约束。59测试、保持性和受控安全区事件下 RNWeb 九项检查通过，真实 iPhone/Android 复验待用户；详见移动 PROGRESS 第16节/USER-VERIFICATION 和 evidence/2026-10-21/MOB-safe-area。纯 JS，无需打包，未改变 app.json/EAS/暂存，未构建/提交/推送。

最新（2026-10-21）：用户反馈 Expo Go 预览框选时整页移动、选框抖动/偏小，已修共用 ImageRegionPicker：独立全屏原生 Modal、无滚动编辑区、固定根坐标位移、确认/取消草稿语义。58逻辑测试与实际 RNWeb 组件五项交互检查通过，iPhone复验待用户。详见移动 PROGRESS 第15节/USER-VERIFICATION 最新段与 evidence/2026-10-21/MOB-crop-gesture。无依赖/原生/配置改动或构建/提交。

最新（2026-10-21）：用户希望先用 Expo Go 看采集效果再决定打包。已新增明确标注的内置示例体验：手机 App 转换入口 →“体验采集流程（无需打包）”→ 浏览示例商店/待办 → 真实截图示例 → 共用预览/框选/真实保存与发送。可换自己的截图，示例按 imported_image 标记来源，不声称 Expo Go 真能跨 App。详见 [体验说明](31-expo-go-capture-demo.md)、移动 USER-VERIFICATION 和 PROGRESS 第14节。没有原生改动/新依赖/构建/提交/推送；系统采集仍待安装包验证。

最新（2026-10-21）：用户授权落地 App 采集指引与简化流程。手机已改开始/打开目标 App/预览发送，单张默认、手势裁切、已有连接直接发送/未连接配对后继续发送；Android 悬浮按钮触发单帧并结束，iOS 系统广播+系统停止、返回预览，主应用画面跳过。新原生能力门控，Expo Go 可先走截图导入。原生源码/Swift语言模式已改，未运行 Kotlin/Swift 编译/系统授权或真机；57逻辑测试与保持性通过，详见 [本次说明](30-guided-app-capture.md) 和移动 PROGRESS 第13节。未修改桌面代码/素材协议，未触发构建或提交推送。

最新（2026-10-21）：用户已确认上一批验收通过，随后要求整页同时处理长/宽并继续手机 App 转换。手机改二维分块整页合成、电脑补整页快捷入口并读取横向加载布局；App 页面可批量导入截图/选择系统帧，手机原生 OCR 可用时自动识别，电脑接收后以 Windows OCR / macOS JXA Vision 离线识别并保守替换文字。结果支持文字校对。见 [本批步骤与边界](29-whole-page-and-app-conversion.md)。Windows 合成图真实 OCR/文字校对/项目生成已走通，Mac 引擎和两端手机最终结果待用户；系统录制仍需含已有模块的安装包。未触发构建或提交推送，保留 app.json/EAS/暂存。

最新（2026-10-21）：用户授权继续第一/第二项，已实现手机父级/多选/排除/撤销、有界单画面长页、常见样式与图片降级；电脑源图/转换预览、图层筛选、当前/整批加入项目、热点标记/定位、跳转与弹窗本地试播。见 [本批说明与用户步骤](28-mobile-web-and-prototype.md)。移动素材契约增加可选字体字段，已重新生成并同步桌面版本化副本；不要拿旧桌面消费新字段。手机/Figma 最终结果仍由用户反馈，不将本地合成检查记为真机通过。未改变 app.json/EAS、未触发手机构建或提交推送。

最新（2026-10-20）：用户已自行解决 E_PACKAGE_INVALID，本轮仅调整桌面右侧 UI，不再处理该协议问题。已改为固定 Figma/手机连接栏、四个任务页签、按任务切换的底部操作；手机配对和手机收件分开。当前使用见 [工作台说明](27-desktop-workbench-layout.md)。类型/构建通过，隐藏独立实例的四页签、连接展开及最小窗口检查通过；最终手机与真实 Figma 操作由用户执行。本段覆盖下方历史两页签与“仅规划/未授权实施”的旧状态；移动实施进展以 [移动 HANDOFF](../MobileApp/webapptoprototype/docs/HANDOFF.md) 为准。未触发 Expo 构建，未提交或推送。

移动端新对话入口已完成（2026-10-20）：用户要求完整计划供新会话实际开发，文档已放入独立Expo仓库[docs目录](../MobileApp/webapptoprototype/docs/README.md)。先读[移动HANDOFF](../MobileApp/webapptoprototype/docs/HANDOFF.md)与PROGRESS，再按ROADMAP从MOB-BASE修模板/配置开始，不再只读父项目旧计划或新建apps/mobile。完整产品计划、协议草案、页面交互、验收矩阵和可复制新对话提示词均在仓库内。当前仅文档工作，业务未实施；本轮未提交/推送。

2026-10-20用户已自行初始化Expo工程：MobileApp/webapptoprototype（Expo58.0.16，RN0.88.0，独立嵌套Git仓库，适用其AGENTS.md），后续移动端工作应复用它，不按旧计划再创建apps/mobile。已按用户要求将其origin设为https://github.com/NarIyirm/Web-AppToPrototype.git，并配置仅该项目使用现有gh凭据；正常权限下确认是NarIyirm私有空仓库，远端默认main，可访问。尚无本地commit或推送，当前本地master，53份初始化文件已由原初始化过程暂存，用户app.json另有未暂存改动，全部保留。类型检查发现模板CSS声明/Pressable ref共3处错误；lint因缺配置自动尝试安装已中止，新增两项依赖已撤回。不要把Git关联完成当作移动功能已实现。

移动端最新（2026-10-20）：用户要求网页+其他原生App，并明确“Expo通用框架，就不需要安卓优先”。Android/iOS同等优先，覆盖历史优先级；已提供iPhone16Pro，系统版本未提供、Android设备待确认。详细计划已完成：[docs/25](25-mobile-web-and-native-plan.md)。当前只授权规划，尚未实施。下一项MOB-00需同时验证两端WebView/OCR、跨App系统采集和扫码TLS传输；网页结构重建与原生像素推断分开验收。iOS当前官方ScreenCaptureKit样例要求iOS27，实际设备/SDK可用性先探针，旧ReplayKit路线另查，不假设已可用。现协议source.kind固定web/1.0，原生来源需规划兼容扩展，不能伪装web输入旧插件。桌面整体已接受，不重验旧范围。

最新用户确认（2026-10-20）：“现在桌面端的都没问题了”。桌面端整体使用验收通过，BUG-003 closed / user_verified；历史Mac专项技术证据缺失不补造，不重复要求旧范围验收。当前仅讨论Expo Android/iOS移动端与手机到电脑传输，尚未授权具体实施方案，Android既有优先级保留。

最新BUG-003：Mac用户运行旧Prepare Mac.command只输出“请指定 WebToPrototype.app。”，签名尚未开始。已修复入口仅接受同目录的问题：支持已移入Applications的副本/显式路径，歧义或残缺停止，打印目标、保留日志并单独评估spctl。6项归档/9项Bash路径/5脚本语法通过；Mac实机签名、Gatekeeper和启动仍待复验，不能宣称损坏已解除。见[本次记录](24-macos-prepare-troubleshooting.md)及latest-macos-arm64.json；原候选与历史Windows结果保留。

更新时间：2026-10-20｜项目目录：`E:\WebToPrototype`。

## 1. 给下一次会话的最小上下文

最新：用户授权Mac端并指定Apple Silicon（M系列），续接已通过141自动测试、两套类型/构建、6项Python归档检查，以及Windows文字28/完整流程29/平台命令4项。M系列.app ZIP开发候选已生成，latest-macos-arm64.json定位实际包/摘要，归档保留权限、14个Framework链接并核验CPU/全文件/当前构建一致性。native签名准备脚本由内向外签名并递归校验，Mac DMG脚本已准备但未在Windows执行。当前无真实Mac运行/签名/公证或Figma证据，MAC01–08待Mac。不得把结构检查/模拟生命周期计成Mac已验证。先读docs/22–23与PROGRESS末尾，旧Windows基线与原生可编辑层保留。前次额度中断为历史，当前不再阻塞开发检查。

最新反馈BUG-002：用户报告capture-send的E_LAYOUT_CHANGED，确认发生于“整个页面”。本地滚动位置文字可复现：全页快照读取后生成参考/恢复滚动使contentRevision变化，旧代码误拒绝已读取场景。已修复为保留快照、停止不匹配后续参考并给W_PAGE_CHANGED_AFTER_SNAPSHOT；真实窗口/缩放/选择变化、导航/取消/虚拟列表仍中止。134自动测试、新增smoke:layout-changes10项、全页29项通过；修复版分发/直连最终记录见PROGRESS末尾。开发修复待用户复验，不回退m2.4以前已接受结果。

Windows首版0.1.0候选 / converter desktop-1.0 / adapter web-dom-2 / Schema1.0.0。用户授权补齐首版剩余开发，并指定只用本地验证。多状态与原生原型、历史/视口/会话、有限Auto Layout、WebP/GIF、开放组件、ZIP、队列/分块/日志和Windows分发均已实施。最终真实Figma仍由用户执行；m2.4及此前user_accepted保持，m2.5–m2.9及REL01–REL06不冒充通过。

先读[Mac使用](22-macos-release-guide.md)、[Mac验证](23-macos-verification.md)、[PROGRESS](PROGRESS.md)、[Windows使用](20-desktop-release-guide.md)、[发布检查](21-desktop-release-verification.md)、[用户结果](USER-TEST-RESULTS.md)与根DESIGN.md。本批新功能已做本地开发检查，不再领取“多状态/ZIP/安装包未实施”的历史候选。

保留原简约工作台、两页签、352/304px面板、1000×650最小窗口及长页内容；新项目/设置在折叠区。新本地 /fixture-prototype 是列表→详情→弹窗→返回，/fixture-auth 是独立会话保护图片；旧视觉页继续保留。地址栏可访问公网HTTPS，本轮用户指定只用本地验证，没有新公网登录测试。

关键实现：project.ts保存不可变状态、重命名/排序/删除与手工连线；storage.ts原子项目/20条历史；workflow-ui.ts折叠操作；composed.ts开放ShadowRoot/slot；layouts.ts可靠Flex可选映射；raster.ts沙盒解码WebP/GIF；logging.ts有界日志。contracts/archive.ts支持真实Store/Deflate ZIP与资源校验；encoding.ts支持插件运行时。bridge.ts有界FIFO最多5个/100MiB、单个导入、256KiB分块/逐块整包SHA和30秒租约，8秒心跳失联保守中断。主协议不变，新增auto-layout能力，旧包可读；旧插件需关闭重开。

Windows分发通过package:windows生成完整Electron运行时、应用与独立FigmaPlugin、按用户安装脚本、文档和SHA清单；release/latest-windows.json定位最新ZIP。开发源文件仍在本地未提交，不虚构commit/tag/远程。生成目录和失败证据保留，不删除用户包/项目。

检查：134项自动测试、类型/构建；100次真实本地采集，历史有界；20次实际插件主逻辑使用模拟宿主；真实安装副本在空cwd/无Node/npm PATH下运行完整本地流程。详细次数、路径、分发摘要以docs/21最终表为准。模拟Figma不能证明真实字体、Auto Layout、Overlay和Undo行为。

下一步仅按用户REL01–REL06和m2.5–m2.9反馈修问题，记录真实Figma报告/截图；m2.4及此前不重验。用户验收前保持verification_pending，不把“继续”当通过。Android、自动发现业务逻辑、云端/商店/签名及所有CSS兼容不属本次首版，现有不支持项按告警边界交付。不得访问用户生产账户补测试。

预算继续：5000节点、20状态、单包50MiB、资源总30MiB/单图10MiB/4096px；全页30k CSS px/30步/30秒准备/90秒总任务，取消恢复/旧成功包保护；源参考2048边长、最多12段/32MiB。项目含预览128MiB、预览64MiB，历史20条/256MiB，日志3×约1MiB。ZIP≤64MiB、展开≤64MiB、条目≤5001，拒绝ZIP64/加密/多卷/未知路径；不解压至任意路径。

以下后半部分是跨会话维护规则；旧批次详细实现和证据按日期保存在PROGRESS，不覆盖为本批新结果。

## 2. 必读顺序

1. [当前进度](PROGRESS.md)：读取最后完成的任务、验证和下一步。
2. [任务表](06-roadmap-and-backlog.md)：只领取依赖已满足的任务。
3. [决策](07-decisions-risks-and-sources.md)：区分用户确认与技术建议。
4. 开发采集读 [算法规格](03-capture-and-conversion.md)；开发导入/桥接读 [协议](04-data-and-bridge-protocol.md)。
5. 完成前对照 [验收](05-validation-and-reliability.md)；整体目标见 [产品范围](01-product-and-acceptance.md)。

有文件名或接口变更时，以最新文档版本和实际代码为准；发现冲突先修复契约/记录，不靠推测静默选择一边。

## 3. 可以复制给开发会话的任务描述

> 请继续E:\WebToPrototype，先读HANDOFF、PROGRESS、USER-TEST-RESULTS、DESIGN及docs/20–21。Windows首版0.1.0剩余开发已补齐并做本地开发检查，多状态/手工原型、ZIP、历史/设置、兼容子集和独立分发已实施。m2.4及此前已整体通过，无需重复；新范围最终Figma由我执行，按REL或TXT/LYR/SVG/FRM/SHD编号、包和实际报告修反馈。只用本地验证，保留原布局、图层、长页和预算/恢复。Android、签名、自动探索和完整CSS兼容不属当前范围；不将继续开发当作验收通过。

这是用户可复制的续接文本，不是已向其他聊天发送的消息，也不自动授权创建新聊天或改动外部服务。

## 4. 每次开发开始

- 读取当前仓库与适用 AGENTS.md；有 Git 时先检查状态，保留用户未提交修改。
- 比对 PROGRESS 与代码/构建产物/证据，发现状态错误立即纠正。
- 确定本次任务 ID、依赖、预期结果和验证方式。
- 对未知外部条件先进行必要只读检查；只在缺失信息真正阻塞时向用户说明。
- 若执行 M0，具体依赖版本先查官方兼容说明再锁定；不要把本机 Node 当作 Electron 内嵌运行时。

## 5. 每次开发结束必须写入

在 PROGRESS 追加日期与本次任务：

1. 改动文件及其作用。
2. 已运行的命令、测试和实际结果；没有运行的明确写未运行。
3. 真实证据目录、Figma 目标/节点引用或导入报告；敏感链接按需要本地保留。
4. 当前任务状态、剩余问题、错误码、复现步骤与解除条件。
5. 下一项最小可执行任务和依赖。
6. 真实可运行的启动/测试/打包命令。命令尚不存在就写“尚未建立”，不复制计划命令冒充可用。
7. 已创建的 Git commit/tag；未创建就如实写未提交。

完成实施任务时勾选 docs/06 对应行；重大决定追加 ADR；协议变化同时改 docs/04、示例、Schema/类型和兼容测试。失败不删除原记录，追加修复与复测结果。

## 6. 中断与故障恢复

- 会话上下文不足：先保存当前修改，更新任务状态和下一条命令，再继续或交接。
- 程序崩溃：保留最小复现、失败包和脱敏日志，确认旧成功捕获未损坏。
- Figma 插件中断：检测本次 importId 所有权根，不批量清理未知或用户已有节点。
- 桥接失效：继续文件导入，不丢弃已完成捕获或擅自改成云端服务。
- 外部环境缺失：完成不依赖该环境的契约/本地 fixture 工作，记录无法验收的具体项目；不能把它们标 done。

## 7. 当前启动与验证命令

在`E:\WebToPrototype`执行：`npm.cmd run check`、`npm.cmd start`、`npm.cmd run smoke:workflow`、`npm.cmd run smoke:stress`、`npm.cmd run smoke:bridge`、`npm.cmd run package:windows`、`npm.cmd run archive:source`。原文字/SVG/表单/阴影/层叠/图片/全页/多选/选择脚本供受影响开发回归；本轮用户只选本地验证，不执行新公网测试。首次开发安装npm.cmd ci，插件ID和manifest入口沿用，能力新增auto-layout，旧插件关闭重开；不关闭安全隔离。

运行涉及本机应用、CIM 或下载时，沙箱可能限制访问；先判断工具限制，不误报为机器不满足条件。实际命令与证据见 docs/08。

## 8. 不应丢失的约束

- 高自由度选择是用户核心要求，不能只做整页截图替代。
- Figma 可编辑性、视觉保真、原型行为分别验收。
- 用户未要求商业化平台、云端账户或团队后台，首版不增加这些前置条件。
- 第一版默认新副本导入，不覆盖用户已编辑设计。
- 不用浏览器关闭安全隔离来解决采集问题。
- Android 延后但优先级已确认，不能忘记或误改为 iOS 优先。
- 所有进度以磁盘记录与实际证据为准，不能依赖聊天记忆。



m2.9历史收尾核对：25份Markdown、171个本地链接/围栏无错误；当时六份开发报告34/36/34/40/29/17项通过，硬边样例最少7977通道、最大0/255。当前Windows首版证据见docs/21，不将历史次数当成本批新结果。
