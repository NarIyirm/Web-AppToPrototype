# 08 本地开发与验证

BUG-002定向检查：`npm.cmd run smoke:layout-changes`。真实Electron本地动态全页与capture-send按钮，接收端为模拟HTTP；可设置W2P_APP_PATH验证实际分发程序。回归用smoke:full-page和smoke:bridge，结果见PROGRESS末尾。

更新：2026-10-20（Australia/Sydney）。历史证据归档保留；m2.9新证据按本地20日，时间戳为UTC，旧回归脚本仍使用原19日目录。

现有全页操作见[docs/13](13-full-page-and-long-demo-acceptance.md)。m2.4及此前已获用户确认，无需重验。当前m2.9常见外阴影见[docs/19](19-shadows-acceptance.md)，表单/公网用法见[docs/18](18-forms-and-generated-content-acceptance.md)，m2.5–m2.9最终Figma仍待用户反馈；继续开发不等于已验收，续接先读HANDOFF。

## 1. 已核实的开发条件

Windows 11 专业版 x64，系统 build 26200；i7-12700KF、约 32GB 内存、E 盘约 678GB 可用空间。Node 24.15.0、npm 11.12.1、Git 2.45.1 可用。Figma 桌面 126.9.13 已安装，并在用户打开的测试文件中实际运行自建开发插件。

沙箱内 CIM 查询和 npm DNS 查询受到限制，沙箱外检查和依赖安装成功。该现象不等于本机没有联网或没有安装 Figma。

依赖精确版本见 package.json 和 package-lock.json。实际 Electron 44.9.0 内嵌 Chromium 152.0.7977.167、Node 24.22.0，和宿主 Node 版本不同。

## 2. 命令

在 PowerShell 中执行：

```powershell
Set-Location -LiteralPath 'E:\WebToPrototype'
npm.cmd ci
npm.cmd run check
npm.cmd start
```

`npm.cmd ci` 需要网络与依赖下载权限。Electron 运行时在首次运行时可能另行下载；npm 包安装成功不等于已下载二进制。

| 命令 | 作用 |
|---|---|
| npm.cmd run build | 生成静态校验器、样例、桌面产物和 Figma 插件 |
| npm.cmd run typecheck | 分开检查桌面 DOM/Node 与 Figma 插件类型环境 |
| npm.cmd run smoke:visual | 新视觉页真实采集、14例内部像素抽样、Section/独立合并多选/矩形、保存重开；无真实 Figma 写入 |
| npm.cmd run smoke:text | 文字页真实采集、runs/字素/空白/行几何/字体列表/告警、保存重开与组合；无真实Figma写入 |
| npm.cmd run smoke:layers | 层叠/上下文/溢出裁切的真实采集、13例内部像素抽样、多选/矩形和保存重开；无真实Figma写入 |
| npm.cmd run smoke:shadows | 常见多层外阴影、原生背景形状、裁切/合成/范围、10例硬边内部抽样、组合及保存重开；无真实Figma写入 |
| npm.cmd run smoke:svg | 内联/精灵/图片与背景SVG真实采集、13例内部颜色抽样、边界/保存重开/组合；无真实Figma写入 |
| npm.cmd run smoke:forms | 控件当前值/状态、绝对定位before/after、测量隔离、组合/保存重开及加载就绪延迟注入；无真实Figma写入 |
| npm.cmd run smoke:public | 单次实际HTTPS文字页面导航与元素/视口/全页采集，不自动循环，不是全网/登录站兼容证明 |
| npm.cmd test | 运行协议与语义错误测试 |
| npm.cmd run check | 类型检查、测试和构建 |
| npm.cmd run smoke:desktop | 实际启动隐藏 Electron，验证选择和读取并保存证据 |
| npm.cmd run smoke:capture | 隐藏 Electron 验证真实 Section 转换、PNG/JPEG 和保存重开；不执行 Figma 验收 |
| npm.cmd run smoke:selection | 隐藏 Electron 验证视口、严格/完整矩形、源预览、附件、滚动及缩放；不执行 Figma 验收 |
| npm.cmd run smoke:bridge | 实际 Electron + 真实插件 UI 验证配对、连续发送和回执重试；画布宿主模拟，不写真实 Figma |
| npm.cmd run smoke:multiselect | 实际 Electron 验证多选/去重/排除/两种输出/逐画面保存重开及工作台对比度、键盘、尺寸；不写真实 Figma |
| npm.cmd run smoke:full-page | 实际 Electron 验证扩充长页、懒加载、固定层、分段参考/重开、取消/恢复、导航中断、无限/回收/超高页面；不写真实 Figma |
| npm.cmd run doctor | 记录系统与依赖；完整 Windows 检查可能需要沙箱外权限 |

