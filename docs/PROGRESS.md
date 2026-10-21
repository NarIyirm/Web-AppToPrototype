# 当前进度

2026-10-21 本次打包：Windows x64与Mac ARM64最新ZIP已生成，路径见release/latest-*.json。Windows真实打包EXE的30项流程、Mac归档结构及准备脚本检查通过；移动应用命名WebAppToFigma，新logo与EAS profile已接入，用户已授权并执行云构建。手机包进度与ASC/TestFlight步骤见[移动构建说明](../MobileApp/webapptoprototype/docs/BUILD-AND-TESTFLIGHT.md)。真实Mac/手机/Figma结果仍需实际设备验证。

2026-10-21 仓库整理：按用户确认，将桌面、Figma 插件和移动端作为一个完整仓库上传 NarIyirm/Web-AppToPrototype，使用根目录 Git/main；移动端原 Git 元数据及53份原暂存索引保存在 `.local-maintenance/mobile-git-before-monorepo`。旧安装包/重复解压目录/测试缓存已清理，最新发布包与历史证据保留本地。详见仓库清理说明；此前“尚未提交/独立仓库/保持原暂存”均为历史阶段记录，不再作为当前 Git 操作约束。

### 2026-10-21 / 二维整页与手机 App 转换

用户确认上一批验收通过，不扩大为未提供设备的全矩阵通过。本批按新要求增加手机“整页”横纵分块、无重叠拼接/有界部分矩形、原位置恢复；电脑一键整页入口和横向布局读取。App 截图最多5张批量导入、系统帧缩略选择/整批保存后清理、手机可用时自动识别；电脑本机 Windows OCR/macOS JXA Vision、可靠文字去底/采样颜色、文字校对、项目流程已接入。见 [本批说明](29-whole-page-and-app-conversion.md)。

移动 verify 的契约/lint/typecheck/51测试及配置/暂存保持性、桌面类型/159测试/构建通过。独立隐藏 Electron 合成宽长页与真实 Windows OCR 截图链通过；Mac API 桥只做逻辑坐标检查，Mac 真实引擎、Android/iOS 系统采集安装和新功能手机/Figma结果仍由用户执行。未新增依赖，未触发手机构建、提交或推送。证据 evidence/2026-10-21/MOB-whole-page-app。

### 2026-10-21 / 手机网页增强与电脑结果、原型工作流

用户授权落地上一轮建议的第一和第二项。手机补父级/多选/排除/撤销/清空、单画面长页合成、固定内容去重/原位置恢复/取消和部分结果；字体度量传递与复杂区域像素保留。电脑补源图/转换预览、可编辑文字与图片图层筛选、重复提醒归并、当前/全部画面入项目、缩略状态、热点标记/定位/放大、跳转与弹窗本地试播及文字动作备用入口。详见 [本批说明](28-mobile-web-and-prototype.md)。旧两页签和“手机长页未做”描述由本条覆盖，仍不声称全部 CSS/虚拟列表支持。

开发检查：移动契约/lint/严格类型/48项测试及 app.json、53份初始化暂存保持性通过；桌面类型/154项测试/构建通过，独立隐藏 Electron 合成流程检查通过。证据在 evidence/2026-10-21/MOB-03-07；中途 strip-only 参数属性和最小窗口溢出已修复，本机网络 EACCES 通过允许回环后检查。两端手机和真实 Figma 仍由用户执行，不标为通过；未构建手机、提交或推送。

### 2026-10-20 / 桌面工作台 UI 整理

用户确认之前的包校验问题已自行解决，本轮只调整右侧操作结构：固定 Figma/手机连接栏；网页采集、手机素材、转换结果、项目原型四页签；按当前任务显示固定底部按钮；历史/设置/诊断折叠。配对二维码与手机收件分开，连接状态和收件数量自动刷新，加入状态后自动进入原型页。沿用面板尺寸与品牌色，保留原数据、移动 app.json、EAS 和现有修改。详见 [工作台说明](27-desktop-workbench-layout.md)。

类型检查、桌面/插件编译通过；隐藏独立 Electron 实例检查四页签/底部操作、连接切换、1000×650 无横向溢出，通过且无渲染错误。未执行手机/Figma 最终验证，未触发 Expo 构建，未提交或推送。下方记录为历史。

更新时间：2026-10-20（Australia/Sydney）

## 1. 当前结论

- 移动端执行文档包已落盘到[独立Expo仓库docs](../MobileApp/webapptoprototype/docs/README.md)，包含完整计划、任务卡、协议、页面、验收、进度和新对话提示词。以移动HANDOFF为新开发入口，第一项MOB-BASE修工程基线，之后MOB-00验证双平台关键能力；父docs/25保留首轮方案并指向新文档。本轮仅文档，未改app.json/业务代码/依赖或Git暂存，移动业务仍planned。

- 用户已自行初始化MobileApp/webapptoprototype，Expo58.0.16/RN0.88.0，独立Git仓库；本轮已关联私有空仓库NarIyirm/Web-AppToPrototype，origin和凭据仅配置于移动项目。正常权限gh仓库读取及git ls-remote验证通过；无首次提交/推送，未更改原暂存文件或用户app.json。后续移动实现复用此目录和其AGENTS.md。项目要求检查已执行：tsc --noEmit有3处模板类型错误；lint缺配置会自动装依赖，已中止并撤回自动添加的依赖，未借关联任务修改模板功能。

- 移动端计划已完成，见[25 网页与原生App采集计划](25-mobile-web-and-native-plan.md)。用户最新明确Android/iOS同等优先，不再Android优先；输入包含网页与其他原生App。已知iPhone16Pro、iOS版本/Android真机未核实。当前planned，未安装移动依赖或改动应用协议/行为；下一项MOB-00同时探针系统采集、WebView/OCR和手机到电脑加密传输。完整图层恢复不是所有原生App的承诺，系统采集与截图导入分开记录。

- 2026-10-20最新用户反馈：“现在桌面端的都没问题了”。Windows/Mac整体使用验收通过，BUG-003 closed / user_verified。未提供的Mac签名/Gatekeeper/公证/Figma专项报告仍不补造；下方待复验条目为此前历史状态。当前转入Expo移动端和手机到电脑传输的方案讨论，未实施移动端。

- 最新BUG-003：Mac准备日志证明未找到预期位置的.app，签名尚未开始；入口查找/日志已修复，6项归档、9项Bash路径回归、5脚本语法通过。实际Mac签名和损坏提示解除仍待用户复验，见[修复记录](24-macos-prepare-troubleshooting.md)。旧Mac开发检查结论不能视作此次Mac运行已通过。

- 当前任务：Apple Silicon Mac源码适配与开发候选ZIP已完成，141自动测试/类型/构建、6项归档规则、Windows文字28/完整项目29/平台命令4项通过。实际包与SHA见release/latest-macos-arm64.json，源码基线见latest-source.json。真实Mac运行、原生签名/公证、Retina及Figma仍verification_pending，详见docs/22–23。前次自动审批额度阻塞已解除，历史失败保留。

- 最新BUG-002：用户报告“整个页面”转换发送E_LAYOUT_CHANGED，本地滚动文字已复现并修复。快照读取后的普通更新不再丢弃原生结果，不匹配参考停止并提示；真正视口变化、导航/取消仍拒绝。134自动测试、新增10项定向检查及29项全页检查通过；修复构建和最终证据见末尾，待用户复验。

- Windows首版0.1.0候选 / converter desktop-1.0 / adapter web-dom-2 / Schema1.0.0。用户授权补齐首版剩余开发，并指定只用本地验证。多状态与原生原型、历史/视口/会话、有限Auto Layout、WebP/GIF、开放组件、ZIP、队列/分块/日志和Windows分发均已实施。最终真实Figma仍由用户执行；m2.4及此前user_accepted保持，m2.5–m2.9及REL01–REL06不冒充通过。
- 保留原工作台、长页和原生可编辑图层；新操作置于“项目与原型”“捕获历史与浏览器设置”折叠区。
- Windows首版历史基线：134项自动测试、类型/构建通过；完整安装副本本地流程、100次真实采集和原视觉/选择开发回归见[发布检查](21-desktop-release-verification.md)。模拟插件宿主与真实Figma严格区分。
- 公网HTTPS可以访问并转换；本批按用户明确选择仅用本地验证登录态与流程，历史example.com七项不扩大为全部公网兼容。
- Android是后续平台，本轮不执行；没有Git提交、远程或真实Figma写入。

## 2. 已完成事项

| ID | 内容 | 证据 |
|---|---|---|
| DOC-01 | 记录已确认需求、产品范围和分层完成定义 | docs/01 |
| DOC-02 | 规划 Electron、采集、转换与 Figma 插件架构 | docs/02 |
| DOC-03 | 细化框选、Section、多选、文字、资源、长页和降级 | docs/03 |
| DOC-04 | 定义数据包、错误、状态机与本地桥接草案 | docs/04、examples |
| DOC-05 | 制定 16 个基准页面、质量和故障验证标准 | docs/05 |
| DOC-06 | 拆分 M0–M5 的实施任务与依赖 | docs/06 |
| DOC-07 | 整理确认决定、技术建议、风险、待验证项和资料 | docs/07 |
| DOC-08 | 建立当前进度和跨会话续接入口 | 本文件、HANDOFF、README |

## 3. 真实环境检查

方案建立时的检查结果（历史）：

- `E:\WebToPrototype` 起初为空，没有发现项目文件、AGENTS.md 或现有 Git 仓库。
- Node 可执行：v24.15.0。
- npm 可执行：11.12.1。
- pnpm、Python、Git 命令路径存在；没有核实其全部运行兼容性。
- Python jsonschema 模块当前不可用。本轮不安装依赖，也不声称样例已通过正式 JSON Schema 验证。
- 未核实 Windows 具体版本、Figma 安装、字体、CPU/内存和账号套餐。
- 本轮只写方案与人工协议样例，没有安装依赖、生成应用或插件构建产物、调用真实 Figma 写入。

开发启动后的实际检查：

- Windows 11 专业版 x64 build 26200；i7-12700KF，20 个逻辑处理器，31.8 GiB 内存；E 盘约 678 GiB 空闲。
- Node 24.15.0、npm 11.12.1、pnpm 11.25.0、Git 2.45.1。已初始化 main 本地仓库，无提交和远程配置。
- 依赖已安装并精确锁定：Electron 44.9.0、TypeScript 7.0.2、esbuild 0.28.2、Figma typings 1.142.0、Playwright 1.64.1、Ajv 8.20.0、Node typings 24.19.2。
- 实际 Electron 内嵌 Node 24.22.0 / Chromium 152.0.7977.167。微软雅黑、Arial、Segoe UI 字体文件存在；Figma 样例未报告字体替代。
- 已运行真实桌面隐藏窗口测试，5 项检查通过；10 项协议测试、类型检查和构建通过。
- 实际 Figma 文件可写，自建插件成功运行；人工数据原型从节点 1:47 到 1:52，再返回 1:47。
- M0 历史本地连接测试成功，插件 UI 请求 Origin 为字符串 null；该次只有 health。认证传输在本文件末尾的 M3 批次实施。
- npm DNS 和 CIM 在沙箱内受限，沙箱外验证正常；不属于本机缺少网络/硬件。

## 4. 阶段状态

| 阶段 | 当前状态 | 说明 |
|---|---|---|
| M0/M1 | 既有闭环user_accepted；新增设置development_complete | 旧确认不撤销；完整专项不补造通过 |
| M2 | 首版支持范围development_complete / verification_pending | 新增开放组件、WebP/GIF、可选Flex布局与ZIP；复杂CSS有明确边界 |
| M3 | development_complete / verification_pending | 有界缓存/日志、FIFO/分块/租约、故障/压力检查、独立Windows包；真实Figma异常专项待用户 |
| M4 | development_complete / verification_pending | 多状态/热点/连线、本地流程与实际插件主逻辑模拟检查；最终原型播放待用户 |
| M5 | 开发交付完成 / user_acceptance_pending | 分发与基线归档、安装/恢复说明完成；REL与清理时间等用户验收不代填 |

## 5. 下一次应做什么

1. 用户按[Windows使用](20-desktop-release-guide.md)验证REL01–REL06。使用release/latest-windows.json指向的ZIP和同包插件；旧插件关闭重开，桌面重启重新配对。
2. 按样例ID、capture包、真实Figma截图/导入报告修新反馈；m2.5–m2.9仍待反馈，m2.4及此前不重复验收。
3. 支持边界与发布证据见[docs/21](21-desktop-release-verification.md)。Android/签名/自动探索另立后续任务，不将边界写成已支持。


## 6. 最近验证

