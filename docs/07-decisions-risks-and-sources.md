# 07 决策、风险、待验证项与资料

### ADR-028：Expo双平台移动采集与分级还原（2026-10-20）

状态：用户确认范围，技术方案proposed，未实施。用户要求网页和其他原生App均可采集，并明确Android/iOS同等优先，覆盖既有Android优先安排。已提供iPhone16Pro，系统版本及Android设备待核实。采用Expo Development Build共享应用逻辑，平台原生模块处理系统采集；网页DOM重建与原生像素/OCR/可选无障碍辅助分开验收。

具体阶段、来源与API版本见[25 移动端计划](25-mobile-web-and-native-plan.md)。[Expo原生扩展](https://docs.expo.dev/workflow/customizing/)、[Android MediaProjection](https://developer.android.com/media/grow/media-projection)、[Apple iOS屏幕采集样例](https://developer.apple.com/documentation/screencapturekit/capturing-screen-content-on-ios)为技术依据；Apple当前样例有iOS27要求，不推断现有设备已可用。先完成两端真机/SDK可行性探针，原生截图导入不冒充系统采集通过。

传输建议独立LAN接收、二维码配对绑定公钥、原生网络模块校验TLS、文件回退；原始素材由桌面归一化，现Figma回环服务不对LAN开放。当前source.kind固定web，原生来源需新的严格协议与旧包兼容评审。屏幕像素无法证明原始层级/字体/资源；不完整可编辑区域保留图片并报告，OCR不能只叠在完整底图上虚报可编辑。

本轮只落盘计划及交接，不创建移动项目/云服务、安装依赖、请求设备权限或改变桌面功能。开发工期为范围估算，MOB-00后重估；公开发布条件与内部可运行分开。

### ADR-027：Apple Silicon Mac端共享核心与独立分发（2026-10-20）

用户已明确授权Mac端并选择M系列，覆盖此前“当前只做Windows”的范围限制；Android仍后续。共享采集/转换/项目/协议，新增Mac窗口隐藏/Dock恢复、原生编辑菜单、Command+L、系统字体候选及独立.app ZIP。Windows原有布局与已接受范围保留。

依据[Electron分发规范](https://www.electronjs.org/docs/latest/tutorial/application-distribution)，.app使用Contents/Resources/app；跨主机归档保留Mach-O架构、Unix权限及Framework相对符号链接，不在Windows解出或重建这些链接。使用已锁定Electron44.9.0官方SHA运行时。开发打包增加Python标准库依赖，运行Mac应用不需要Node/npm/Python。

依据[Electron签名要求](https://www.electronjs.org/docs/latest/tutorial/code-signing)与[菜单角色](https://www.electronjs.org/docs/latest/api/menu-item)，本机准备脚本与DMG制作仅在Mac执行；跨构建ZIP不等于已签名/公证或能正常运行。默认本机ad-hoc仅供开发，正式Developer ID/Apple公证与原生测试另记，不自动上传服务或更改Gatekeeper。命令、边界与MAC01–08见docs/22。

续接后141自动测试、类型/构建、6项归档规则及相关Windows回归通过，已生成并静态核验实际M系列开发候选ZIP。此前额度阻塞和初始失败按历史保留；未执行真实Mac/Figma、原生签名/公证或Git提交，不能把代码/结构验证当作Mac运行证明。签名采用[Apple建议的由内向外流程](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)，最终在Mac本机验证。

版本：v1.1｜检索核实日期：2026-10-18；实施核实更新：2026-10-19（Australia/Sydney）。

## 1. 已由用户确认的产品决定

| ID | 决定 | 来源 |
|---|---|---|
| U01 | 自行开发，目标接近 html.to.design 的可编辑转换效果 | 用户已使用该工具，希望减少付费服务依赖 |
| U02 | 独立桌面程序，网页使用内置浏览器访问和采集 | 用户复述并确认理解该路线 |
| U03 | 支持整页，也支持 Section 和自由框选 | 用户明确要求较高转换自由度 |
| U04 | 后续移动端优先 Android App | 用户对移动端优先级的明确答复 |
| U05 | 先做纯桌面端，验证自建插件的可用性和稳定性 | 用户本轮要求 |
| U06 | 先完成足够详细、可持续追踪进度的方案 | 用户本轮交付要求 |

“纯桌面端”在此解释为 Windows 主程序 + Figma 桌面开发插件，不在本轮开发 Android 手机客户端。若用户以后给出不同含义，应追加决策并更新范围。

## 2. 推荐技术决定（可通过验证修订）

### ADR-001：桌面宿主采用 Electron

状态：proposed。原因：直接承载 Chromium 页面并读取其真实布局，便于现有前端技能开发。成本：分发体积、内存与任意网页隔离责任。Tauri 依赖系统 WebView，浏览器行为一致性和采集细节需要额外验证，因此不是当前首选。M0 失败可重评，不同时维护两套宿主。

### ADR-002：采用 WebContentsView，应用与目标网页分离

状态：proposed，API 已核实。原因：避免把外部页面加载到拥有本地应用能力的同一 UI 上下文。选择浮层放在目标页面隔离容器中；原生视图遮挡和焦点 M0 实测。

### ADR-003：自行实现规则转换，AI 不作为基础依赖

状态：accepted-as-scope。核心无需付费转换 API；先处理 DOM、样式和资源。AI 以后可辅助命名与重建，但必须有独立成本、数据和失败说明。本决定不承诺达到商业转换器全部兼容性。

### ADR-004：文件导入是可靠基线，本地桥接是增强

状态：proposed，待 M0。原因：Figma UI 到本机服务的可达性受实际运行环境影响，不能把连接实验变成整个项目唯一入口。文件链路先完成；桥接可以延后，但应记录用户接受的范围变化。

### ADR-005：使用 Figma Classic Plugin API 写图层

状态：accepted-as-route，待实测。本轮不依赖 Figma AI、MCP capture、非公开剪贴板格式或直接生成 `.fig`。Classic 插件可本地开发和加载；普通 REST API 不是本轮的图层写入路径。运行插件需要用户打开可编辑文件。

### ADR-006：先几何保真，再选择性 Auto Layout

状态：proposed。优先原生图层和正确位置，简单 Flex 才提升为 Auto Layout；复杂 Grid/定位保持绝对布局。自动组件识别与库绑定延后，防止为“设计系统”改坏原页面。

### ADR-007：局部图片降级透明披露

状态：accepted-as-quality-rule。复杂绘制允许 rasterized；普通文字/形状优先原生。报告区分 approximated、rasterized 与 missing。不能把缺失对象计成正常图片转换。

### ADR-008：快照不可变，默认重导入为新副本

状态：proposed。不做第一版增量覆盖，避免破坏 Figma 手工编辑。导入幂等按 importId 判断，允许同捕获新副本。真正更新旧设计需要后续冲突策略。

### ADR-009：手动状态与交互先于自动录制

状态：proposed。先保证用户选择的 A/B 状态与目标连线准确，再探索动作记录。一次观察不能证明所有业务分支，不能直接把网页所有逻辑等价搬到普通 Figma 原型。

### ADR-010：本轮仅 WebCaptureAdapter

状态：accepted-as-scope。统一协议中保留 source.kind 和 fidelity，为 Android 留入口；现在不安装 ADB/Appium，不开发占位 Android 功能。WebView 内容只有在可调试时才可能走 DOM 路线，原生视图另需控件树与图像重建。

## 3. 待验证的关键问题

2026-10-19 状态更新：Q01 已通过真实插件写入证明；Q02 已证明 localhost health 可达，实际 Origin=null，配对/认证未实现；Q03 基础元素点选与事件恢复通过，其余选择专项待测；Q04 正常中文字体通过，强制替代未测；Q06 失败清理已有证据，主动取消、Undo/崩溃仍未测。表中保留原问题用于追踪完整验收。

| ID | 问题 | 验证方式 | 影响 |
|---|---|---|---|
| Q01 | 本机是否有可用 Figma 桌面、可编辑文件、开发插件权限 | M0 环境和实际加载 | 没有就无法证明导入可用 |
| Q02 | 插件 UI 是否能访问回环 HTTP，实际 Origin/CSP 是什么 | 最小带鉴权探针 | 决定实时桥接或文件回退 |
| Q03 | WebContentsView 内选择浮层能否正确命中、缩放、取消 | 本地交互夹具 | 决定选择器承载方式 |
| Q04 | 中文/网页字体在 Figma 中如何匹配，缺字如何发现 | F02/F03 与本机字体清单 | 视觉和编辑性质量 |
| Q05 | 带 cookie/blob 的图片资源能否固化 | F11 | 登录页面兼容性 |
| Q06 | 导入取消、插件关闭、Undo 实际行为 | M0-07 和故障注入 | 防止污染原文件 |
| Q07 | 目标用户 demo 的主要布局/动画/组件是什么 | 用户实际页面样本 | 兼容优先级，不阻断本地 fixtures |
| Q08 | 个人/团队 Figma 套餐允许哪些原型动作 | 实际文件播放 | 避免越过套餐承诺 |
| Q09 | 5,000 节点、50 MiB 等预算是否合理 | M2/M3 压测 | 调整性能门槛与分包策略 |
| Q10 | 第三方 SSO 是否接受嵌入环境登录 | 测试站点 | 需要浏览器扩展时另开后续任务 |

未知项保持未知。文档存在不能代替验证结果；发现证据后在 PROGRESS 记录，并把对应决策由 proposed 改为 accepted/rejected/superseded。

## 4. 风险与降级策略

| ID | 风险 | 等级 | 控制/降级 | 归属阶段 |
|---|---|---|---|---|
| R01 | Figma 本地桥接被阻止 | 高 | M0 先探针，文件导入为基线 | M0/M3 |
| R02 | 原生视图浮层遮挡或事件穿透 | 高 | 页内工具层；专测焦点与恢复 | M0/M2 |
| R03 | 任意页面接触主进程权限 | 高 | 独立进程/会话、窄 IPC、数据验证 | M0 起 |
| R04 | 字体缺失导致换行和尺寸漂移 | 高 | 字体预检、替代报告、独立视觉评分 | M1/M2 |
| R05 | CSS 覆盖范围膨胀 | 高 | 兼容矩阵、最小区域图片、版本化规则 | M2 |
| R06 | 图层导入中断污染文件 | 高 | 临时根所有权、清理、残留检测 | M0/M3 |
| R07 | 框选裁到父级上下文导致外观变化 | 高 | 保存必要祖先绘制信息与裁剪 | M2 |
| R08 | 长页/无限列表无法完整采集 | 中 | 有界滚动、partial 报告、分段采集 | M2 |
| R09 | 资源跨域/认证/签名失效 | 高 | 源会话内固化、局部截图、报告 | M1/M2 |
| R10 | 只按 DOM/zIndex 产生错误叠层 | 高 | stacking context 测试，复杂区域降级 | M2 |
| R11 | 包损坏、巨型资源、路径穿越 | 高 | 双端预算/引用/字节校验，不任意解压 | M1/M3 |
| R12 | 导入报告丢失导致重复图层 | 高 | importId、回执重发，不自动重建 | M3 |
| R13 | 低质量“可编辑”由大量碎片组成 | 中 | 段落与行策略，人工编辑检查 | M2 |
| R14 | SSO 拒绝内置浏览器 | 中 | 兼容报告；外部扩展列后续，不偷取 cookie | M3 |
| R15 | Figma/API/套餐变化 | 中 | 版本清单、最小探针、官方文档复核 | 各发布点 |
| R16 | 维护成本超过订阅收益 | 中 | 用真实 demo 记录清理时间与缺陷投入 | M5 |
| R17 | Android 需求拖慢桌面验证 | 中 | 接口预留、功能明确延后 | M0–M5 |
| R18 | 快照/日志含用户数据 | 中 | 本地默认、最小范围、URL 脱敏、无凭据导出 | M1 起 |

## 5. 官方资料与核实结论

以下资料用于核实平台能力。产品阈值、算法选择、模块结构、任务顺序和协议都是本项目建议，不是官方保证。

| 来源 | 页面 | 本轮使用的事实 |
|---|---|---|
| S01 | [Figma 插件类型](https://help.figma.com/hc/en-us/articles/41407987481879-About-building-plugins-in-Figma) | Classic 插件可读写、支持外部 API，免费开发发布；通常由用户启动 |
| S02 | [创建本地开发插件](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development) | 所有套餐支持开发；桌面端可从 manifest 导入 |
| S03 | [Figma 套餐](https://www.figma.com/pricing/) | Starter 免费；高级原型与团队能力存在套餐边界 |
| S04 | [Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view) | 承载 WebContents 的原生视图 |
| S05 | [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents) | 页面控制、脚本执行、截图与导航能力 |
| S06 | [Electron 安全说明](https://www.electronjs.org/docs/latest/tutorial/security) | 外部网页隔离、禁用 Node、启用上下文隔离和沙盒、不关闭 webSecurity |
| S07 | [Figma 插件运行环境](https://developers.figma.com/docs/plugins/how-plugins-run/) | 插件主逻辑与 UI 的运行环境不同，不能当作桌面后台服务 |
| S08 | [Figma manifest](https://developers.figma.com/docs/plugins/manifest/) | 网络域名和开发网络许可声明 |
| S09 | [Figma reactions](https://developers.figma.com/docs/plugins/api/properties/nodes-reactions/) | 可配置触发、动作、目标及部分高级原型动作 |
| S10 | [Figma loadFontAsync](https://developers.figma.com/docs/plugins/api/properties/figma-loadfontasync/) | 修改文字前需加载对应字体 |
| S11 | [Figma createImage](https://developers.figma.com/docs/plugins/api/properties/figma-createimage/) | 图片字节导入和格式/尺寸限制；发布前复核 |
| S12 | [Figma commitUndo](https://developers.figma.com/docs/plugins/api/properties/figma-commitundo/) | Undo 提交边界；实际清理/撤销另实测 |
| S13 | [DOM 几何](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) | 视口相对边界，滚动换算 |
| S14 | [计算样式](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) | 已解析样式读取，含伪元素入口 |
| S15 | [document.fonts](https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts) | 页面字体加载集合；不等于 Figma 字体安装 |
| S16 | [元素命中](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementsFromPoint) | 指针坐标对应元素层级 |
| S17 | [Android UI Automator](https://developer.android.com/training/testing/other-components/ui-automator) | 后续跨应用控件操作与截图路线 |
| S18 | [Android 无障碍节点](https://developer.android.com/reference/android/view/accessibility/AccessibilityNodeInfo) | 节点树并不一定与真实 View 一一对应 |
| S19 | [Android ADB](https://developer.android.com/tools/adb) | 后续设备连接与截图路线 |

资料会变化；记录取用日期和实际版本比写“永远免费/完全支持任意页面”更可靠。平台事实未实测部分在 Q 表中保留，不升级为功能已实现。

## 6. 决策追加模板

新记录必须包含：ADR 编号、日期、状态、问题、候选方案、采用方案、原因、影响模块/协议、验收变化、回退方式、关联任务与证据。被替换的记录保留并写 superseded by，不直接删除。

## 7. 后续可能调整的地方

正式 Schema 的扩展字段、图片处理库、打包器、桥接端口、具体依赖版本、性能预算和字体列表仍可在 M0 实测后修订。修改时同步 docs/04、样例和契约验证。若没有实测依据，不为追逐新框架重写已通过链路。

## 8. M0 实施补充决策

### ADR-011：连线目标输出为 Page 顶层 Frame

日期：2026-10-19。状态：accepted-by-runtime-evidence。真实 Figma 126.9.13 拒绝暂存 Frame/Section 内的 NAVIGATE 目标。采用创建时暂存、连线前发布到锁定 Page 顶层的方式；每个画面根携带 owner/importId/state。失败同时清理本次容器与已发布的本次根。真实人工包 9 节点、2 画面、PNG 和往返播放通过。关联 M0-03、docs/02、M0-03 证据。后续若采用 Section 分组须重新验证，不能恢复成未测嵌套结构。

### ADR-012：M0 最小构建与验证工具

日期：2026-10-19。状态：accepted-for-M0。使用 npm workspaces、精确版本 package-lock、esbuild、Node test runner、Playwright Electron；静态 HTML/TypeScript 工具界面。React/Vite/Vitest/Forge 的早期推荐不作为最小探针前置依赖；正式 UI 和安装包阶段再决定。Figma 主逻辑使用 ES lib + Figma typings，与 DOM 类型分离；Ajv 在构建期生成静态校验代码，插件运行时不做动态编译。关联 M0-02/06 与 docs/08。

### ADR-013：开发域名使用 localhost

日期：2026-10-19。状态：accepted-by-runtime-evidence。当前 Figma manifest 拒绝 http://127.0.0.1:43821，接受 http://localhost:43821；服务仍只监听 IPv4 回环，允许对应 Host。health 不暴露项目数据；Origin=null 不作为认证依据，认证与队列在 M3 实施。关联 M0-05 证据。当前结论仅适用于测试版本与开发插件，不外推为所有环境保证。

### ADR-014：手工验收由用户执行，先实现资源与真实 Section 链路

日期：2026-10-19。状态：accepted-by-user。用户明确要求自行测试稳定性，先实施资源校验及真实 Section 转换。采用继续开发、保留 verification_pending 的方式；不等待全部手工矩阵才写转换器，也不把用户尚未执行的验收勾选通过。关联 M0-06、M1-02 至 07、docs/09。若用户报告取消/残留删除或普通内容转换阻断，先修复再推进新功能；已有人工包探针保留作回退。

### ADR-015：M1 自包含资源预算与按渲染行拆分文字

日期：2026-10-19。状态：implemented-awaiting-user-acceptance。仅实现 inline JSON 与 PNG/JPEG；图片摘要内容寻址，字节/MIME/尺寸两端验证，宿主实际解码；便携 SHA-256 不依赖插件没有的 Node/Web Crypto。单图 10 MiB/4096px，总资源 30 MiB/64 Mi 像素，JSON 50 MiB，包 10000 节点/200000 文本单位；桌面采集另设更小预算，见 docs/09。30 MiB 为 base64 与 JSON 留出文件大小空间，预算属于产品首版约束。文字按 DOM Text 的 Range 实际换行输出原生 TEXT，避免整元素 textContent 重复；当前多行段落分为多个文本图层，富文本合并/Auto Layout 留 M2。包 schemaVersion 仍为 1.0.0，未增加字段；此前 schema 允许的 path 当前运行器明确拒绝。关联 docs/04、资源/转换测试与实际 Electron 证据。回退可运行原有人工样例；后续格式扩展需同步版本和测试。

### ADR-016：裁切根 Frame 与独立源预览附件

日期：2026-10-19。状态：implemented-awaiting-user-acceptance。用户授权实现视口、预览、自由框选，并保留最终验收。m2.1 使用已有 FRAME clipsContent 和原生节点表达严格裁切，不删掉被切断文本的后半段。完整元素针对原框相交的原子候选一次扩展，保留既有 overflow 裁切、排除全局容器，超过四个视口宽/高拒绝；暂不采用草案 50% 阈值，规则可从原框/实际尺寸复核。

源截图作为 `.preview.png/.preview.json` 附件，按实际位图和 CSS 视口比例裁切，长边缩至 2048，不参与 scene/assets/交互；缺失或校验失败不阻断主 JSON。无需升级插件或让 Figma 导入依赖额外文件。原生滚动条排除；视口之外只提示部分预览，不实现自动拼接。主协议保持 1.0.0。关联 M1-02/05、M2-02、docs/10 与 17 项实际 Electron 检查。回退可用原元素/Section 文件链路，另有 13 项回归通过。

### ADR-017：提前实现单会话本地直连与保守的回执恢复

日期：2026-10-19。状态：implemented / user-verification-pending。用户提出每次手选 JSON 的痛点并授权“继续下一步”，因此提前 M3-01/02/03/04 的最小链路，不等待完整 M2 或安装包。候选为文件、直接 REST 写入、通过已运行 Classic plugin 的 loopback 通道；采用后者，复用现有转换器与原生导入器，文件保留回退。

生产固定 http://localhost:43821，保留已实测 manifest；一对一插件会话和一个活动任务。一次性 5 分钟配对码换取内存 token，Host/来源/JSON/鉴权均核对；目标网页无 Node/preload/IPC。Origin=null 来自 opaque 插件 UI，不能单靠它识别插件，仍必须秘密配对。不新增 OAuth 或付费转换依赖，不自动打开/唤醒 Figma 插件。

稳定 importId、任务指纹与原子 journal、owner/importId/state 根标记、最近 3 个 clientStorage 成功回执共同提供有限去重。提交前存回执，重放必须核对 committed 实际根；临时网络错误只重传待确认回执。8 秒失联后不自动再次创建，原绑定可补交迟到报告；重启需重新配对，旧活动任务标为 interrupted。选择/视口定位失败不把已提交图层误报失败。日志只留最近 20 个任务，非全局 exactly-once 或覆盖更新。

影响 bridge.ts、共享 bridge 类型、main/preload/renderer、插件主逻辑与独立 UI bundle、HTTP/插件模拟测试及 smoke-bridge。当前契约落在 docs/04 8.1；原分块/租约草案保留为 8.2。校验：37 项自动测试通过，实际 Electron+真实插件 UI 的 14 项控制链路通过（画布宿主模拟、figmaTested:false），Section 13 项和框选 17 项回归通过。真实 Figma B01–B06 由用户验收，不能用模拟回执冒充导入证据。回退：继续保存 JSON 并由插件手选；不删未知用户图层或损坏 journal。下一候选为多选/排除，Android 仍延后。

### ADR-018：同页多根采集与渐进展示的工作台

日期：2026-10-19。状态：implemented / C01–C06 user-verification-pending。用户授权多选/排除，并要求布局照顾第一次使用者、参考成熟工具且保持简约高级。采用同页连续点选 + 显式列表、排除列表、独立/合并输出，复用现有转换器/插件/任务桥接。未采用先截图再 AI 重建、跨页面状态管理或重新引入 UI 框架。

选择保存实际 Element 与上下文 dom-* 标识，父子只保留父级，节点失效明确拒绝整批。独立多个 screens，合并透明共同根并重映射节点/图片/告警引用，按原文档位置保留间距；不自动填充未选内容或做 Auto Layout。排除在 DOM 遍历中跳过子树，源 DOM 与其余坐标不变；不能精确移除父级背景图中已融合的像素。限制 20 根/100 排除，整批沿用原预算。矩形仍单选，视口忽略列表排除。

UI 沿用原品牌 token，顶部地址/工具、中央原生网页、右侧选择/结果页签、底部固定主操作；配对/路径/诊断渐进展示。参考 Figma 的选择反馈与 Framer 的面板分工，具体出处和取舍见 DESIGN.md。不复制营销页或增加装饰性仪表盘。原生视图边界与 CSS 面板宽/底栏同步，支持 1000×650。

主 Capture Package 1.0.0 不变，生产者 m2.2。每画面有 captureId/selection；源预览仍独立，后续附件带 screen ID，不进入 assets，也不作为排除结果的渲染证明。整批一个 job，共享资源摘要去重，不增加付费依赖。客户端命名写入串行化后再保存/发送，避免 blur 与点击交错导致操作丢失。

验证：39 项测试，实际 Electron 多选/工作台 29 项（包含对比度、键盘、两种尺寸）、直连 16 项（真实 UI+模拟画布）、原 Section/矩形 13/17 项通过。最终真实 Figma 与体验由用户按 docs/12 验收。本批无 Git 提交、安装包、全页、交互或 Android。回退仍可单选、视口或自包含 JSON 文件导入；不退回已知有命名点击问题的代码。

### ADR-019：有界滚动准备、顶部原生快照与分段源参考

日期：2026-10-19。状态：implemented / D01–D09 user-verification-pending。m2.2 已获用户整体确认；用户授权继续全页并扩充本地长页。候选为一次读取已加载 DOM、滚动后 DOM、拼接截图或无界遍历；采用前两者可切换，保持原生可编辑节点，不用整页位图替代。

30k CSS px / 30 步 / 30 秒准备，整轮等待 90 秒，页面读取/截帧单步 15 秒保护；原节点/图片预算不放大。源页临时锁定选择、隐藏工具层、关闭目标后台计时节流，真实绘制让懒加载触发再读取。顶部读取一次 DOM，fixed/sticky 只保留顶部静态状态各一份。无限增高达到预算明确 partial；列表项节点/文字复用启发式拒绝，不保证所有虚拟化/嵌套滚动。

try/finally 恢复原滚动和工具状态、旧成功包原子保留；取消贯穿读取/资源。页面导航、销毁和超时打断挂起异步调用，同文档 hash 导航也解锁，不恢复旧坐标到新页面。恢复不等于撤销页面已发请求或动态 DOM。源参考最多 12 段/32 MiB，超长均匀抽样、非去缝拼接；图中固定层可重复但原生节点不复制。预览独立于主 JSON，附件 screenId 安全后缀，首段保持旧命名。主协议仍 1.0.0，converter=m2.3，插件不需新增 API。

影响 full-page/capture/main/assets/preview/renderer/preload 与本地服务路由；新增长 demo 和 virtual/infinite/tall 故障页、10 项单测和 smoke:full-page。49 tests、Electron 全页 29 项、整页桥接 17 项及旧流程回归通过；桥接画布模拟，无本批真实 Figma。D01–D09 用户最终验收、证据和失败修复见 docs/13 / PROGRESS。回退可关闭准备、改视口/区块/多选或保存主 JSON；不迁移自动交互/Auto Layout/Android，不绕过安全隔离。

### ADR-020：原生图片显示矩形与线性渐变能力扩展

日期：2026-10-19。状态：implemented / E01–E07 user-verification-pending。用户指定 m2.4 第一批图片裁切/定位、单层背景图和常见线性渐变，并明确保留工作台、长页、原生图层与既有验收；最终 Figma 由用户执行。

选择完整位图资源 + 实际显示矩形 + 原生裁切 Frame；object-fit 在内容区计算，background 在 origin/clip 坐标系计算，资源固化后用实际解码尺寸定位。Figma IMAGE Paint CROP/identity 保持整图映射，旧包 IMAGE 缺省仍 FILL；不预先烘焙裁切像素。渐变保留 angle/stops，通过物理尺寸投影为 GRADIENT_LINEAR，保留 alpha、色标和硬边。依据 [Figma 官方 Paint API](https://developers.figma.com/docs/plugins/api/Paint/) 及本地锁定 typings 实现，不调用外部转换服务。

主协议仍1.0.0，按内容声明 image-placement / linear-gradients；同步 Schema、语义校验、样例、两端类型与测试。拒绝新字段缺能力声明和非法色标，旧包兼容；旧运行中插件必须关闭重开。复杂平铺/多背景/径向与重复渐变/广色域插值等明确告警省略，保留底色与原生内容，不扩大为完整 M2-06。

独立 `/fixture-visual` 与可复现彩色/透明 PNG，不改工作台壳和长页结构，仅追加入口。61项 tests、Electron新视觉40项与直连17项开发检查通过；真实 Figma 未执行。像素对照只抽样14例稳定内部区域，透明颜色用预乘sRGB，本地最大通道误差2/255，不能替代宿主实际渲染。预算/取消/恢复沿用，不引入依赖或外部写入；回退仍可使用旧已保存包，新增视觉需重新采集。

后续确认：2026-10-19用户明确“这轮我验收通过了”，m2.4按docs/14交付范围user_accepted，保留整体确认，不补造分项。

### ADR-021：按视觉行安全合并富文本与显式字体替代

日期：2026-10-19。状态：implemented / TXT01–TXT07 user-verification-pending。用户确认m2.4后授权继续下一步，选择M2-05a文字第一批，不增加原型编辑器或重做已接受布局。

沿用DOM Text/Range和绝对布局，改为完整字素读取；UTF-16索引适配Range/Figma，大小写扩展后重新计算输出范围。仅在共同容器、相同视觉行/字号/行高/字距、相邻且透明行内祖先安全时合并，保留字体/颜色/装饰的runs。有背景、透明度、定位、明显间距或字号/基线差异时保留原生片段，避免为了少图层破坏视觉。原生段落重排和混合字号统一基线后续再做。

保持协议1.0.0，新增styled-text能力和可选Font.fallbacks、run.color/letterSpacing/decoration；Schema/类型/生成校验/人工样例/兼容测试同步。导入前加载实际字体；整节点fill先写、范围样式后写，避免覆盖颜色。依据[Figma TextNode API](https://developers.figma.com/docs/plugins/api/TextNode/)与[字体加载文档](https://developers.figma.com/docs/plugins/working-with-text/)。

字体按CSS列表和同族近似字重/斜体解析，使用确定的系统回退，不随机取available[0]；E_FONT_MISSING解释请求和实际选择。可用字体不代表完整字形覆盖，emoji提供未验证信息，不声称能检测每个缺字，也不下载/安装字体。复杂装饰和特殊排版明确告警；源坐标保持行对齐，Text自身为左对齐行片段。

新增`/fixture-text`和人工样例，旧长页只追加链接。71项自动测试、文字28项、视觉40项及直连17项开发检查通过，无本轮真实Figma写入。最终由用户按docs/15执行；m2.4及此前无需重验。无新依赖、Git提交或外部服务；保留原预算、取消/恢复、文件和直连路径。

### ADR-022：按上下文归一化原生绘制树与显式内容裁切

日期：2026-10-19。状态：implemented / LYR01–LYR07 user-verification-pending。用户授权“继续下一部分”，据既定候选实施M2-07a；m2.5文字仍待反馈，不把继续开发视作验收。m2.4及更早的user_accepted保持。

DOM树无法直接表达浏览器跨普通祖先的定位层叠。采用采集后按上下文归一化原生绘制树：稳定排序负层、普通内容、定位auto/0及正层，Flex/Grid项目考虑order及显式z，opacity/isolation保持组原子性。定位后代提升到最近上下文并重算局部坐标，不全页仅按z数值排序。依据[W3C CSS绘制顺序](https://www.w3.org/TR/CSS22/zindex.html)及[Figma子节点顺序](https://developers.figma.com/docs/plugins/api/properties/nodes-children/)。

overflow内容使用独立padding-box/内圆角FRAME，边框留在外层；提升时复制沿途适用的空裁切FRAME，按定位包含块跳过不应生效的中间overflow。上下文边框必要时拆为原生SHAPE，避免父Frame描边被Figma绘制到后代上方；非上下文选区负层保留实际背景遮挡。使用现有[Figma FrameNode](https://developers.figma.com/docs/plugins/api/FrameNode/)和场景字段，不新增协议能力、插件API或依赖。旧JSON不自动重排，需要重新采集。

复杂变换、float/table/ruby、负外边距、顶层dialog/popover、单轴overflow、非零clip-margin及隐式contain裁切明确告警或近似。独立根合并保持根内顺序，跨根层叠应选共同祖先/全页。辅助原生层计入原预算，取消/恢复和旧结果保护不放宽；不修改源DOM，不用截图替代可编辑节点。

独立`/fixture-layers`、人工样例和docs/16同步；83项自动测试、Electron层叠34项、文字28项、视觉40项和全页29项通过。13例稳定内部抽样最大通道差0/255，仅本地绘制器证据，非真实Figma。文字一次旧DOM祖先断言失败后，改为核对实际合成关系通过，失败证据保留。最终用户按docs/16验收，无Git提交、安装包、Android或外部服务写入。

### ADR-023：静态SVG受限配置与原生矢量导入

日期：2026-10-19。状态：implemented / SVG01–SVG07 user-verification-pending。用户询问剩余工作后，授权按建议继续SVG/常见图标。实施M2-06b；m2.5/6仍待反馈，m2.4及更早用户确认保持。

选择自包含SVG+Figma原生矢量导入，复用现有VECTOR/svg，新增inline-svg能力；不转成PNG。内联SVG固化计算样式与currentColor，本页use展开并重命名内部ID；SVG图片与单层背景复用原定位/裁切，并区分显式viewBox的视口/PAR协商与无viewBox固有坐标缩放。插件通过[Figma createNodeFromSvg](https://developers.figma.com/docs/plugins/api/figma/#createnodefromsvg)创建原生子层；按SVG坐标包装缩放而非只resize外框，并保留导入SVG根透明度。

采用共享的受限XML解析/规范化模块，适配无DOM/TextEncoder的插件环境：允许基础路径/形状/组、内部渐变与clipPath，拒绝DTD、活动内容、外部引用和未知绘制内容；不用字符串黑名单作为唯一校验。参考[W3C SVG外部资源规则](https://www.w3.org/TR/SVG/conform.html)和[引用规则](https://www.w3.org/TR/SVG/linking.html)，本项目配置比规范保守。外部文件内style表、text、filter/mask/marker、动画、foreignObject等整体占位并告警；不执行早期草案中的截图回退或SVG内再下载。

单SVG256KiB/500元素/32层，整包SVG2MiB、检查复杂度加场景节点≤5000。Schema同步svg长度上限，VECTOR必须声明能力，非VECTOR不得携带svg。旧真实包没有VECTOR所以兼容；手工旧VECTOR需显式能力与新校验。主协议1.0.0、adapter web-dom-2不变，converter m2.7；资源assets仍PNG/JPEG，不改桥接鉴权/API，不加依赖。

新增独立fixture与docs/17，保留原外壳/长页/旧测试。101项自动测试、Electron SVG51项和视觉40/文字28/层叠34/直连17项开发回归通过。像素对照13例稳定内部最大0/255，Chromium绘制而非真实Figma；实际Figma路径编辑由用户完成。失败的尺寸断言与viewBox/固有坐标问题均修复并保留证据。无Git提交、Android、安装包或外部服务写入。

### ADR-024：表单当前状态、闭合工具镜像测量与有限生成内容

日期：2026-10-19。状态：implemented / FRM01–FRM07 user-verification-pending。用户授权继续并询问公网。实现M2-06c常见表单/绝对定位生成框；m2.5/6/7仍待反馈，已接受旧范围保持。

读取value/selectedOptions.label/checked/indeterminate和当前计算样式；选择原生TEXT/FRAME/SHAPE/VECTOR静态输出，不截图替代。Range无法直接读取浏览器控件内部文字，采用工具自身闭合Shadow DOM中的隐藏镜像，冻结字体/宽度/空白规则后测量，finally移除，不改源DOM/值。密码只生成圆点进入镜像和包；textarea可见时保留完整值行并以原生Frame裁切到当前滚动位置，整个控件在范围之外时仍省略。普通系统控件主题与功能并不迁移，显式标为静态近似。

依据[HTML input当前值](https://html.spec.whatwg.org/multipage/input.html)、[表单标签/选中项](https://html.spec.whatwg.org/multipage/form-elements.html)和[CSSOM解析样式](https://www.w3.org/TR/cssom-1/)实现可靠绝对定位before/after：字符串解码、像素/box-sizing/边框/内边距及右下定位，常见颜色/均匀边框/圆角与现有层叠/裁切归一化。文流、counter/url、复杂布局/变换/阴影等继续告警，不扩大为完整CSS生成内容。

现有公网HTTPS导航及会话资源路径无需新模式。本轮实际公开文字页7项网络/采集检查通过，保持浏览器隔离；没有真实登录、图片防盗链或全网兼容证明。公网HTTP仍拒绝、SSO新窗口仍禁用，主协议与桥接无新字段/API，原有能力按内容声明。没有新增依赖或外部转换服务。

长页回归发现加载后立即采集的脚本安装时序窗口；按pageEpoch共享安装Promise，导航返回与采集开始等待就绪，旧页面的完成/失败不覆盖新页面状态。用250ms脚本读取延迟注入检查导航后立即转换；全页29项随后通过。109项自动测试、Electron表单36项与文字28/SVG51/层叠34项通过，实际Figma交给用户。新docs/18、人工样例和独立fixture保留原外壳/长页；无Git提交、Android、安装包或真实外部写入。

### ADR-025：常见外阴影使用独立原生背景形状

日期：2026-10-20。状态：implemented / SHD01–SHD07 user-verification-pending。用户授权继续下一步，按交接候选实施M2-06d，不扩大为完整视觉兼容或交互完成。

依据[W3C box-shadow](https://www.w3.org/TR/css-backgrounds-3/#box-shadow)，外阴影基于盒轮廓，列表第一项在前，不应把外溢子内容一同投影。依据[Figma Effect API](https://developers.figma.com/docs/plugins/api/Effect/)，spread在Frame有可见fill与clip条件；为保留内容溢出和阴影扩散，本批采用独立原生Rectangle承载背景/圆角/多层DROP_SHADOW，而非把效果放在整个内容Frame。背景形状参与现有层叠阶段，保持父级opacity和有效祖先裁切。生成框已有原生渐变与底色一同移动，避免新底色层覆盖渐变。

先支持单个矩形盒、不透明底、统一像素圆角与普通合成；内阴影、透明底、分片/复杂轮廓等明确省略并告警。最多16层，每个长度绝对值≤10000px；未知表达式不只截取第一层。pruneScene仅使用保守阴影外延保留范围内可见部分，不扩大原选区或内容裁切。blur/spread对应原生参数但不同引擎边缘未验证，因此保留W_SHADOW_APPROXIMATED。没有转图片或增加Schema字段/能力，插件显式false沿用showShadowBehindNode既有默认。

117项自动测试、阴影34项和相关开发回归通过；10个硬边白板稳定内部最大通道差0/255，非模糊/Figma证明。真实Figma由用户完成，m2.5–m2.8仍待反馈，m2.4及此前无需重验。原工作台/长页保留，没有新依赖、Git提交或真实外部服务写入。


### ADR-026：首版Windows交付与本地完整流程

日期：2026-10-20。状态：implemented / user-verification-pending。依据用户“直接把剩下的都补齐”和“就用本地来验证吧”，本轮完成首版Windows剩余工程；不要求真实站点、生产凭据或代用户执行Figma验收。新增项目状态/热点/原生动作、历史/视口/会话、可靠Flex、开放组件、WebP/GIF、真实ZIP、有界FIFO/分块/租约、日志与独立分发。已有视觉和长页保留，复杂CSS以显式降级边界交付。

原生Figma[layoutMode](https://developers.figma.com/docs/plugins/api/properties/nodes-layoutmode/)与[reactions](https://developers.figma.com/docs/plugins/api/properties/nodes-reactions/)用于可编辑布局和原型。依据[Electron分发文档](https://github.com/electron/electron/blob/main/docs/tutorial/application-distribution.md)，将锁定运行时和resources/app一起交付，独立插件与按用户安装脚本，不引入打包依赖；基于[nativeImage文档](https://github.com/electron/electron/blob/main/docs/api/native-image.md)的格式范围，WebP/GIF由隔离Chromium归一化，再进入原PNG/JPEG预算。分发未签名，保留运行时许可和AJV许可。

原任务日志持久化/重启不重复创建原则保留；单会话FIFO最多5个、100MiB，256KiB块、SHA校验和30秒租约。项目与缓存原子写入、损坏保留、有界历史和日志。ZIP先校验再内存读取，不解压任意路径；主协议仍1.0.0，以auto-layout能力协商扩展。开发证据不代表Figma实际播放，最终REL保留待用户；没有Git提交、远程或云发布。Android按既有后续入口另行授权。