M0 使用 esbuild 编译和静态 HTML/TypeScript 验证界面，尚未引入 React/Vite 或安装包生成器。完整工作界面与正式分发在后续阶段决定；不要为与早期推荐栈字面一致而重写已通过探针。

## 3. 桌面端当前可以做什么

启动后默认打开本机长页。可导航到 HTTPS 或本地 HTTP 页面；用顶部区块/元素/矩形/排除工具选择，右侧设当前选区/视口/整个页面，底部“预览转换”或“转换并发送到 Figma”。真实 DOM 转为绝对定位场景、渲染行原生文字，PNG/JPEG 固化到包；支持多根独立/合并输出与逐画面改名。结果页可发送缓存或保存整包，诊断与文件工具可重开已有包。

“开发诊断”内的“导出人工协议样例”仍为人工输入，artifactKind=example；真实转换输出 artifactKind=capture。布局读取探针在折叠诊断中保留，不与真实转换结果混淆。

“整个页面”可选有界滚动加载，进度中可取消，结束恢复原位置；本地例子增加懒加载图、追加 DOM、固定/吸顶、页尾与三个故障页面。参考为独立 PNG/元信息，全页最多 12 段，超长抽样；Figma 只需主 JSON。细节见 docs/13。Auto Layout 和真实网页自动原型交互仍待后续。

## 4. Figma 本地插件

执行 build 后，清单位置是：

`E:\WebToPrototype\apps\figma-plugin\dist\manifest.json`

在 Figma 桌面版的可编辑 Design 文件选择 Main menu → Plugins → Development → Import plugin from manifest，选该文件。随后从 Development 菜单运行“WebToPrototype · M0 验证”。用户当前环境已经成功加载此插件。

运行“基础验证（人工样例）”会创建两个页面顶层 Frame，含中文文字、基础形状、一张内嵌 PNG 和两个点击跳转。成功后下载报告；也可用“读取上次报告”查看 clientStorage 中保存的回执。打开 Present，验证“查看订单→订单详情→返回列表”。

可导入真实自包含 JSON（无需允许人工样例）。运行器两端已验证资源 SHA-256、实际长度、PNG/JPEG 类型/尺寸及预算；PNG 检查 CRC，宿主解码再核对尺寸。人工样例需要显式勾选允许；ZIP/外部资源路径明确拒绝。手工同包重导入生成新副本；直连同会话具备任务/回执去重，边界见 docs/11，尚无大文件分块或覆盖更新。

新版插件顶部有“连接桌面应用”：桌面生成并复制配对码，插件粘贴连接后保持运行；桌面可转换并发送当前选区/视口，也可发送缓存包。更换接收页需重新配对。旧插件必须关闭再运行以加载新产物，名称/manifest 路径保留。任务记录位于应用本地记录目录的 bridge-journal.json，认证秘密不持久化；损坏日志会停用直连，仍可文件导入。

## 5. 实测中修正的兼容问题

- 插件主逻辑的 tsconfig 只使用 ES lib 和 Figma typings，不能混入 DOM lib；否则浏览器 Navigation 类型与 Figma Navigation 冲突。
- Figma manifest 的开发域名使用 `http://localhost:43821`。实测当前客户端拒绝 `http://127.0.0.1:43821`，即使该地址在浏览器可访问。
- 当前运行环境拒绝嵌套 Frame 的 NAVIGATE 目的地。因此创建时暂存，连线前把所有画面移到目标 Page 顶层；每个根写入 owner/importId/state 标记。失败清理本次节点，不清理无关图层。
- 插件 UI 用 setStatus 函数，避开 window.status 名称；按 Figma 消息机制接收 pluginMessage，输入包仍在主逻辑校验。
- Playwright 的 shell 截图不包含独立 WebContentsView。`desktop.png` 只用于应用外壳验证，`fixture.png` 是实际目标页面截图，不能把前者空白区域误判为加载失败。