最新：2026-10-20，Windows首版134项自动测试、类型/构建通过。本地完整流程/压力/分发与回归路径见本文件末尾及docs/21；以下m2.3–m2.9次数按历史保留。

m2.3 开发历史：49 tests、全页29、桌面5、整页直连17、多选29、原Section13/矩形17通过；已获用户整体确认，不重新要求验收。

历史m2.7直连开发回归`smoke:bridge`17项通过，真实UI/HTTP与模拟画布；m2.8没有重跑，不当作本批新结果。

历史：2026-10-18，平台文档、工具可执行版本和目录状态已检查。随后用 Python 标准库实际检查了：11 个文件存在，10 份 Markdown 的 22 个本地链接有效；JSON 样例可解析，2 个 screen、8 个节点、2 条交互的根、父级、无环结构、几何值和目的地引用一致；40 个实施任务编号唯一且全部未勾选。Markdown 代码围栏检查通过，阶段依赖与范围人工核对完成。

检查范围仅限文档和人工样例。未运行正式 JSON Schema 验证、应用测试、插件构建或真实 Figma 导入。

2026-10-18 至 19：首轮实际执行 `npm.cmd run check` 通过（10 tests），`npm.cmd run smoke:desktop` 通过（5 checks），真实 Figma 导入报告 succeeded，原型播放往返通过，localhost health 成功。证据目录：evidence/2026-10-18/M0-01、M0-03、M0-04、M0-05；目录日期为该会话开始日。

实际测试中修正了 DOM/Figma Navigation 类型冲突、manifest 开发域名、UI 状态函数及消息接收、导航目标必须为页面顶层 Frame 的兼容问题。后两次失败导入已清理本次临时图层。

## 7. 当前已知限制

- 真实Figma REL01–REL06、m2.5–m2.9新范围仍待用户。模拟宿主不代替字体/原型播放/Undo或全图视觉验收。
- 支持普通开放组件；封闭ShadowRoot/iframe/Canvas/video保留边界占位与告警，复杂filter/transform/蒙版/内阴影/多背景等未承诺还原。不自动对整页栅格化，详细见docs/14–20。
- 简单单行/列Flex可选Auto Layout，默认关闭；不可靠布局保持绝对定位。文字按视觉行，非完整段落重排；字体替代可报，逐字缺字和系统DPI矩阵仍无完整证明。
- 全页有界，不展开嵌套滚动或保证识别所有虚拟列表；源参考是采集前截图。手工多状态支持同/跨URL，不录制业务JS；单次自由矩形不等于多矩形集合。
- 仅内置独立会话，弹出SSO窗口仍禁用。公网HTTPS可用，但本地登录样例不证明反爬/全部认证站。WebP/GIF只保留静态帧。
- 一次配对一个插件、固定43821；队列5个/100MiB、一次导入一个，不自动唤醒插件。重导入新副本；不保证跨文件全局exactly-once，未确认任务重启不自动再建。
- Windows x64分发未签名、无商店发布；需保留整个运行时目录。源文件本地保存，无Git commit/tag或远程。支持边界、非P0已知项和证据缺口见docs/21。

## 8. 会话变更日志

### 2026-10-18 / 方案建立

请求：先做桌面应用验证，并生成详细、可续接方案。

操作：研究官方文档；读取本机只读环境；创建 README、七份规格、进度/续接文档和人工协议样例。

范围决定：本轮 Web 桌面采集 + Classic plugin；Android 后续优先。文件导入为基线；实时桥接单独实测。

结果：方案检查通过。下一步进入 M0-01，全部实现任务仍未开始。

### 2026-10-18 至 19 / 开发条件与第一步验证

请求：检查本地开发条件并开始第一步；用户已打开可编辑 Figma 测试文件。

操作：核实硬件/工具/Figma；初始化 Git；安装锁定依赖；创建 workspace、构建脚本、基础 Schema 和 10 项测试；创建桌面/插件探针；实际运行并保存报告/截图。使用 computer-use 技能完成本地插件加载和原型播放。

验证：桌面 5 项实测通过；Figma 人工包 9 节点、1 图片、2 跳转及实际往返通过；localhost health 成功。真实网页转换、完整稳定性矩阵和 Android 均未开始。

运行：`npm.cmd start`；检查：`npm.cmd run check`；桌面实测：`npm.cmd run smoke:desktop`。完整说明在 docs/08。

下一步：补齐 M0 专项，尤其取消/Undo 与资源完整性，然后进入 M1。测试用隐藏桌面服务在本轮结束时停止；Figma 中保留成功导入画面便于用户检查。

### 2026-10-19 / 资源校验与真实 Section 文件链路

请求：用户自行执行稳定性测试，要求先完成资源校验及真实 Section → Figma 链路，并提供验收方法。该分工覆盖上文历史“先等 M0 专项再实施”的顺序。

实现：新增可在 Figma sandbox 运行的 SHA-256/base64/PNG/JPEG 校验与预算；DOM 遍历、Range 渲染行原生文本、基础框架样式、PNG/JPEG 图片固化/去重、URL 元信息脱敏；Section/父级选择、命名、保存和重开；插件解码预检与来源告警合并。新增 9 个明确标注为人工输入的验收文件、docs/09 和用户结果表。

开发检查：`npm.cmd run check` 通过，最终 19 项测试、类型和构建成功（含 9 个交付测试文件的预期契约结果）。实际 Electron `smoke:capture` 9 项通过：Section/中英文文本无重复/按钮文本/PNG/原生框样式/几何/文件导出与命名/重开/另一个独立站点 JPEG 与 URL 脱敏；原有 `smoke:desktop` 5 项回归通过。文件选择器由脚本替换为确定路径，实际 IPC、校验、序列化和磁盘操作执行；原生保存对话框由用户验收。启动 Electron 受沙箱限制，沙箱外执行成功；未改动系统安全设置。

初次功能证据：[report.json](../evidence/2026-10-19/M1-functional/2026-10-18T13-21-37-644Z/report.json)、[真实采集包](../evidence/2026-10-19/M1-functional/2026-10-18T13-21-37-644Z/capture.json)、[独立站点包](../evidence/2026-10-19/M1-functional/2026-10-18T13-21-37-644Z/independent-capture.json)。本地日期为 19 日，文件名为 UTC 时间。

最终构建后功能复核：[9 项功能报告](../evidence/2026-10-19/M1-functional/2026-10-18T13-28-56-176Z/report.json)、[最终真实区块包](../evidence/2026-10-19/M1-functional/2026-10-18T13-28-56-176Z/capture.json)；独立站点另外覆盖 display:contents 直接文本。原有诊断回归：[5 项报告](../evidence/2026-10-19/M0-04/2026-10-18T13-27-33-222Z/smoke-report.json)。隐藏 Electron 测试已关闭，无需用户清理测试服务。

本轮没有操作 Figma，也没有代替用户执行手工稳定性验收。真实 Figma 是否成功、字体/视觉/取消/Undo 均等待用户回报；状态保持 verification_pending。无新 Git commit/tag 或远程仓库。

### 2026-10-19 / BUG-001 单边边框还原

反馈：用户确认流程无问题，附源网页与真实 Figma 截图，订单行多出了整圈边框。用户结果已记录到 USER-TEST-RESULTS，不把其余未逐项反馈的专项标通过。

原因与修复：m1.1 将非均匀边框统一为 Frame stroke。m1.2 对四条实线同宽同色保留原生 stroke；其他可见边各用独立原生 SHAPE，保留宽度、颜色和相对位置，无边框方向不生成线。普通底边框不再发统一近似告警；虚线/非均匀圆角等复杂情况继续告警。不扩展协议，无需改装插件；旧包需重新采集导出。

回归：在实际订单页面断言每行仅有一条 1px bottom SHAPE、行 Frame 不设整圈 stroke，并保留外层完整边框；独立页面测试不同边宽/边色与无边框。隐藏测试改用 OS 分配的回环端口，避开用户当前运行的 43821 应用，不关闭用户程序。生产端口仍为 43821。

结果：`npm.cmd run check` 通过（19 项协议/资源测试、类型与构建）；`npm.cmd run smoke:capture` 实际 Electron 13 项通过，包含新增 4 项边框回归。[报告](../evidence/2026-10-19/M1-functional/2026-10-18T13-43-41-783Z/report.json)、[修复后真实采集包](../evidence/2026-10-19/M1-functional/2026-10-18T13-43-41-783Z/capture.json)、[各边测试包](../evidence/2026-10-19/M1-functional/2026-10-18T13-43-41-783Z/independent-capture.json)。初次测试因用户占用生产端口而退出，改为隐藏测试独立端口后成功；未中止用户进程。本轮没有写入 Figma，最终视觉请用户重启桌面、重新采集导出后复验；旧 JSON 不自动修正。

### 2026-10-19 / 用户复验通过与后续建议

用户确认：“现在我已经测试过了，都没有任何问题。”记录当前单区块流程及 BUG-001 修复验收通过，关闭该缺陷，不再要求重复复验。本轮仅更新进度与下一步建议，没有开发新功能或运行新的测试。下一建议批次为视口采集与源截图预览，随后进入 M2 自由框选；原有全页、多选、交互与 Android 范围保留。

### 2026-10-19 / m2.1 视口、自由矩形与源预览

请求：用户授权继续上述三项，最终验证留给用户；中途用户再次要求继续。已实现当前视口、严格矩形/完整元素一次扩展、反向拖拽/Esc/最小边界、文档/CSS 坐标归一化、根 Frame 裁切与场景剪枝。父级 overflow 裁切和可见溢出后代均纳入处理。源截图隐藏工具叠层后生成，单独保存 PNG 和关联元信息；重开校验 packageId/revision、摘要、尺寸，缺失或错配时明确提示。

改动：capture.ts、geometry.ts、capture-data.ts、preview.ts、main/preload/renderer、现有界面/CSS、新几何测试与 smoke-selection.mjs；converterVersion=m2.1 / adapterVersion=web-dom-2。主协议仍为 1.0.0，沿用已有 FRAME/TEXT/SHAPE/IMAGE，插件不读取预览附件，不需重新安装。

检查：`npm.cmd run check` 通过（23 项测试、类型、构建）；实际 Electron `smoke:selection` 最终 17 项通过，`smoke:capture` 原有 13 项回归通过。新脚本只替换原生文件选择器以提供固定路径，实际 IPC、转换、序列化和磁盘操作执行。UI 外壳与源预览已看图检查；外壳截图本身不含 native WebContentsView 的内容，该空白不代表网页未加载。

证据：[17 项新功能报告](../evidence/2026-10-19/M2-selection/2026-10-19T03-41-22-492Z/report.json)、[严格裁切真实包](../evidence/2026-10-19/M2-selection/2026-10-19T03-41-22-492Z/strict.json)、[完整元素真实包](../evidence/2026-10-19/M2-selection/2026-10-19T03-41-22-492Z/complete.json)、[源视口 PNG](../evidence/2026-10-19/M2-selection/2026-10-19T03-41-22-492Z/viewport.png)、[UI 外壳](../evidence/2026-10-19/M2-selection/2026-10-19T03-41-22-492Z/shell.png)、[13 项原链路回归](../evidence/2026-10-19/M1-functional/2026-10-19T03-41-22-112Z/report.json)。

发现并修正：默认 fixture 的启动导航与立即打开外部页面发生竞争，ERR_ABORTED 原先会导致应用退出；现改为先启动默认页并允许用户替换导航。另修正源预览包含原生滚动条、完整元素候选忽略祖先裁切的问题。第一次测试异常与后续成功报告均保留。一次重跑因自动审批服务额度限制未执行，恢复后已按正常审批执行成功，没有绕过审批。

最终状态：本轮没有写入 Figma、没有执行用户最终手工验收。新 U01–U06 均待用户回报；文档 docs/10 和结果表已建立。隐藏测试应用均正常关闭；未关闭用户原来运行的应用。没有新增 Git 提交或远程仓库。

### 2026-10-19 / m2.1 用户确认与本地直连建议

用户反馈：“现在没问题”，并询问下一步及应用点击后直接在 Figma 生成的可行性。记录 m2.1 整体使用确认，不虚构逐项 U01–U06 报告。本轮只核对本地实现与官方插件运行/manifest 文档，未修改代码或运行新测试。

推荐将本地直连提前到下一批：保持目标文件内插件运行，配对后由插件 UI 从 loopback 服务获取任务、主逻辑调用现有导入器，向桌面回传进度与报告。既有 localhost health 已实测，但鉴权和项目数据传输仍未实现。下一批验收目标为同一连接会话连续发送两份捕获，无需手选 JSON，目标页面正确、断连可见、结果回报且不因回执重试重复建图层。

### 2026-10-19 / M3 本机配对与一键发送首版

请求：用户授权“那请继续下一步吧”。按上一轮建议完成本机直连最小链路，最终真实 Figma 验收继续留给用户。

实现：新增共享 BridgeTarget/Job/Report 类型、LocalBridge HTTP 服务与原子任务 journal；一次性配对码、内存 token、单活动任务、绑定页面、指纹去重、进度与幂等回执、8 秒失联/重启保守恢复。桌面增加配对/复制/断开、一键转换发送当前选区或视口、发送已转换缓存和保存实际回执。插件增加配对轮询 UI、目标上下文、稳定 importId、提交根与最近 3 个 clientStorage 回执校验，回执重传不重建；手工文件链路保留。

文件：apps/desktop/src/bridge.ts、main/preload/renderer/index/style，packages/contracts/src/bridge.ts，apps/figma-plugin/src/main.ts、src/ui.html、ui/index.ts，build/test 脚本与两套桥接测试、scripts/smoke-bridge.mjs。新增 docs/11、ADR-017，并同步 README/协议 8.1/任务表/结果与续接。converterVersion=m2.1、Capture Package 1.0.0 未改变。

检查：最终 `npm.cmd run check` 成功，37 项 tests 全通过，类型与构建成功。新增 8 项桥接/HTTP 测试、6 项真实插件主代码在模拟 Figma API 中的测试，覆盖单次码/限速/认证、页面绑定、冲突、进度、迟到回执、日志/重启、页面中断清理、缺失绑定拒绝和定位/报告缓存失败。这里的模拟画布测试不是真实 Figma 导入验收。

最终构建后 `npm.cmd run smoke:bridge` 14 项通过：[控制链路报告](../evidence/2026-10-19/M3-bridge/2026-10-19T04-12-51-962Z/report.json)。实际 Electron/源网页采集/本机服务和真实插件 UI 在 opaque sandbox iframe 运行；画布宿主为模拟，报告 `figmaTested:false`。包含连续两包无文件对话框、图片摘要、实际进度回传、首次回执响应故意丢失后的重传不重建、缓存重复发送去重、页面切换保护/返回、一次性码及断开/回退。脚本保存的 captured-1/2.json 为真实网页采集数据；模拟 nodeMap/root IDs 不能用于真实 Figma 验收。

原链路回归：`smoke:capture` [13 项通过](../evidence/2026-10-19/M1-functional/2026-10-19T04-12-00-676Z/report.json)，`smoke:selection` [17 项通过](../evidence/2026-10-19/M2-selection/2026-10-19T04-12-02-264Z/report.json)。这两组执行后只补强直连目标校验/非关键定位故障和桌面状态文案；最终直连脚本已在最终构建上重跑通过，不无意义重复旧采集测试。

调试记录：初次 smoke 创建隐藏宿主未导航，导致 window 事件等待超时，改为先加载 about:blank；后续 waitForFunction 异步 IPC 断言过早返回，改为 Node 侧明确轮询 IPC 状态，最终检查通过。失败报告保留，未将失败运行记通过。Node HTTP 测试在沙箱内触发 EACCES，Electron/HTTP 按正常升级审批执行成功，未修改安全设置；测试均使用独立 profile/动态端口，完成后关闭自己的测试应用，不中止用户原有应用。

当前状态：直连首版代码、自检和文档完成，B01–B06 verification_pending；本批没有写入真实 Figma。用户需重启桌面及重新运行已有开发插件，配对后验收连续发送，详见 docs/11。当前无分块/独立租约/后台唤醒/全局去重/安装包；不是整个 M3 完成。下一步优先处理 B 项反馈，确认后做 M2-03 多选/排除。未新建 Git 提交、tag 或远程仓库，修改保存在本地工作区。

文档收尾：实际检查 16 份 Markdown 的代码围栏及 67 个本地链接，无问题；读取三份最终功能证据，14/13/17 项均无失败。桌面外壳与插件 UI 截图已看图核对；外壳截图不包含 native WebContentsView 内容属采集方式限制，网页采集由真实数据包/源预览与断言验证。

### 2026-10-19 / 直连首版用户确认及下一批建议

用户反馈：“现在我验证过了，没有问题，那接下来应该继续哪一步”。记录 M3 本地直连首版 **user_accepted（整体确认）**，不再要求重复同一验收；B01–B06 未分项提供结果，不据此造逐项实测记录。既有 m2.1 和 BUG-001 接受状态保留。

本轮只更新进度、结果表、续接及 README，没有修改程序、运行新测试或写入 Figma。下一批建议明确为 M2-03 多选/排除：追加/取消选择、父子去重、移除不需要的子元素但保留空位、独立/合并 Frame 输出及批量发送。之后再做有界全页及多状态交互。没有开始新功能开发，也没有新增 Git 提交或远程仓库。

### 2026-10-19 / m2.2 多选、排除与首次使用工作台

授权：用户要求“继续做”，并希望考虑 UI 布局、参考成熟 C/B 端工具、保持整体简约高级。应用 impeccable 技能，读取现有 PRODUCT/CSS，参考 Figma 的选中反馈和 Framer 的工作区分工；来源与视觉约定记录于 DESIGN.md。沿用品牌色及静态 HTML/TypeScript，无新依赖或框架迁移。

实现：capture.ts 保存同页多根/排除 Element 句柄和 dom-* 标识；连续追加/取消、父子去重、列表移除/清空、排除/恢复及实线/虚线轮廓。捕获前再次去重并拒绝失效根；不改源 DOM，不移动其他节点。convertCaptures 输出独立 screens，mergeCaptures 生成透明共同根、保留文档相对位置并重映射节点/图片/告警 ID。整批图片摘要去重，原预算沿用；最多 20 根/100 排除。单矩形与视口规则明确，未做跨页面收集或多矩形。

工作台：地址/工具在顶部，原生网页在中央，右侧选择/结果页签，预览与发送固定在下方。连接入口在顶部、配对/插件路径/诊断渐进展开；空态与按需三步指引解释下一步。支持逐画面命名、源截图和告警浏览，整批发送/保存/重开。后续预览附件增加 screen ID，首画面旧命名保持兼容。源参考保留排除前内容，已在 UI 和 docs/12 明确，不能当作结果渲染图。

文件：capture/capture-data/converter/preview/main/preload/renderer/index/style；新增 DESIGN.md、docs/12、两项批量几何测试、smoke-multiselect 及共用 electron-shell 脚本，更新已有 smoke 的 UI 入口。producer converterVersion=m2.2、adapter=web-dom-2；主包 1.0.0、Figma 插件导入代码和桥接协议不变，可沿用插件，应用重启后重新配对。无新付费依赖、真实 Figma 写入或 Git 提交。

开发检查：最终 `npm.cmd run check` 通过，39 tests 全通过、两套类型及构建成功。`npm.cmd run smoke:multiselect` 最终 [29 项报告](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-19-03-616Z/report.json)，包含真实网页的多根/父子去重、排除不改源 DOM、原几何/原生文本、整批资源去重、两种输出、第二画面改名、逐画面附件保存重开、失效项拒绝/恢复、清空与无选区视口。UI 检查覆盖三步引导、键盘页签、1320×860 与 1000×650 无水平溢出和主操作固定。正文/辅助/选中态实测对比度分别约 16.95、6.83、7.21，见 [contrast.json](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-19-03-616Z/contrast.json)。

桥接最终 [16 项报告](../evidence/2026-10-19/M3-bridge/2026-10-19T05-16-32-977Z/report.json)，新增整批多 screens 作为一个导入 job、连接设置不会因轮询自动关闭。实际 Electron/真实网页/真实插件 UI/HTTP，画布宿主模拟、figmaTested:false，不是实际 Figma 导入证明。原 Section [13 项回归](../evidence/2026-10-19/M1-functional/2026-10-19T05-15-06-654Z/report.json)、视口/矩形 [17 项回归](../evidence/2026-10-19/M2-selection/2026-10-19T05-15-05-107Z/report.json) 通过。之后只精简新用户文案和小窗口 CSS，29 项新功能/布局已用最终产物再跑通过，未无故重复所有旧测试。

看图核对：[宽屏工作台](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-19-03-616Z/workbench-wide.png)、[最小窗口工作台](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-19-03-616Z/workbench-compact.png)、[真实源网页](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-19-03-616Z/source.png)。原生 WebContentsView 不在外壳截图内，其空白不代表未加载。根据首次截图进一步收紧小窗口重复标题和间距，主操作并排保留，最终截图已查看。

修复与失败保留：旧 smoke 将 firstWindow 假定为 shell，新时序下偶尔得到先就绪的原生目标页并等待 w2p 超时；改为共用 waitForShell 按 file: 找主界面，同时补初始 URL/加载状态同步。改名字段 blur 与保存 click 交错曾取消首次保存点击，改为串行化命名并等待后保存/发送，13 项回归已覆盖一次点击保存。另修复切换页签保留旧滚动位置、连接设置被每秒轮询关闭的问题。失败运行原报告保留，不记通过；测试应用独立 profile/动态端口，均已关闭自身实例，未中止用户程序。正常权限审批运行 Electron/HTTP，没有绕过隔离。

交付状态：m2.2 实现/自检完成，C01–C06 最终 Figma 与体验由用户按 docs/12 执行；不取消前批次 user_accepted。M2-03 暂为 verification_pending，完整 M2/M3 不宣称完成。下一步先处理新反馈，确认后候选为有界全页；Android、安装包、自动交互与 Auto Layout 本批未实施。全部源代码及进度保存在本地，未建立远程或提交。

### 2026-10-19 / m2.2 用户确认与全页建议

用户反馈：“现在我验证过了，没问题，那接下来应该做哪一步呢”。m2.2 多选/排除、两种输出、整批发送与新版工作台记录 **user_accepted（整体确认）**；M2-03 按 docs/12 已交付范围勾选完成。不要求重复相同验收，不补造 C01–C06 的分项步骤或截图，也不据此宣称完整视觉/稳定性矩阵通过。

本轮只更新进度、任务表、结果表、续接与 README，没有修改程序、运行新测试或写入 Figma。下一批建议是 M2-04 有界全页：当前已加载内容 → 有界滚动准备/懒加载 → 固定与吸顶元素处理 → 进度/取消/恢复/部分结果说明。优先在现有采集范围中扩展入口，保留用户已确认的操作布局。全页通过后再补常见视觉兼容，推进多状态与原型连线；Android、安装包仍按后续范围。尚未开始全页开发，无新增 Git 提交或远程仓库。

### 2026-10-19 / m2.3 有界全页与扩充本地例子

授权：用户要求继续下一步，并扩充本地长页面验证例子。沿用最终验证由用户执行的分工；本批没有写入真实 Figma。现有 m2.2、直连与边框验收保留。

实现：新增 full-page.ts 协调有界滚动准备与 try/finally 恢复、capture.ts 全页裁切根/顶部一次 DOM 快照/内容版本/列表回收启发式/输入锁、main.ts 进度/取消/导航与挂起读取保护/真实绘制时序、assets.ts 资源中断；新增 preview-path.ts，扩展 preview.ts 的分段附件保存重开。renderer/preload/index/style 在现有范围下拉加入全页与加载开关，底部固定进度/取消、结果摘要和源参考位置选择。converterVersion=m2.3、adapter=web-dom-2、主包 1.0.0，插件导入器不变、无新依赖。

边界：高度 30000 CSS px、准备 30 步/30 秒；整轮等待 90 秒，页面单步读取/截帧 15 秒保护。部分结果仅包括已覆盖范围；固定/吸顶是顶部快照的静态外观各一份，未恢复网页行为。原 3000 元素/5000 图层/60000 字符与资源预算不扩大。回收列表检测保守拒绝，非所有框架保证，不展开内层滚动。取消/错误保留旧成功包并恢复工具及原位置；页面导航不把旧坐标写到新页面。网页自身已发请求和追加 DOM 不回滚。

例子：probe.html 保留原订单/图片/按钮，扩充 8 计划阶段、6 检查项、4 张进入视口才加载的图片、3 条动态追加记录及页尾；增加 STICKY_ONCE/FIXED_ONCE/LONG_PAGE_END 等可核对标记。virtual/infinite/tall.html 分别验证列表复用、无限增长、42000px 页面。故障页通过页尾链接进入，不依赖外部站点。

源参考：最多 12 段/32 MiB，单段长边 2048px；超长均匀抽样、非拼接，图中固定层可重复，原生节点仍一次。首段附件命名兼容，后续带 segment 编号；主 JSON 独立导入。screenId 后缀做安全编码，非标准 ID 使用摘要，避免路径逃逸。后续损坏段跳过；首段索引损坏则该画面无参考，主包不受影响。界面与文档明确参考不是结果图。