## 6. 真实证据

- 环境：[environment.json](../evidence/2026-10-18/M0-01/environment.json)。
- 桌面：[smoke-report.json](../evidence/2026-10-18/M0-04/smoke-report.json)、[实际 DOM](../evidence/2026-10-18/M0-04/dom-probe.json)、[页面截图](../evidence/2026-10-18/M0-04/fixture.png)。
- Figma：[实际导入报告](../evidence/2026-10-18/M0-03/import-report.json)、[原型往返检查](../evidence/2026-10-18/M0-03/prototype-check.json)、[画布截图](../evidence/2026-10-18/M0-03/figma-canvas.png)。
- 本地连接：[实际 health 结果](../evidence/2026-10-18/M0-05/bridge-probe.json)，已确认 Figma UI → localhost 可达；这不代表配对和任务传输已实现。

Figma 报告 inputKind=example，reportKind=actual_import：表示真实导入了人工输入，不能证明真实网页已经转换。此次生成 9 个节点、2 个画面、1 张图片、2 条交互，无字体替代告警。原型播放 URL 从 1:47 跳到 1:52，再回到 1:47。

## 7. 当前尚未验收

故意缺字体、图片限制的真实 Figma 拒绝表现、插件崩溃恢复、Undo 边界等专项仍待用户分项验收；已有 Section/BUG-001/m2.1/直连/m2.2/m2.3 整体反馈通过，不撤销也不补造逐项结果。开发已检查资源、缩放、取消及恢复。正式分发包及覆盖更新未实现，历史失败清理证据不能代替完整异常矩阵。

旧批次无需重复验收；若有新问题先修反馈，再补 M1/视觉兼容。不要把局部交付标成完整 M1/M2 全部完成。

## 8. m2.4 本轮开发检查

`npm.cmd run check`：61 tests、桌面/插件两套类型、构建均通过。`npm.cmd run smoke:visual`：40项通过，证据 [report.json](../evidence/2026-10-19/M2-visual/2026-10-19T08-45-39-046Z/report.json)，包括图片/背景/渐变包、保存重开、多选/合并、矩形和原订单开发回归。14例稳定内部像素抽样最大通道差2/255，见 [pixel-comparison.json](../evidence/2026-10-19/M2-visual/2026-10-19T08-45-39-046Z/pixel-comparison.json)。绘制器消费插件映射，但仍是本地模拟，不等于 Figma 验收。

`npm.cmd run smoke:bridge`：17项通过，真实 UI/本机 HTTP + 模拟画布，证据 [report.json](../evidence/2026-10-19/M3-bridge/2026-10-19T08-48-02-355Z/report.json)。本轮未操作真实 Figma；用户最终结果只记录在 USER-TEST-RESULTS。

本地 HTTP/Electron 需正常本机权限。首轮沙箱 check 因 EACCES 和浮点精确断言失败；断言改为容差比较。一次自动升级审批因额度暂不可用，用户要求继续后正常重试成功。视觉脚本初次失败为小数截图向外取整、CanvasGradient 的透明颜色插值不适合作 CSS 对照，以及直接 IPC 采集不更新 UI 保存状态；检查器已修正，失败目录保留，没有篡改为成功。最终检查结束均关闭自身测试实例，无安全隔离改动。

## 9. m2.5 文字开发检查

`npm.cmd run check`：71 tests、桌面/插件两套类型与构建通过。新增字素与UTF-16、行内合并安全条件、字体列表/近似样式选择、协议能力与实际插件主逻辑的范围样式和替代报告测试。

`npm.cmd run smoke:text`：28项通过，证据[report.json](../evidence/2026-10-19/M2-text/2026-10-19T09-15-47-685Z/report.json)及[源页截图](../evidence/2026-10-19/M2-text/2026-10-19T09-15-47-685Z/text-page.png)。真实全页、独立/合并、矩形和保存重开文件在同目录。前一次28项成功也保留在`2026-10-19T09-12-49-786Z`，本批没有失败测试运行。