开发检查：最终 `npm.cmd run check` 49 tests 全通过、两套类型及构建成功（新增 10 项覆盖准备/增长/步数/时间/高度/回收/取消/采样/清理错误与附件路径）。`npm.cmd run smoke:full-page` 最终 [29 项报告](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/report.json) 全通过；真实 Electron/本机页面/IPC/资源/磁盘，文件选择器在脚本中指定固定路径，无真实 Figma。覆盖已加载与准备两种方式、原生文字和图片、固定层各一份、分段切换/完整性/保存重开/后段损坏、取消恢复、回收拒绝、无限预算、超高裁切、125% 缩放、跨文档和同文档导航解锁。

真实采集产物：[准备后长页包](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/prepared.json)、[仅已加载包](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/loaded.json)、[无限页部分包](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/infinite.json)、[超高裁切包](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/tall.json)。本机宽 937px 时准备后页高 5203px，278 图层、102 文本、5 个图片节点按摘要去重为 1 资源；这是该测试窗口的实际结果，不要求用户不同窗口同高。

看图核对：[范围与加载开关](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/full-options-panel.png)、[结果与分段入口](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/full-result-panel.png)、[真实页尾参考](../evidence/2026-10-19/M2-full-page/2026-10-19T06-02-41-926Z/saved.json.screen-1.segment-8.preview.png)。最终截图已查看，保留现有布局；原生 WebContentsView 不出现在 shell 位图的限制不变。

桥接 [17 项通过](../evidence/2026-10-19/M3-bridge/2026-10-19T05-55-12-418Z/report.json)，新增真实整页包作为第三个任务传输及页尾文本核对。真实 UI/HTTP + 模拟画布，figmaTested:false。旧链路本批回归：Section [13 项](../evidence/2026-10-19/M1-functional/2026-10-19T05-49-24-430Z/report.json)、矩形/视口 [17 项](../evidence/2026-10-19/M2-selection/2026-10-19T05-52-55-322Z/report.json)、多选/工作台 [29 项](../evidence/2026-10-19/M2-multiselect/2026-10-19T05-52-56-099Z/report.json) 通过；导航保护调整后另跑桌面 [5 项](../evidence/2026-10-19/M0-04/2026-10-19T06-01-10-139Z/smoke-report.json) 和最终全页 29 项。旧链路未因无关文档更新再重复执行。

发现与修复：隐藏/后台源页的 IntersectionObserver 最初晚于布局读取触发，导致 E_LAYOUT_CHANGED；改为暂关目标节流、每步真实绘制后再稳定读取。脚本重开附件断言最初跑在磁盘读取完成前，补显式 UI 状态等待。Electron 在导航销毁上下文时 executeJavaScript 可能不返回，新增 withTarget 对导航/销毁/取消/15 秒超时竞速并清理监听；页就绪提示不再覆盖导航失败。hash 导航另外解锁输入，避免旧滚动写到新锚点。初次失败运行和各次复测原目录保留，不篡改为通过。

文档检查：19 份 Markdown、98 个本地链接和代码围栏检查通过；README/PROGRESS/HANDOFF/协议/算法/ADR/任务表/用户结果/界面约定已同步。历史失败和旧用户确认记录保留。

运行：`npm.cmd start` 重启后打开测试页；`npm.cmd run smoke:full-page` 为新开发检查。Electron/本地 HTTP 在沙箱内受限，按正常升级审批执行，测试使用独立 profile/动态端口且结束关闭自己的实例，没有中止用户程序。状态 M2-04 verification_pending，用户按 [docs/13 D01–D09](13-full-page-and-long-demo-acceptance.md) 最终验收，结果表已建。下一步先处理反馈，再建议视觉兼容，Android/安装包/自动交互后续。无 Git 提交或远程，代码与进度均在本地。

### 2026-10-19 / m2.3 用户确认与新对话交接

用户反馈：“这阶段我验证过了，没问题”，并希望另起新对话继续。记录 m2.3 user_accepted（整体确认），M2-04 按 docs/13 范围 done；D01–D09 不补造分项，不重复要求已确认验收，不扩大为完整视觉或异常矩阵通过。

本轮仅更新 README、进度、任务表、用户结果、HANDOFF 和当前说明，没有修改程序、代操作 Figma 或运行新应用测试。下一建议 m2.4 为 M2-06 子集：img object-fit/object-position、单层背景图 cover/contain/定位、常见线性渐变；新增独立视觉基准页和验收清单，保留既有长页和工作台。之后再做文字/层叠兼容、多状态与基础交互。新对话沿用 E:\WebToPrototype 本地目录，先读磁盘交接再按用户发送的续接任务实施；当前未开始 m2.4，无新 Git 提交或远程。

### 2026-10-19 / m2.4 视觉还原第一批

请求：用户指定图片裁切/定位、单层背景图、常见线性渐变和本地视觉页，保留简约工作台、长页和原生图层，最终 Figma 验证自行执行。已读取交接/进度/用户结果/设计及算法、协议、任务表；仓库仍全量未提交，无适用 AGENTS.md，未删除原测试包和用户文件。

改动文件与作用：

- `apps/desktop/src/visual.ts`：CSS列表/长度/定位、五种object-fit与背景尺寸几何、线性渐变角度/色标解析，拒绝不支持的表达式。
- `capture.ts`、`capture-data.ts`、`assets.ts`、`converter.ts`：读取内容/背景origin/clip，原生圆角裁切Frame+完整图片资源；固化后计算实际显示rect，背景先于文字。合并时重映射图片owner和告警，沿用旧预算/摘要去重；复杂背景告警保留底色和原生内容。
- `packages/contracts/src/index.ts`、Schema、生成校验器：主协议1.0.0，按内容声明image-placement/linear-gradients；新增imageSizing及linear_gradient联合填充，校验能力、节点类型、色标，旧包兼容。converter=m2.4，adapter=web-dom-2。
- `apps/figma-plugin/src/paints.ts`、`main.ts`：CROP/identity图片映射和按物理宽高投影的GRADIENT_LINEAR；旧IMAGE仍FILL。原生图片/渐变可编辑，不用截图替代文本和整页。
- `apps/desktop/fixtures/visual.html`、三张`visual-*.png`、main本地路由、`scripts/create-visual-fixtures.mjs`、`build.mjs`：独立视觉页与可复现彩色/透明资源；原probe长页只追加页尾链接。生成`examples/visual-m2.4.example.json`人工样例，非网页证据。
- `tests/visual.test.ts`、`contracts.test.ts`、`plugin-bridge.test.ts`：新几何/渐变/能力声明/旧包与实际导入代码模拟宿主验证。`scripts/smoke-visual.mjs`及package.json新命令：真实Electron新页、14例内部像素、保存重开、多选独立/合并、矩形和原订单开发回归。
- README、DESIGN、docs/03/04/06/07/08、本文、HANDOFF、USER-TEST-RESULTS与新增docs/14同步范围、运行、验收与限制；未改工作台外壳、全页协调器、桥接契约或预算。

实际验证：`npm.cmd run check` 61 tests、桌面/插件两套类型与构建通过；`npm.cmd run smoke:visual` 40项通过；`npm.cmd run smoke:bridge` 17项通过。14例稳定内部像素抽样，单例至少30个颜色通道，最大误差2/255（容差5/255）；不是全图差分或真实Figma渲染。20份Markdown、108个本地链接与围栏检查通过。没有执行新真实Figma验收、Android/安装包测试，不要求重跑m2.3及更早用户矩阵。

真实证据：`evidence/2026-10-19/M2-visual/2026-10-19T08-45-39-046Z/`（report、pixel-comparison、真实全页/独立/合并/矩形包、保存重开、源/场景对照PNG）；直连`evidence/2026-10-19/M3-bridge/2026-10-19T08-48-02-355Z/`（真实UI/HTTP+模拟画布）。本轮没有真实Figma目标/节点/报告，不虚构。

失败与修复：首轮沙箱localhost EACCES、浮点精确断言失败，改容差后按正常权限检查通过。一次自动审批因额度暂不可用未执行，用户要求继续后重试正常。视觉检查器先后发现小数截图边缘多1px、CanvasGradient非预乘透明插值与CSS不一致、直接IPC未更新UI保存状态；修正采样/透明求值和UI操作后通过。失败目录与中间36项成功保留，未覆盖历史。新增组合检查要求显式重映射图片请求owner，已修复并以合并背景告警验证。

状态：M2-06a development_complete / verification_pending，M2-06大项仍未完成；E01–E07待用户按docs/14验证。复杂背景/渐变的当前告警有复现页，后续按真实反馈决定扩展。m2.3及此前user_accepted保留。

启动：`npm.cmd start`，Figma关闭重开已有本地插件以载入新构建并重新配对；原长页页尾进入“图片与渐变视觉基准”或访问`/fixture-visual`。开发检查：`npm.cmd run check`、`npm.cmd run smoke:visual`、`npm.cmd run smoke:bridge`；旧命令仍可开发回归，无安装包命令。本轮无新依赖、无Git commit/tag、无远程或真实外部写入，代码/构建/进度均在磁盘。

下一最小任务：用户按E01–E07执行最终Figma比较和编辑，提供问题样例ID/包/报告；先修本批反馈，再按后续请求推进文字/层叠等下一子集。无需重新开发本批或重验旧阶段。

### 2026-10-19 / m2.4用户通过与m2.5文字第一批

用户反馈“这轮我验收通过了，继续接下来下一步吧”。M2-06a按docs/14范围done/user_accepted，不补造E01–E07，不重复要求旧验收。按既定后续候选实施M2-05a文字第一批；m2.5新范围的最终Figma仍由用户执行。

文件与实现：

- `apps/desktop/src/text.ts`：字素/UTF-16偏移、常见upper/lowercase、按共同容器/视觉行/间距/字号/行高/字距和安全透明行内祖先合并原生文本，重定位并重算runs。混合字号、背景/透明度或特殊布局保留原生片段。
- `capture.ts`：完整字素Range读取，跨DOM样式合并，保留普通与Unicode空白、pre/空行、实际行坐标；补齐字体列表/字重和常见装饰。复杂排版/装饰与混合字号明确告警，emoji字形覆盖只标未验证。渲染位置优先，一视觉行一个Text，不宣称整段重排。
- `packages/contracts/src/index.ts`、Schema/生成校验器、`converter.ts`：主版本1.0.0，producer=m2.5、adapter=web-dom-2；按需声明styled-text，增加可选Font.fallbacks与run.color/letterSpacing/decoration，校验索引/颜色/新能力并兼容旧包。
- `apps/figma-plugin/src/font-resolver.ts`、`main.ts`：按CSS列表/同族样式/确定系统回退选择字体，替代报告保存实际选择与原因。加载后先设置基础fill，再设置原生范围样式，防止整节点fill覆盖多色runs；不声称逐字缺字检测，不下载/安装字体。
- `apps/desktop/fixtures/text.html`、main本地路由、probe页尾链接：独立文字页，保留长页、视觉和故障示例。`scripts/create-text-example.mjs`、`build.mjs`、`examples/text-m2.5.example.json`人工样例明确非网页证据。
- `tests/text.test.ts`、`plugin-bridge.test.ts`、`scripts/smoke-text.mjs`和package.json：字素、合并安全条件、大小写/UTF-16、协议/字体匹配及实际插件代码模拟宿主测试；真实Electron新页/保存重开/多选/矩形。`smoke-visual.mjs`仅更新生产者版本断言以继续检查既有视觉能力。
- README、DESIGN、docs/03/04/05/06/07/08/14、新docs/15、PROGRESS/HANDOFF/USER-TEST-RESULTS同步新旧状态。外壳布局、桥接接口、全页预算/取消/恢复未改，无新依赖。

实际命令与结果：`npm.cmd run check`最终71 tests、两套类型与构建通过；此前68项阶段检查也通过。`npm.cmd run smoke:text`28项通过（两次成功保留）；`smoke:visual`40项、`smoke:bridge`17项开发回归通过。本批无失败测试运行。文字页截图已查看，无溢出；没有执行真实Figma或字形像素差分，不能从模拟宿主推定最终排版/缺字通过。

证据：`evidence/2026-10-19/M2-text/2026-10-19T09-15-47-685Z/`（真实全页、独立/合并、严格矩形、保存重开包、源页截图和28项report）；首轮28项在`2026-10-19T09-12-49-786Z/`保留。视觉开发回归`evidence/2026-10-19/M2-visual/2026-10-19T09-13-57-004Z/`40项；直连`evidence/2026-10-19/M3-bridge/2026-10-19T09-16-00-204Z/`17项（真实UI/HTTP+模拟画布）。无本轮真实Figma目标/节点/导入报告。

状态：M2-05a development_complete / verification_pending；TXT01–TXT07等待用户，M2-05大项未完成。混合字号/复杂装饰/特殊排版保留原生近似或分片并告警；字体覆盖不可从字体列表证明。m2.4及此前user_accepted保持。

运行：`npm.cmd start`，关闭重开原本的Figma开发插件以加载新构建，桌面重启后重新配对；从长页页尾进入“富文本与字体基准”或访问`/fixture-text`。检查`npm.cmd run check`、`npm.cmd run smoke:text`，旧smoke仍供必要开发回归。没有安装包命令。本轮无Git commit/tag或远程，无新依赖及外部服务写入，全部保存于本地。

下一最小工作：用户按docs/15 TXT01–TXT07比较并编辑真实Figma文字，反馈源样例ID/JSON/报告/截图后优先修本批。随后按用户下一请求推进层叠/裁切或文字剩余子集；Android/安装包/多状态交互未开始。无需重验m2.4及以前。

文档收尾：21份Markdown、118个本地链接和围栏检查通过，结果在本批文字证据目录的`document-check.json`；实际三个开发report分别28/40/17项且全部ok，已核对。

### 2026-10-19 / m2.6层叠与裁切第一批

用户最新授权“继续下一部分吧”。按候选实施M2-07a，不把该表述当作m2.5验收确认；M2-05a仍verification_pending，m2.4及此前user_accepted保持，不重复要求旧验收。

文件与实现：

- 新`apps/desktop/src/stacking.ts`：按上下文归一化常见绘制阶段、稳定z顺序和Flex/Grid项目顺序，提升越过普通祖先的定位后代，保持透明度/隔离组合原子性；重算局部坐标，父级优先输出。
- `capture.ts`：收集上下文、定位包含块与内容裁切信息，双轴overflow改为padding-box/内圆角FRAME；跨祖先提升保留适用的空裁切副本，绝对定位跳过包含块以内不生效的裁切。负层选区背景、上下文背景/边框按绘制阶段拆成原生层。复杂层叠/效果/单轴与隐式contain裁切明确告警。保持原节点/时间预算、检查点与原生文本/资源。
- `converter.ts`生产者m2.6，主协议1.0.0和adapter web-dom-2不变，没有新字段/能力。插件生产代码、桥接与资源接口保持。旧包兼容，但旧JSON需要重新采集才具备新绘制树。
- 新`apps/desktop/fixtures/layers.html`及main路由`/fixture-layers`，原长页页尾仅追加链接；原工作台、长页、文字/视觉与故障页全部保留。13个支持白板及3类复杂边界，默认嵌套滚动快照scrollTop=75。
- 新`scripts/create-layers-example.mjs`、`examples/layers-m2.6.example.json`、build入口；人工样例不当作网页证据。新`tests/stacking.test.ts`及实际插件模拟宿主层级测试，新`scripts/smoke-layers.mjs`/`smoke:layers`检查真实采集、像素/组合及UI保存重开；文字/视觉脚本同步生产者版本。
- README、DESIGN、docs/03/04/05/06/07/08、新docs/16、PROGRESS/HANDOFF/USER-TEST-RESULTS同步能力、边界和待用户状态。

实际命令：`npm.cmd run check`最终83 tests、桌面/插件两套类型和构建通过；`npm.cmd run smoke:layers`最终34项通过。13个支持样例稳定内部颜色抽样最大通道差0/255（容差5，每例至少30通道），比较真实Chromium截图与本地原生场景绘制器，不是全图差分或真实Figma证明。插件主逻辑的模拟宿主验证节点顺序/裁切/圆角/局部坐标和原生可编辑类型。

开发回归：`npm.cmd run smoke:text`28项、`npm.cmd run smoke:visual`40项、`npm.cmd run smoke:full-page`29项通过，含取消/恢复、固定层一次输出、旧成功结果保护与故障页。没有重跑bridge，最近17项属于m2.5历史，不能标本轮结果。测试均结束自身实例，没有实际Figma或字形像素验收。

失败与修复：文字回归初次失败于旧断言要求opacity Frame仍位于原段落后代；实际包保留opacity=.4合成Frame及原文字，绘制归一化正确提升到所属上下文。修正为验证真实合成父级而非原DOM祖先后28项通过；失败包/源图/日志保留在`M2-text/2026-10-19T09-46-42-064Z/`，不覆盖为成功。

最新证据均位于`evidence/2026-10-19/`：层叠`M2-layers/2026-10-19T09-49-30-513Z/`（34项report、13例pixel-comparison、真实全页/多选独立合并/矩形/保存重开JSON、源/场景PNG）；文字`M2-text/2026-10-19T09-47-37-279Z/`28项；视觉`M2-visual/2026-10-19T09-46-50-885Z/`40项；全页`M2-full-page/2026-10-19T09-47-59-825Z/`29项。中间成功运行保留。无本轮真实Figma目标/节点/导入报告。

状态：M2-07a development_complete / verification_pending，LYR01–LYR07由用户按docs/16验证；完整M2-07未完成。多根合并保证各根内部顺序，跨根层叠请选共同祖先/全页；复杂变换/特殊绘制/单轴与隐式裁切仍告警。m2.5 TXT继续待反馈，m2.4及此前无需重验。

运行：`npm.cmd start`重启桌面，从原长页页尾进入“层叠与裁切基准”或访问`/fixture-layers`；原开发插件若仍运行旧构建请关闭重开并重新配对。无新依赖、Git commit/tag或远程、外部写入、安装包或Android开发。下一最小工作：按用户提供的TXT/LYR样例ID、JSON、真实Figma截图/报告复现修复；后续文字/视觉剩余或多状态交互按新请求确定，不重复已有实现。

文档收尾：22份Markdown、132个本地链接与围栏检查通过，证据为本批层叠目录`document-check.json`。核对四份最新实际report分别34/28/40/29项全部ok；13例像素记录最大误差0/255，每例实际最少84个颜色通道。Git仍为本地未提交状态，保留既有全部文件。

### 2026-10-19 / m2.7 SVG与常见图标第一批

用户询问剩余范围后授权“那请继续下一步吧”，按建议实施M2-06b SVG/图标。不将此请求视为m2.5或m2.6已验收；TXT/LYR仍待反馈，m2.4及此前user_accepted保持，不重验旧范围。

文件与实现：

- `packages/contracts/src/svg.ts`新增共享受限XML解析/规范化，基础SVG图形、局部渐变/clipPath、use展开/ID重命名和currentColor继承；拒绝DTD/外链/活动或未知内容，适配插件无DOM/TextEncoder环境。预算为单SVG输入及展开≤256KiB/500元素/32层，整包SVG≤2MiB、检查复杂度加场景节点≤5000。
- `apps/desktop/src/svg.ts`读取内联计算样式、常见描边/填充、CSS路径几何与内部二维变换，本页精灵只复制所需定义；保留实例独立颜色。源DOM不插入临时克隆/不改样式。`capture.ts`生成原生VECTOR并把图标作为完整选择对象，复杂内容W_SVG_UNSUPPORTED整体占位，不转位图；外层样式/层叠与旧规则保留。
- `assets.ts`将SVG根文件及两类data URL固化为node.svg，复用下载/重定向/超时/取消和原图片定位裁切，逐个实例检查平铺。带viewBox时协商实际视口及自身preserveAspectRatio，无viewBox按固有坐标缩放，避免仅拉伸SVG外框。PNG/JPEG assets格式不改。
- `packages/contracts/src/index.ts`与Schema：VECTOR必须声明inline-svg，非VECTOR不得夹带svg，两端创建前执行相同校验，SVG长度上限262144。`converter.ts`生产者m2.7，adapter web-dom-2、协议1.0.0不变。此前实际采集旧包没有VECTOR，继续兼容；手工旧VECTOR需能力声明和新受限校验。
- `apps/figma-plugin/src/main.ts`用规范化SVG及必要坐标包装调用createNodeFromSvg，内部路径随尺寸正确缩放，保留导入根透明度乘场景透明度，设置矢量Frame裁切；保留临时根/旧用户节点保护。传输API和配对方式不改。
- `geometry.ts`在矩形/视口剔除时保守保留overflow:visible的原生SVG，避免只框选视口外路径时遗漏；仍受原生外层裁切与总预算约束。
- 新`apps/desktop/fixtures/svg.html`、`svg-sample.svg`及main路由`/fixture-svg`/`/svg-sample.svg`；旧probe仅追加页尾链接。14个原生矢量、13个视觉白板与明确边界，旧外壳/长页/文字/层叠/故障页保留。
- 新人工`examples/svg-m2.7.example.json`及生成/build入口，新`tests/svg.test.ts`、geometry与实际插件模拟宿主测试，新`scripts/smoke-svg.mjs`和smoke:svg命令。原文字/视觉/层叠脚本仅同步生产者版本断言。
- README、DESIGN、docs/03/04/05/06/07/08、新docs/17及HANDOFF/USER-TEST-RESULTS同步范围、能力和未验收状态；无新依赖。

实际检查：`npm.cmd run check`最终101 tests、两套类型与构建通过。`npm.cmd run smoke:svg`最终51项，13例源页与规范化SVG场景的稳定内部颜色抽样最大通道差0/255（容差5，每例至少738通道）；14个矢量、数据/文件/背景、边界、独立/合并、两类严格矩形与真实UI保存重开通过。底层绘制器仍是Chromium，不是全图差分或Figma原生渲染。实际插件生产代码通过模拟宿主检查矢量调用、内部缩放、根透明度及不安全输入预检；没有真实Figma操作。

开发回归：`smoke:visual`40项、`smoke:text`28项、`smoke:layers`34项、`smoke:bridge`17项、`smoke:full-page`29项通过。直连为真实UI/HTTP加模拟画布，未代操作Figma；全页检查包括固定层一次输出、懒加载/追加、取消/位置恢复、旧成功包保护、导航和三类故障页。收尾SVG专属CSS/透明度/视口外裁切修正由新增单测和最终SVG实际检查覆盖，没有因此重跑所有旧矩阵。

失败与修复：首轮受限check的HTTP测试EACCES，正常权限复测通过；类型检查发现共享模块ES库/空值收窄问题，修正而未改插件环境隔离。首轮SVG断言错误地计算内容区，应为178×89，修正断言。扩展像素检查实际发现带viewBox的fill需保留自身PAR、无viewBox固有坐标需缩放，修复实际资产尺寸链路后13例通过。失败目录`M2-svg/2026-10-19T10-08-19-876Z`、`2026-10-19T10-10-49-508Z`、`2026-10-19T10-11-49-510Z`保留；中间40/50项成功记录不冒充最终51项。

最新证据均在`evidence/2026-10-19/`：SVG`M2-svg/2026-10-19T10-19-48-035Z/`（report、pixel-comparison、真实全页/独立合并/矩形/视口外溢出矩形/保存重开JSON和源/场景PNG）；视觉`M2-visual/2026-10-19T10-13-03-918Z/`40项；文字`M2-text/2026-10-19T10-13-28-889Z/`28项；层叠`M2-layers/2026-10-19T10-13-05-812Z/`34项；直连`M3-bridge/2026-10-19T10-13-28-332Z/`17项；全页`M2-full-page/2026-10-19T10-15-45-288Z/`29项。没有本轮真实Figma目标/节点/导入报告，测试各自结束实例。

状态：M2-06b development_complete / verification_pending；最终SVG01–SVG07由用户按docs/17执行。完整M2-06的表单/伪元素/复杂阴影、SVG剩余标准特性等未完成，m2.5/6继续待反馈。复杂外部样式表、text、filter/mask/marker、活动内容/跨文件use不自动栅格化或二次下载，明确告警保留外框。

运行：`npm.cmd start`重启桌面，从长页页尾进入“SVG与常见图标基准”；关闭重开原开发插件加载inline-svg能力后重新配对，保留JSON文件回退。命令`npm.cmd run check`、`npm.cmd run smoke:svg`，其他smoke供必要回归，无安装包命令。本轮无新依赖、Git commit/tag或远程、真实外部服务写入、Android或安装包开发。下一最小任务：先按TXT/LYR/SVG样例ID/JSON/实际Figma报告修反馈；按下一请求继续常见表单/伪元素或阴影，再推进多状态基础交互。

文档收尾：23份Markdown、150个本地链接与围栏检查通过，结果在最终SVG目录`document-check.json`。六份实际开发report分别51/40/28/34/17/29项，均全部ok；13例像素记录最大0/255、最少738个颜色通道。源页截图已检查，布局/说明清晰。当前代码、构建和记录均落盘，仍未创建Git提交或远程。