`npm.cmd run smoke:visual`40项开发回归通过，证据[report.json](../evidence/2026-10-19/M2-visual/2026-10-19T09-13-57-004Z/report.json)；`npm.cmd run smoke:bridge`17项通过，证据[report.json](../evidence/2026-10-19/M3-bridge/2026-10-19T09-16-00-204Z/report.json)，真实UI/HTTP+模拟画布。旧批次用户确认不回退，不要求再执行旧矩阵。

文字本轮未进行真实Figma或字形像素差分。必须重启桌面并关闭重开原开发插件以载入styled-text能力；原插件ID、manifest路径和本地配对方式保持。新入口`/fixture-text`在原长页页尾，TXT01–TXT07见docs/15。

## 10. m2.6 层叠与裁切开发检查

`npm.cmd run check`最终83 tests、两套类型和构建通过。新增绘制阶段、上下文提升、包含块裁切、背景/边框阶段、预算/裁切组合及实际插件主逻辑的模拟宿主测试；没有增加协议字段或依赖。

`npm.cmd run smoke:layers`34项通过，证据[report.json](../evidence/2026-10-19/M2-layers/2026-10-19T09-49-30-513Z/report.json)。13个稳定内部区域抽样最大通道差0/255，见[pixel-comparison.json](../evidence/2026-10-19/M2-layers/2026-10-19T09-49-30-513Z/pixel-comparison.json)，比较Chromium源截图与消费原生场景树的本地绘制器，不是全图或真实Figma结果。该目录另含真实全页、独立/合并、严格矩形、保存重开JSON和源/场景PNG。

本轮开发回归：文字[28项](../evidence/2026-10-19/M2-text/2026-10-19T09-47-37-279Z/report.json)、视觉[40项](../evidence/2026-10-19/M2-visual/2026-10-19T09-46-50-885Z/report.json)、全页[29项](../evidence/2026-10-19/M2-full-page/2026-10-19T09-47-59-825Z/report.json)均通过。文字初次因断言仍要求原DOM祖先失败；包内opacity=.4的Frame和文字均保留，新的绘制树将合成组提升到上下文。断言改为检查实际原生合成父级后通过，失败证据保留在`M2-text/2026-10-19T09-46-42-064Z/`。未重跑bridge，传输契约和插件生产代码未改，最近17项属于上批历史。

最终检查均结束自身测试实例。没有真实Figma写入、安装包或Android测试；m2.5和m2.6均待用户反馈。重启桌面后从原长页页尾进入“层叠与裁切基准”，或访问`/fixture-layers`，按docs/16验证新增范围。

## 11. m2.7 SVG与图标开发检查

`npm.cmd run check`最终101 tests、两套类型与构建通过；新增SVG受限解析、局部引用展开、ID重命名、图片视口尺寸、预算和能力声明，以及实际插件主逻辑的模拟宿主缩放/透明度/预检检查。未新增依赖，主协议仍1.0.0，按需声明inline-svg。

`npm.cmd run smoke:svg`51项通过，证据[report.json](../evidence/2026-10-19/M2-svg/2026-10-19T10-19-48-035Z/report.json)、[像素记录](../evidence/2026-10-19/M2-svg/2026-10-19T10-19-48-035Z/pixel-comparison.json)和[源页](../evidence/2026-10-19/M2-svg/2026-10-19T10-19-48-035Z/svg-page.png)。包含14个原生矢量、13例稳定内部区域抽样最大0/255（每例至少738个颜色通道）、多选/矩形、真实UI保存重开。场景使用Chromium渲染规范化SVG，非Figma或全图比较。

开发回归：视觉[40项](../evidence/2026-10-19/M2-visual/2026-10-19T10-13-03-918Z/report.json)、文字[28项](../evidence/2026-10-19/M2-text/2026-10-19T10-13-28-889Z/report.json)、层叠[34项](../evidence/2026-10-19/M2-layers/2026-10-19T10-13-05-812Z/report.json)、直连[17项](../evidence/2026-10-19/M3-bridge/2026-10-19T10-13-28-332Z/report.json)、全页[29项](../evidence/2026-10-19/M2-full-page/2026-10-19T10-15-45-288Z/report.json)通过，直连为真实UI/HTTP加模拟画布。没有真实Figma操作；新增矢量需用户按docs/17进行最终渲染/路径编辑验收。