### 2026-10-19 / m2.8 表单与生成内容第一批、公网检查

用户授权“继续做下一步吧，我想知道现在可以访问公网上的页面进行转换了吗”。按此前候选实施M2-06c，并实际检查公网HTTPS能力。没有把这句话视作m2.5/6/7验收确认；TXT/LYR/SVG仍待用户反馈，m2.4及此前user_accepted保持，不重验旧范围。

文件与实现：

- 新`apps/desktop/src/appearance.ts`：生成内容字符串解析、绝对定位CSS盒尺寸/边距与右下锚点；常见控件当前value、selectedOptions.label、checked/indeterminate及状态外观。原生widget为可编辑静态近似并告警，复杂类型保留外框；密码只生成圆点，hidden/visibility:hidden/零透明度控件不导出值。
- 控件及生成文字在工具闭合Shadow DOM的隐藏测量元素中按当前字体/宽度/空白规则用Range测量，finally移除，不改源内容/表单属性。textarea按当前scrollTop/Left裁切，完整值行仍保留；不声称原生段落重排或输入交互迁移。
- `capture.ts`接入常见表单和可靠绝对定位before/after的FRAME/TEXT/SHAPE/VECTOR，生成层注册到现有层叠上下文/裁切归一化；普通原生HTML文字继续原读取流程。`geometry.ts`可显式保留可见表单裁切下的完整值行，整个控件不在范围时仍省略；集合仅运行时存在，不新增协议字段。
- `main.ts`新增`/fixture-forms`路由，并按pageEpoch共用脚本安装Promise。导航返回及采集开始等待脚本就绪，避免立即采集遇到未安装的probe；旧页面安装完成/失败不覆盖新页面状态。捕获预算、取消/恢复、页面保护和旧成功包保留不放宽。
- 新`apps/desktop/fixtures/forms.html`，原probe长页只追加页尾入口，工作台/旧长页/其他fixture保留。当前值/placeholder/密码/textarea/select/按钮、disabled/readonly、native/custom勾选和绝对定位生成内容及明确边界分组展示。
- 新`tests/appearance.test.ts`、geometry测试，新`scripts/smoke-forms.mjs`和`scripts/smoke-public.mjs`/命令，新人工forms-m2.8.example.json及生成/build入口。后者不是网页证据。既有smoke text/visual/layers/svg版本断言同步m2.8；converterVersion=m2.8，adapter web-dom-2、主协议1.0.0及所有字段/能力沿用，插件生产代码未改，无新依赖。
- README、DESIGN、docs/03/04/05/06/07/08、新docs/18及HANDOFF/USER-TEST-RESULTS更新能力/边界/待用户状态。公网没有新增模式，仍用原地址栏与现有session，sandbox/webSecurity/contextIsolation保持。

实际结果：`npm.cmd run check`最终109项、桌面/插件两套类型与构建通过；`npm.cmd run smoke:forms`最终36项通过，包含当前值和再编辑后重采集、隐藏值排除、密码圆点、完整textarea值行、静态控件状态、伪元素定位/层叠/裁切、镜像不改源内容/滚动、独立/合并、矩形、UI保存重开，以及250ms脚本读取延迟注入后导航立即转换。3个纯装饰框稳定内部颜色抽样最大0/255（容差5，每例至少564通道），不包含字体/系统widget/全图或真实Figma像素验收。

公网：`npm.cmd run smoke:public`7项实际网络检查通过，打开`https://example.com/`，生成元素/视口/已加载全页原生包并核对浏览器隔离，公网HTTP明确拒绝。该样例为文字页面，没有图片/登录；不证明认证资源、SSO、反爬或所有网站已兼容，不据此完成M3-07。用户现在可输入自己的HTTPS地址、在内置浏览器手动登录后选范围转换。图片仍限PNG/JPEG与受限SVG，WebP/GIF等未完成，缺失有告警；弹出窗口仍禁用。没有使用测试夹具冒充公网证据，也没有运行真实Figma。

开发回归：文字28项、SVG51项、层叠34项通过。全页29项在修复就绪同步后通过，覆盖既有懒加载/追加、fixed/sticky一次输出、取消/恢复、旧成功包、无限/回收/超高页、缩放及导航中断。未重跑本批visual/bridge独立脚本，其历史40/17项属于m2.7，不标成当前新结果。最终表单检查覆盖了就绪同步和隐藏值收尾改动；没有重复所有旧矩阵。

失败与修复：首轮表单检查暴露textarea按显示裁切剔除不可见值行，修正为可见控件完整文字保留；次轮断言未计伪元素content-box边框，实际114×24，修正断言。全页在超高页的立即采集阶段出现通用脚本错误，定向隔离世界读取成功，随后加入安装就绪同步及延迟注入检查；全页与延迟测试均通过。失败目录`M2-forms/2026-10-19T11-14-35-855Z`、`2026-10-19T11-15-46-905Z`及`M2-full-page/2026-10-19T11-19-44-748Z`保留。最早公网运行被中断，仅有视口/全页中间包，不冒充完整7项成功。一次受限CIM读取不可用，正常权限只读检查没有匹配的旧公网测试进程，未终止用户应用。

证据均在`evidence/2026-10-19/`：表单`M2-forms/2026-10-19T11-27-59-427Z/`（36项report、pixel-comparison、当前/更新状态/独立合并/矩形/保存重开JSON与源/场景PNG）；公网`M2-public/2026-10-19T11-14-44-159Z/`7项；文字`M2-text/2026-10-19T11-18-54-459Z/`28项；SVG`M2-svg/2026-10-19T11-18-54-663Z/`51项；层叠`M2-layers/2026-10-19T11-19-46-135Z/`34项；全页`M2-full-page/2026-10-19T11-23-10-494Z/`29项。中间33/34/35项成功也保留，最终以36项为准。测试均结束自身实例，源表单页截图已查看，未生成真实Figma目标/节点/报告。

状态：M2-06c development_complete / verification_pending，FRM01–FRM07用户按docs/18验收；m2.5/6/7继续待反馈，m2.4及此前无需重验。复杂表单/文流伪元素/阴影等仍未完成，完整M2-06/M3/M4不据此通过。

运行：`npm.cmd start`重启桌面，页尾进入“表单与生成内容基准”或地址栏输入公网HTTPS。沿用原插件/manifest，旧构建关闭重开、桌面重启重新配对，文件回退保持。开发`npm.cmd run check`、`npm.cmd run smoke:forms`，公网单次检查`npm.cmd run smoke:public`；其他旧smoke供必要回归，无安装包命令。本轮无新依赖、Git commit/tag或远程、真实外部服务写入、Android/安装包开发。下一最小任务：按TXT/LYR/SVG/FRM样例ID、JSON与实际Figma截图/报告修反馈；后续阴影/其他视觉剩余或多状态交互按新请求确定。

### 2026-10-20 / m2.8 文档收尾核对

24份Markdown、158个本地链接及围栏检查无错误，结果保存在最终表单证据目录的document-check.json。再次核对六份最终实际开发报告：表单36项、公网7项、文字28项、SVG51项、层叠34项、全页29项，均通过。上述开发与证据仍归档于2026-10-19；本日只核对记录，没有代码修改、新增运行测试或真实Figma操作。M2-06c仍为verification_pending，最终Figma验证由用户执行；未创建Git提交或远程。

### 2026-10-20 / m2.9 常见外阴影第一批

用户授权“那继续下一步吧”，按交接候选实施M2-06d，不把继续当m2.5–m2.8验收确认；TXT/LYR/SVG/FRM继续待反馈。m2.4及此前user_accepted保留，无需重复验收，最终新范围Figma仍由用户执行。

文件与实现：

- 新`apps/desktop/src/shadows.ts`解析完整计算box-shadow列表，保留最多16层的前后顺序、色/透明度、偏移、blur及正负spread，长度绝对值≤10000px。内阴影可明确省略而保留受支持外层；未知/超限表达式整体告警，不悄悄只取第一层。
- `capture.ts`和`appearance.ts`复用独立原生背景SHAPE承载DROP_SHADOW。先支持单个矩形盒、不透明底、统一像素圆角和普通合成；父Frame保留opacity与子内容，溢出子元素不参与背景盒阴影，自身overflow只裁内容。生成框已有原生渐变和底色整体移动，避免新增底色层遮住渐变。自行裁切的生成框暂省略阴影并告警。
- `geometry.ts`以保守阴影外延执行范围剔除，保留仅阴影进入矩形/视口的原盒与必要祖先，不扩大原选区、内容clip或布局。零透明/完全收缩的效果不无端扩大可见范围。
- `stacking.ts`收尾补充：单独选择非上下文根且含负层时，将背景与边框分为原生绘制层，负层→背景/阴影→边框→普通内容顺序明确，避免阴影背景形状盖住边框。既有上下文与包含块裁切链继续复用，节点/时间预算保持。
- 插件`main.ts`沿用现有多个DROP_SHADOW映射，显式showShadowBehindNode=false保持原默认；背景形状导入Rectangle以支持spread，不要求父Frame开启clip。主协议1.0.0、adapter web-dom-2、effects字段/16层Schema与能力清单不变；converter=m2.9，旧JSON仍可读，但新绘制树需重新采集。
- 新`fixtures/shadows.html`、main的`/fixture-shadows`路由、原probe长页页尾链接，新`create-shadows-example.mjs`/人工`examples/shadows-m2.9.example.json`/build入口，新`tests/shadows.test.ts`、stacking及实际插件模拟宿主测试，新`smoke-shadows.mjs`/命令。其他旧smoke只同步当前版本断言，层叠脚本另等待默认测试页加载再导航；原工作台布局、长页/全部旧fixture不重做。
- README、DESIGN、docs/03/04/05/06/07/08、新docs/19、HANDOFF/USER-TEST-RESULTS同步范围、边界和待用户状态，无新依赖。

最终`npm.cmd run check`117项、两套类型/构建通过。`npm.cmd run smoke:shadows`34项通过，包含多层与原生参数、子内容分离、overflow/opacity/负层、生成框/渐变、单独选中非上下文边框、源内容/滚动不改、保存重开、独立/合并和仅阴影进入严格矩形。10个零模糊硬边白板稳定内部颜色抽样最大0/255，比较源Chromium与独立Canvas场景绘制，不是blur边缘、字体、全图或真实Figma证明。实际插件主逻辑由模拟宿主验证原生Rectangle、多层效果/顺序及显式knockout参数。

本批开发回归：表单36项、层叠34项、图片渐变40项、全页29项、直连17项通过。全页覆盖既有懒加载/追加、fixed/sticky、取消/位置恢复、旧成功包保护、故障页与导航；直连为真实UI/HTTP加模拟画布。阴影分层收尾的渐变/背景/边框问题由最终阴影与层叠定向复测覆盖，没有重复所有旧矩阵。文字/SVG/公网独立脚本本批未重跑，其最近28/51/7项属于m2.8历史，不冒充当前新结果。

失败与修复：首轮受限check的HTTP测试本机EACCES，正常权限117项通过，安全隔离未放宽。首轮阴影脚本假定归一化后子元素x仍等于原DOM局部x，改为验证样例ID与效果所属；局部像素绘制器漏掉提升层，改为绘制完整场景后裁白板；源截图向外取整后行宽不同，修正索引；中间注释遮住变量声明和新渐变白板无法读取，也修正后通过。上述失败证据保留在`M2-shadows/2026-10-19T15-01-58-042Z`、`15-02-18-423Z`、`15-03-01-864Z`、`15-03-12-540Z`、`15-06-07-296Z`，路径均以`evidence/2026-10-20/`为根。产品代码另外在收尾发现/修正生成框paint整体移动、选中非上下文根的背景/边框顺序，新测试覆盖。中间32/33项成功保留，最终以34项为准。

层叠收尾第一次重跑在采集前因默认fixture尚在导航而出现ERR_ABORTED(-3)，`evidence/2026-10-19/M2-layers/2026-10-19T15-11-15-326Z/`保留空checks失败报告，未称为产品层叠失败或成功。检查器先等待默认测试页load/页尾再导航，随后34项通过；未放松断言或吞掉业务错误。

最终阴影证据`evidence/2026-10-20/M2-shadows/2026-10-19T15-11-15-324Z/`，含report、pixel-comparison、源页/白板/场景PNG及实际全页、单独带边框选区、独立合并、矩形、保存重开JSON。时间戳为UTC，归档本地日期为20日。回归仍沿用旧脚本目录`evidence/2026-10-19/`：表单`M2-forms/2026-10-19T15-01-59-500Z`36项、图片渐变`M2-visual/2026-10-19T15-04-59-281Z`40项、全页`M2-full-page/2026-10-19T15-04-59-474Z`29项、直连`M3-bridge/2026-10-19T15-04-58-862Z`17项；最终层叠路径见本节收尾核对。源码页截图已检查，测试仅结束自身隔离实例，没有真实Figma目标/节点/导入报告。