首轮受限环境HTTP测试EACCES，正常权限复测通过。SVG测试先修正178×89内容区断言，随后13例像素检查发现带viewBox的SVG fill应保留自身PAR、无viewBox固有坐标需缩放；修正实际尺寸链路并补充溢出矩形后51项通过。失败证据`M2-svg/2026-10-19T10-08-19-876Z`、`10-10-49-508Z`、`10-11-49-510Z`均保留（后两目录带同日完整日期前缀）。首轮40项及中间50项成功也保留，不覆盖为最终结果。

运行`npm.cmd start`，关闭重开原本Figma开发插件载入新inline-svg能力，重新配对。从长页页尾进入“SVG与常见图标基准”；旧页面和文件回退保留。无安装包或Android开发。

## 12. m2.8 表单/生成内容与公网检查

`npm.cmd run check`109项、两套类型/构建通过。新增生成内容字符串、绝对定位box-sizing/边距、密码圆点、完整表单值行保留、人工例与旧包兼容检查。

`npm.cmd run smoke:forms`36项，证据[report.json](../evidence/2026-10-19/M2-forms/2026-10-19T11-27-59-427Z/report.json)及[源页](../evidence/2026-10-19/M2-forms/2026-10-19T11-27-59-427Z/forms-page.png)，目录含当前/更新值、多选、矩形、保存重开真实包和3个装饰框源/场景PNG。稳定内部抽样最大0/255、每例至少564通道，不含字体/系统控件像素对照。另含250ms脚本加载延迟后的导航立即转换检查。

公网`npm.cmd run smoke:public`7项，通过实际HTTPS网络打开`https://example.com/`并生成元素/视口/全页原生包，保留隔离设置，明确拒绝公网HTTP。证据[report.json](../evidence/2026-10-19/M2-public/2026-10-19T11-14-44-159Z/report.json)和[源页](../evidence/2026-10-19/M2-public/2026-10-19T11-14-44-159Z/public-source.png)。该样例没有图片/登录，不能作为认证资源、SSO或全网兼容证据。可在一次性开发检查前设置`$env:W2P_PUBLIC_URL='https://自己的公开demo地址'`更换目标，完成后移除该环境变量；脚本不循环监控网站。

本批回归：文字[28项](../evidence/2026-10-19/M2-text/2026-10-19T11-18-54-459Z/report.json)、SVG[51项](../evidence/2026-10-19/M2-svg/2026-10-19T11-18-54-663Z/report.json)、层叠[34项](../evidence/2026-10-19/M2-layers/2026-10-19T11-19-46-135Z/report.json)、全页[29项](../evidence/2026-10-19/M2-full-page/2026-10-19T11-23-10-494Z/report.json)通过。未重跑本批visual/bridge独立脚本，其最近结果仍属m2.7历史；没有真实Figma写入。

失败留痕：表单首轮暴露textarea裁切导致不可见值行丢失，改为可见控件保留完整文字；次轮断言未计content-box边框，修正预期。全页在`M2-full-page/2026-10-19T11-19-44-748Z/`超高页阶段失败，增加按pageEpoch共享的脚本安装就绪等待，导航后立即转换及全页复测通过。表单失败`M2-forms/2026-10-19T11-14-35-855Z/`、`2026-10-19T11-15-46-905Z/`保留；早期公网运行被中断，仅中间包保留，正式7项以最新完整report为准。

新入口`/fixture-forms`，说明docs/18。无新依赖/协议字段或外部写入，运行`npm.cmd start`，保留原插件ID/manifest和文件回退。旧工作台/长页无需重验，FRM最终Figma由用户执行。

## 13. m2.9 外阴影开发检查

`npm.cmd run check`：117 tests、两套类型/构建通过。新shadows模块、裁切外延、人工样例与插件实际效果参数映射由自动测试覆盖；Schema1.0.0和能力清单保持。首轮受限HTTP测试出现本机EACCES，正常本机权限复测全部通过，未改浏览器隔离。

`npm.cmd run smoke:shadows`：34项通过，证据[report.json](../evidence/2026-10-20/M2-shadows/2026-10-19T15-11-15-324Z/report.json)与同目录源截图/像素记录/真实全页、独立合并、严格矩形、保存重开JSON。10个硬边白板稳定内部最大0/255，模糊仅检查参数和源图。最终Figma见docs/19，不据此自动通过。