状态：M2-06d development_complete / verification_pending，SHD01–SHD07按docs/19由用户执行。透明底/复杂轮廓/内阴影/文字与filter阴影仍未完成，完整M2-06不据此通过。公网HTTPS能力保留，本批未新测网络或登录站。m2.4及此前不重复验收。

启动`npm.cmd start`，长页页尾“外阴影视觉基准”，或输入原公网HTTPS。同一开发插件manifest/ID，关闭重开载入新构建，桌面重启后重新配对，JSON回退保持。新命令`npm.cmd run smoke:shadows`，常规`npm.cmd run check`；无安装包命令。本轮无新依赖、Git commit/tag或远程、真实外部服务写入、Android/安装包开发。下一候选为同页多状态采集与基础原型连线薄链路，先按新反馈修复，视觉剩余未全部完成，按下一请求确定。


收尾层叠定向复测34项通过，最终路径`evidence/2026-10-19/M2-layers/2026-10-19T15-11-58-002Z/`。首次本批层叠成功路径也保留；更新交接中的当前数字为117自动测试/34阴影检查。最终阴影另含单独带边框且有负层的选区包，源页截图已核对，既有工作台没有改动。

文档收尾：25份Markdown、171个本地链接及围栏检查无错误，结果存入最终阴影目录document-check.json。核对最终六份report分别为阴影34/表单36/层叠34/图片渐变40/全页29/直连17项，全部ok；10个硬边像素样例最大0/255，每例最少7977个颜色通道。最终源页截图已查看，当前代码/构建/说明及证据均落盘；没有新运行的真实Figma验证或Git提交。

### 2026-10-20 / Windows桌面交付收尾（中间记录，最终见后文）

用户授权“那请直接把剩下的都补齐吧”，随后明确“就用本地来验证吧”。范围为Windows首版：多状态/手工原型、历史与视口/会话设置、有限Auto Layout、WebP/GIF静态固化、开放ShadowRoot/插槽、有界队列/分块/日志/缓存、ZIP、Windows分发及完整本地开发检查。Android和真实Figma操作不在本次代执行范围，最终Figma仍由用户完成；不重验m2.4及更早用户已接受范围。

当前新增project/storage/workflow-ui/archive/encoding/layouts/raster/composed/logging模块，已接入主进程、preload、现有工作台与插件。app0.1.0 / converter desktop-1.0 / adapter web-dom-2 / Schema1.0.0，新增auto-layout能力，旧包兼容。131项自动测试、类型和构建通过，含20次实际插件主逻辑的模拟宿主导入；早期本地完整流程20项及100次实际采集通过。新增开放组件、压缩ZIP、多分块、本地登录检查正在复测，Windows分发脚本/交付说明与最终归档尚在收尾，不能标开发或用户验收完成。

当前证据：Desktop-completion/2026-10-19T16-09-21-930Z早期20项；Desktop-stress/2026-10-19T16-15-28-045Z连续100次；以上归于evidence/2026-10-20。新增完整流程在Desktop-completion/2026-10-19T16-15-28-038Z之后还有新运行，以最终report为准。固定视口390内有滚动条时可编辑内容宽度为documentElement.clientWidth，检查器已按实际内容宽度核对，保留此前失败记录。

### 2026-10-20 / Windows首版开发与交付完成（最终记录）

用户“直接把剩下的都补齐”并选择“就用本地来验证吧”。本批Windows首版0.1.0候选支持范围内开发完成，最终Figma仍由用户执行；使用见docs/20、结果见docs/21。中间实施中记录保留，不代表最终仍有安装包/ZIP/多状态工程待做。

134项自动测试、两套类型/构建通过。安装副本完整本地流程30项，100次真实Section采集（4544ms总计/P95 52ms/最大97ms，历史20条540608字节），20次实际插件主逻辑模拟宿主导入及40条reactions通过。当前bridge19、全页29、文字28、SVG51、图片渐变40、层叠34、表单36、阴影34、多选29、视口/矩形17、Section13项实际检查均通过；实际路径和完整F01–F16/降级矩阵见[docs/21](21-desktop-release-verification.md)，机器可读汇总[development-verification.json](../evidence/2026-10-20/Desktop-release/2026-10-19T16-43-47-273Z/development-verification.json)。

多状态同/跨URL不可变快照、重排/删除、点选/原生热点及navigate/open_overlay/close_overlay；有界历史/项目备份恢复、CSS视口/会话清理；开放ShadowRoot/slot、WebP/GIF沙盒静态PNG、CSS动画暂停恢复、可靠Flex可选原生Auto Layout；真实JSON/Store/Deflate ZIP；FIFO5个/100MiB、256KiB分块SHA/30秒租约、原子任务落盘与回执重试、日志3×约1MiB均落盘。保持主协议1.0.0，新增auto-layout能力，旧包可读，旧插件关闭重开。无新依赖，保留原工作台/长页和可编辑层。

Windows运行包与源码基线归档路径/摘要分别在release/latest-windows.json、latest-source.json。实际Install.ps1复制到.runtime/install-check-final/0.1.0（NoShortcut），使用空cwd/新数据/仅系统PATH通过完整流程并重启恢复；最终封装运行文件另做摘要比对。分发含应用/Electron、独立FigmaPlugin、使用/恢复文档、许可和SHA清单，未签名/无商店发布。不含用户项目、证据或node_modules开发目录。无Git commit/tag或远程。

失败留痕：早期截图超时保留Desktop-completion/2026-10-19T16-35-06-448Z，28项业务已通过仍不当作最终成功；检查器改用原生截图后30项通过，显示窗口补拍新合成帧并已查看。cp预建空目录、早期clientWidth/隐藏控件/模拟revision检查问题保留，完整说明见docs/21。没有新增公网或真实Figma操作；m2.4及此前无需重验，m2.5–m2.9和REL仍verification_pending。下一步按用户真实Figma报告/截图修反馈，Android按既有后续入口另行授权。

归档后最终核验：Windows ZIP为 `E:\WebToPrototype\release\WebToPrototype-0.1.0-win-x64-2026-10-19T16-44-03-047Z.zip`（159606696字节），SHA-256 `39c114c70f971a2bbe76d07ad7357536875712c3b1da33a4e84ca49541606712`；源码基线为 `E:\WebToPrototype\release\WebToPrototype-0.1.0-source-2026-10-19T16-44-43-731Z.zip`，SHA-256 `d07b90f345754113b402816dfecea48a8cc34fd1b1466ba9f974bb17198d6def`。实际解包158项摘要全匹配，110个运行文件与完整30项流程安装副本一致，最终ZIP独立启动/隔离/本地原生转换等5项通过。27份Markdown、210个本地链接和围栏无错误；明细在 `evidence/2026-10-20/Desktop-release/2026-10-19T16-43-47-273Z/distribution-integrity.json` 与 `document-check.json`。归档后的核验结果另存证据，不回写已校验ZIP。无真实Figma、Git提交或公网新验证；REL仍待用户。

### 2026-10-20 / BUG-002 全页转换发送误报 E_LAYOUT_CHANGED

用户报告capture-send抛出E_LAYOUT_CHANGED，补充采集范围为“整个页面”；未提供地址。仅在本地长页添加随滚动更新的固定位置文字即可复现，原失败记录为`evidence/2026-10-20/BUG-002-layout/2026-10-19T17-08-32-858Z/reproduction.json`。不把本地复现声称为用户站点已验证。

根因：原生场景同步读取完成后，生成源参考/恢复原滚动位置会触发页面普通DOM更新。旧代码仍将contentRevision或文档高度变化当作场景无效，导致可编辑快照已生成却整轮失败。

修复：capture.ts的layoutMatches增加可选内容校验，默认严格，选区/视口行为不变。main.ts全页先校验选择/视口/缩放，快照后的内容变化只记录W_PAGE_CHANGED_AFTER_SNAPSHOT；每张参考前后都检查内容，遇不匹配停止生成后续参考，保留此前匹配的段。快照后新增内容不写入旧场景。导航/取消/虚拟列表、真实窗口/缩放/选择变化继续中止；旧成功包、滚动/动画恢复、资源预算继续。无协议字段、能力、依赖或插件接口变化。

验证：134项自动测试、桌面/插件类型与构建通过，新增`npm.cmd run smoke:layout-changes`10项通过（`evidence/2026-10-20/BUG-002-layout/2026-10-19T17-10-11-772Z/report.json`），包括恢复滚动文字、准备/分段文字、时钟、快照后增长、真实缩放拒绝与旧结果保留，以及实际capture-send按钮发送到模拟HTTP接收端。原全页29项`evidence/2026-10-19/M2-full-page/2026-10-19T17-10-12-019Z/report.json`、真实插件UI/HTTP与模拟画布直连19项`evidence/2026-10-19/M3-bridge/2026-10-19T17-11-29-660Z/report.json`通过。原取消、导航、预算、懒加载和原生固定层均保留。本次没有真实Figma或公网测试，BUG-002状态development_fixed / user_retest_pending；m2.4及此前不重验。

修复后的Windows候选仍为0.1.0，按新时间戳分发与SHA区分，latest-windows/latest-source指向本次归档。最终实际解包程序的定向检查与摘要另存BUG-002证据，归档后核验记录见后文；不覆盖旧已校验包，也不把旧安装30项/158-110比对冒充新运行。

BUG-002归档后核验完成：实际从修复ZIP解包启动，新增定向10项全部通过（`evidence/2026-10-20/BUG-002-layout/2026-10-19T17-14-06-120Z/report.json`），包含实际capture-send按钮；158个归档文件摘要匹配，main/capture/preload/renderer与当前构建一致，源码关键文件与修复基线一致。27份Markdown/210个本地链接/围栏检查无错误；汇总和check.log在同目录verification.json。Windows ZIP `E:\WebToPrototype\release\WebToPrototype-0.1.0-win-x64-2026-10-19T17-13-26-348Z.zip`，SHA-256 `a0c7025617e7aab1ec4e2d3a8daf2ef5a5c4000679186a2e8cb0b5ccc75b8ba3`；源码 `E:\WebToPrototype\release\WebToPrototype-0.1.0-source-2026-10-19T17-14-03-878Z.zip`，SHA-256 `cdbcca02eaed0591ea64e7797d943e215b6bb7e3716ec9abb984ae3f2d97db37`。源代码和用户说明已更新，归档后证据单独保存，不回写已校验包。用户应关闭旧桌面、运行此修复构建并重新配对，只复验本次全页发送；Figma插件代码未变，无需重做旧范围。BUG-002仍为user_retest_pending，没有真实Figma验证或Git提交。

### 2026-10-20 / macOS Apple Silicon 源码准备，检查待额度恢复

用户授权“帮我再做一套mac端”，选择“Apple Silicon（M系列）”；自动审批遇用量限制后，用户确认“恢复额度后继续检查并打包”。本轮新增范围已授权，Android仍后续，不把当前中断当作用户取消或已完成Mac交付。

源码：新增platform.ts处理Mac红色关闭隐藏、Dock恢复、真正Quit以及原生菜单，接入main/preload/renderer的Command+L地址聚焦；Windows重复启动也补show以恢复隐藏窗口。工作台字体加入Apple系统字体，插件字体解析加入SF/Helvetica/PingFang/Menlo/Apple Color Emoji候选并保留替代诊断。doctor去除Mac执行cmd.exe与Windows字体路径的假定，历史Windows真实Figma证据不推断成Mac验证；工作流smoke系统PATH及source归档支持Darwin。

分发准备：package-macos.mjs/py共享当前应用、插件和fixtures，默认arm64，Intel独立可选；通过@electron/get5.1.0（已存在依赖现直接精确锁定）取得官方Electron44.9.0，两份运行时已下载并按npm附带SHA校验。Python ZIP构建保留Unix可执行位/Framework相对符号链接，验证Mach-O CPU、运行时SHA和路径，重写应用/Helper标识，加入W图标、说明、许可和SHA清单。mac-tools提供本机开发签名/校验、ditto和hdiutil DMG流程，不自动公证、不关闭Gatekeeper、不删除隔离属性、不要求sudo。开发打包需Python3.10+，最终Mac用户不需要Node/npm/Python。