回归路径在`evidence/2026-10-19/`：表单36项`M2-forms/2026-10-19T15-01-59-500Z/`、层叠34项`M2-layers/2026-10-19T15-11-58-002Z/`、图片渐变40项`M2-visual/2026-10-19T15-04-59-281Z/`、全页29项`M2-full-page/2026-10-19T15-04-59-474Z/`、直连17项`M3-bridge/2026-10-19T15-04-58-862Z/`均通过。旧脚本保留其原归档日期，时间戳为UTC，本批本地日期为20日。直连是实际UI/HTTP加模拟画布；文字/SVG/公网独立脚本本批未重跑。收尾背景paint整体移动由最终阴影检查中的渐变生成框覆盖，未重复所有旧矩阵。

阴影开发检查初次把归一化后的溢出子元素局部x当作原DOM局部x，修正为按样例ID核对效果所属形状；像素绘制器改为绘制完整场景再裁白板，覆盖提升至祖先的层。源截图向外取整后宽度不同，修正像素行宽索引；中间一行注释遮住变量声明及新增渐变白板不被绘制器读取的问题也已修正。失败目录`M2-shadows/2026-10-19T15-01-58-042Z`、`15-02-18-423Z`、`15-03-01-864Z`、`15-03-12-540Z`、`15-06-07-296Z`保留，未把失败改写为成功。产品代码另修正背景paint整体移动以保留生成框渐变，最终34项通过；先前32项成功保留为中间记录。

启动`npm.cmd start`，长页页尾“外阴影视觉基准”。同一插件manifest/ID，关闭重开载入新构建，重启桌面后重新配对，JSON文件回退保持。无新依赖、真实Figma操作、安装包/Android或Git提交。


收尾新增选中非上下文根的背景/边框独立排序，自动测试117项及最终阴影34项覆盖；层叠定向复测34项证据`M2-layers/2026-10-19T15-11-58-002Z/`。此前空checks的导航中断失败`M2-layers/2026-10-19T15-11-15-326Z/`保留，检查器等待默认测试页完成再导航后通过；没有修改产品导航规则。阴影中间32/33项成功仍保留，不当作最终34项。

## Windows首版0.1.0（当前入口）

开发：npm.cmd run check；启动npm.cmd start。本地完整流程npm.cmd run smoke:workflow、100次实际捕获npm.cmd run smoke:stress、真实HTTP/插件UI加模拟宿主npm.cmd run smoke:bridge。既有smoke:text/svg/visual/layers/forms/shadows/full-page/multiselect/selection/capture用于受影响回归，不需要用户重验m2.4及此前。

分发：npm.cmd run package:windows，输出新时间戳目录、ZIP、SHA256SUMS及ZIP摘要，release/latest-windows.json指向最新候选。整个目录含运行时、resources/app、FigmaPlugin、使用说明、docs、Install.cmd/ps1；不依赖开发服务器/Node/npm，无新打包依赖。脚本不覆盖/删除旧包。Install.ps1可用-InstallRoot自选目录和-NoShortcut供开发复制测试，默认按当前用户安装并创建开始菜单快捷方式。未签名。

smoke:workflow可设置W2P_APP_PATH到实际WebToPrototype.exe；脚本使用空工作目录、系统PATH、新数据目录运行完整本地操作并重启恢复。测试数据与日志各自隔离，结束自身实例。100次压力与20次模拟宿主插件导入有真实次数/耗时证据，不冒充真实Figma。最终路径与失败记录见[发布检查](21-desktop-release-verification.md)，操作见[Windows说明](20-desktop-release-guide.md)。

## macOS Apple Silicon候选

新增npm run package:mac（arm64）、npm run package:mac:intel（可选x64）、npm run test:mac-package、npm run smoke:platform；Mac本机可加--dmg。Node24/Python3.10+用于开发构建，最终Mac运行不需要这些开发依赖。归档不在Windows解开符号链接；实际ZIP的CPU/权限/链接/摘要/当前构建由inspect-macos-package.py检查。操作见[Mac说明](22-macos-release-guide.md)，实际结果与未验证项见[Mac验证](23-macos-verification.md)。本机签名、DMG和Gatekeeper不能用Windows检查替代。