检查状态：首次npm run check在新增测试的Font.lineHeight类型错误处停止，已修正。再次完整check要求提升权限以运行原本含本机HTTP的测试，自动审批服务返回“usage limit / review could not be completed / not a determination unsafe”，命令未执行；没有改为低权限绕过该拒绝。新增7个TS测试和5个Python结构测试源码已准备，但尚未完成检查/构建/运行，不能填写141或其他通过次数。已有134项及Windows包属于此前基线，不冒充本轮新结果。当前没有可交付Mac ZIP/DMG，没有真实Mac、签名、公证、Retina或Figma操作。

续接：恢复相关额度后执行npm run check、npm run test:mac-package、npm run package:mac；检查实际arm64包的CPU/Info.plist/模式/链接/摘要与无用户数据，跑受影响Windows开发回归；Mac原生MAC01–MAC08另行完成。检查/原生准备步骤见docs/22，状态证据evidence/2026-10-20/Mac-port/source-preparation/status.json。若Mac检查发现签名/工具差异先修再交付，不将脚本存在当作支持证明。旧Windows发布包、用户项目及已接受范围不覆盖，无Git提交或远程发布。

### 2026-10-20 / Apple Silicon Mac候选交付与开发检查完成

用户“继续吧”恢复已授权的M系列任务。141项自动测试、两套类型/构建通过；6项Python结构检查通过，包含官方Framework的多级链接/环/越界、CPU和哈希不匹配、元数据替换拒绝。Windows真实Electron文字28项、完整项目29项、平台菜单命令4项通过：地址聚焦/整段选择、未知命令拒绝、源页无桥接、原生转换仍可用。Mac生命周期菜单/字体7项为模拟/算法测试，不是真实Dock/签名/字体效果证明。

实际darwin-arm64 ZIP包含完整Electron44.9.0、WebToPrototype.app、应用/插件/fixtures、本机准备命令、许可和SHA清单；最低macOS13。主包1.0.0/应用0.1.0/converter desktop-1.0沿用，BUG-002修复保留。独立检查实际ZIP的Mach-O CPU、可执行位、所有文件CRC/SHA、14个Framework链接链/循环/目的地，以及应用资源与当前构建逐文件一致性；具体摘要、大小、数字与最终包路径以latest-macos-arm64.json和[Mac验证](23-macos-verification.md)为准。

源码/本机工具：platform.ts保留Mac关闭隐藏/Dock恢复、Quit与原生菜单；preload/renderer接入Command+L，工作台/插件新增Apple字体候选。doctor/工作流PATH/源码归档支持Darwin；Python标准库用于跨主机保留Unix链接，不替换Windows Electron运行时。Mac本机准备按Apple建议由内向外签名再递归校验；DMG使用Mac的ditto/hdiutil，未在Windows冒充执行。不自动公证或上传Apple服务，不修改Gatekeeper/隔离属性；最终Mac用户不需要Node/npm/Python。

失败：Python测试初始使用沙箱临时目录导致WinError5，改为项目.runtime/mac-package-tests后通过。第一次实际打包错误地只检查Framework链接直接路径，不能解析Versions/Current链；补逐级解析与循环拒绝后实际包通过，初始不完整ZIP保留但未更新latest。Git Bash沙箱MSYS对象受限，正常权限仅作bash -n语法核对，两脚本通过；未执行Mac签名。证据归档[本轮目录](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/)，初始失败日志/检查日志保留，不改写成通过。

开发状态：Mac适配/归档development_complete / native_verification_pending。仅M系列生成候选，Intel保留可选脚本，不宣称已发布/验证。MAC01–MAC08由Mac本机与用户Figma执行，原Windows已接受范围不回退、不重验。没有新增公网或真实Figma操作、Apple账号/证书、公证、Git提交/远程。签名后的DMG和正式面向普通用户发布仍需Mac环境/身份；本轮交付开发候选ZIP。

Mac候选最终归档：E:\WebToPrototype\release\WebToPrototype-0.1.0-mac-arm64-2026-10-20T02-05-03-382Z.zip（135227929字节），SHA-256 fd8e2e605c48d8598297a2cac8cb25cce8de996a4d6c0a21bf27303ac224b5a6。实际629个条目、318个内容文件摘要、14个Framework链接和32个应用资源与当前构建匹配；机器可读证据evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/verification.json，说明docs/22，开发验证docs/23。源码基线、文档链接/围栏核对在归档后继续保存，不回写已校验ZIP。Mac原生运行/签名/Figma仍待用户，未生成DMG。

Mac归档后收尾：源码基线 E:\WebToPrototype\release\WebToPrototype-0.1.0-source-2026-10-20T02-07-09-379Z.zip，SHA-256 6aac6fc6ed97dcabb520feadc555de4cde98033d90fa486ceb1dcdd2a463f478，关键源码与当前工作区一致；29份Markdown、237个本地链接及围栏检查无错误。两份源shell脚本与实际ZIP中的Prepare Mac.command均通过bash -n；只做Windows语法检查，不是Mac签名。实际包的W图标已从ICNS读取PNG查看，仅是资源检查，不证明Dock显示。证据在 evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/verification.json 与document-check.json。源码压缩首次受PowerShell沙箱授权管理器限制，正常权限归档通过，失败日志保留。最终原始Mac ZIP与源码基线已校验，不回写；没有真实Mac/Figma、公证、Git提交或远程发布。下一步按docs/22在Mac执行MAC01–08并记录反馈。

### 2026-10-20 / BUG-003 Mac准备路径修复

用户日志确认Prepare在缺少应用目录检查时退出，codesign尚未开始。入口原先只支持同目录应用，用户实际.app位置尚未确认。新增已安装位置查找/显式路径、歧义与残缺拒绝、目标路径和日志留存、spctl单独诊断，打包器改用独立脚本源码并核验脚本字节/换行。此次未改动转换器、应用或插件代码，不重做已接受Windows/Figma验收。

2026-10-20 BUG-003实际归档：[WebToPrototype-0.1.0-mac-arm64-2026-10-20T03-05-40-044Z.zip](../release/WebToPrototype-0.1.0-mac-arm64-2026-10-20T03-05-40-044Z.zip)，135230549字节，SHA-256 `f8d29f68fb433e9a941991c7d598e5ef2439054048acbc5c0f02ca221b1a1b3a`。独立检查630条目、319内容文件、14个Framework链接、37份构建/准备工具源码匹配；旧新.app内304份内容逐字节摘要一致，仅修改应用外准备工具与说明。6项Python、9项Bash路径回归、5脚本语法通过；证据[verification.json](../evidence/2026-10-20/BUG-003-mac-prepare/2026-10-20T03-06-31-517Z/verification.json)。真实Mac签名、系统策略、启动及损坏提示解除仍未验证，BUG-003为user_retest_pending。没有Git提交。

### 2026-10-20 / 移动端网页与原生App双平台详细计划

用户要求Expo移动端支持网页与原生App，并明确Android/iOS同等优先，覆盖历史Android优先安排；已提供iPhone16Pro，系统版本未提供，Android真机与Mac/Xcode签名待核实。本轮完成docs/25的14部分详细计划：能力分级、用户流程、Expo与本地模块职责、两端系统采集API探针、OCR/形状及重复文字背景问题、原始包与最终协议兼容、扫码固定公钥HTTPS/分块幂等恢复、预算、MOB-00–08阶段、四组合传输与真实Figma验收、风险和官方来源。单工程师核心38–63工程日，另预留10–20工程日风险缓冲，MOB-00后重估，不是日期承诺。

同步README、HANDOFF、产品/架构/协议入口、roadmap、ADR-028和用户结果。31份Markdown、257个本地链接、围栏、14节完整性与阶段估算合计检查通过；证据evidence/2026-10-20/Mobile-planning/document-check.json，检查命令python .runtime/check-mobile-plan.py。仅文档规划，未运行移动端/真机/Figma测试，未安装依赖、修改Schema/桌面行为、开启LAN服务或创建移动工程；没有Git提交。现有桌面整体用户接受保留，专项证据缺口不补造。下一项最小任务MOB-00：双平台WebView/OCR/系统采集与证书固定传输探针，待用户指示开始实施后执行。

### 2026-10-20 / 基于真实Expo仓库的移动端新对话文档包

用户要求生成详细计划，供稍后新对话实际开发。已将当前移动端执行入口整理至MobileApp/webapptoprototype/docs：README、APP-PLAN、ROADMAP、PROTOCOL-DRAFT、DESIGN、ACCEPTANCE、HANDOFF、PROGRESS共8份，30项首版任务；HANDOFF内有可复制提示词。Android/iOS同等优先，复用现有Expo58独立项目和用户EAS关联；手机原始包/桌面最终包分离、版本化契约产物避免仓库外运行依赖。父docs/25保留首轮讨论并指向移动文档，父README/HANDOFF/当前结论同步。

检查：本轮tsc --noEmit仍有原模板3处错误；lint交互选择No，报告ESLint未配置，随后终止进程；未安装依赖，不虚构通过。合并41份Markdown/296本地链接/围栏及阶段估算核对无错，49份源码/配置/素材、53份原暂存内容及分支/origin一致。证据MobileApp/webapptoprototype/docs/verification/2026-10-20-document-check.json；本机文档核对node .runtime/check-mobile-handoff.mjs。没有移动功能、Schema、app.json/锁文件/src变化、真机/Figma测试、Git提交或推送。新对话从MOB-BASE-01–04修工程基线，再MOB-00a–e验证两端原生采集与加密传输；缺设备只保留相关验证，不阻止独立开发。旧桌面接受范围保留。

### 2026-10-21 / App 引导采集增量（MOB-05A/05I）

用户授权落地状态指引、目标 App 采集、返回预览和直接发送。移动实现三步主流程、单张默认、手势框选/实际裁切、同画面保存回执复用、其他帧/批量/项目按需展开。Android 悬浮按钮触发新单帧并停止共享；iOS 系统停止后默认最后候选，原生前后台标记跳过本应用，进程锁判断存活。一次性内存发送请求使已连接时直接发、未连接配对后继续发，普通入口/外部链接不触发自动上传。修正自定义模块/CNG的Swift语言模式5.0。详见docs/30与移动PROGRESS第13节。

检查移动verify：契约、lint、类型、57测试及app.json/53暂存保持性通过；证据evidence/2026-10-21/MOB-guided-app-capture。Android/iOS原生编译、权限/悬浮/广播/手势/手机直传及Figma仍待用户，不把逻辑测试计为真机通过。桌面源码/协议未改，本批不重验旧桌面。没有新依赖、手机构建、提交/推送或Apple项目变更。用户可先Expo Go导入单张截图验证预览/框选/发送；原生路径待后续既有Expo构建流程。

### 2026-10-21 / Expo Go采集体验

用户希望先在Expo Go看效果再决定构建。移动系统采集不可用时增加“体验采集流程（无需打包）”：可浏览商店/待办示例，进入详情/勾选，真实ViewShot截图示例View→既有预览/手势裁切→真实保存/扫码发送/电脑转换，也可换用户自己的截图。示例按imported_image且名称/告警标记来源，不声称实际跨App。详见docs/31及移动PROGRESS第14节。

移动verify契约/lint/类型/57逻辑测试及保持性通过；未运行手机ViewShot/手势/传输或Figma，待用户反馈。证据evidence/2026-10-21/MOB-expo-go-demo。没有原生修改、新依赖、app.json/EAS/暂存变更、构建、提交或推送。原生系统采集待安装包验证，体验模式不替代该证据。

### 2026-10-21 / MOB-UI-01 框选滚动冲突

用户反馈Expo Go体验框选时整页移动、选框不稳定/偏小。移动共用Picker已改独立全屏原生Modal与草稿确认/取消，画布无滚动，局部起点仅按下读取，后续按固定根坐标位移计算。演示与真实素材同获修复。移动verify的58逻辑测试、lint/类型/契约与保持性通过；隐藏RNWeb实际组件五项交互检查通过，iPhone复验仍待用户。证据evidence/2026-10-21/MOB-crop-gesture，详情移动PROGRESS第15节。没有桌面代码/原生/配置/依赖改动或构建、提交、推送。

### 2026-10-21 / MOB-UI-02 安全区

用户截图显示 iPhone 框选标题与状态栏重叠，已把 Provider 移入独立 Modal 原生视图树；新增共用 SafeAreaSurface/SafeAreaModal，覆盖移动 Screen、网页工作台、诊断页及无 tab 页底部。滚动/WebView 禁止二次 inset；新增后续页面约束和 lint 负向回归。移动 verify 的59测试与保持性通过，受控原生测量事件下实际 RNWeb 安全区组件九项检查通过，真实 iPhone/Android 仍待用户刷新复验。详见移动 PROGRESS 第16节/USER-VERIFICATION 与 evidence/2026-10-21/MOB-safe-area。纯 JS，无依赖/SDK/原生/app.json/EAS/暂存改动，未构建/提交/推送。
