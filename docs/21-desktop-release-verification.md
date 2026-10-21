# Windows首版发布检查记录

最新修复BUG-002：全页快照读取后的普通内容变化不再误拒绝；本批开发/分发证据见PROGRESS末尾。下方30项安装流程及158/110文件摘要属于首次0.1.0候选基线，原分发为2026-10-19T16-44-03-047Z，不能当成后续修复构建的新运行。release/latest-windows.json随修复构建更新；旧基线与SHA保留。

2026-10-20（Australia/Sydney）。app0.1.0候选 / converter desktop-1.0 / adapter web-dom-2 / Schema1.0.0。用户授权补齐Windows首版剩余，明确只用本地验证。开发已在以下支持边界内完成；最终真实Figma由用户执行，REL01–REL06仍待验收。m2.4及此前已接受范围不重验。

## 交付与复现

当前分发ZIP、SHA-256和目录读取 [latest-windows.json](../release/latest-windows.json)，源码基线读取 [latest-source.json](../release/latest-source.json)。分发含完整锁定Electron运行时、原生应用、FigmaPlugin、安装脚本、文档/样例和许可；解压运行WebToPrototype.exe，或Install.cmd按用户安装，无需Node/npm/开发服务器。保留整个目录。源码ZIP不含用户采集、运行数据、证据或node_modules；原证据保留在工作区，未创建Git提交/tag/远程。

真实安装副本位于.runtime/install-check-final/0.1.0；Install.ps1使用自选目录/-NoShortcut复制，不改用户开始菜单。其完整流程使用空cwd、仅Windows系统PATH和新数据目录启动，并重启核对完全一致的状态ID与连线。后续最终封装的运行文件和安装副本逐个摘要核对，摘要/安装/归档记录见 [发布证据目录](../evidence/2026-10-20/Desktop-release/2026-10-19T16-43-47-273Z/)。这验证本机独立运行，不冒充另一台全新电脑。

操作与最终验收见[Windows使用](20-desktop-release-guide.md)。本地 /fixture-prototype 是真实列表/详情/dialog/返回；/fixture-auth 使用Cookie保护PNG且无Cookie为401。新增完整本地流程覆盖状态/删除/重排/五条连线、热点、项目备份副本、JSON/压缩ZIP、原生Flex、WebP/GIF、开放组件/slot、关闭组件告警、动画暂停恢复、视口、会话与历史；实际插件原生API调用由自动测试模拟宿主覆盖。没有本轮公网登录/生产系统或真实Figma写入。

## 开发检查

134项自动测试、桌面/插件两套类型检查及构建通过，日志见 [check.log](../evidence/2026-10-20/Desktop-release/2026-10-19T16-43-47-273Z/check.log)。包括项目/存储损坏保留、资源/协议/SVG预算、ZIP/CRC/Deflate、UTF8、Flex、队列/块鉴权/摘要、磁盘原子写失败后终态回执持久化重试、日志轮转和插件暂存/取消/幂等。20次独立导入运行实际插件主逻辑、40次原生reactions调用，宿主模拟；不计成20次真实Figma。

| 本地开发检查 | 通过项/次数 | 实际报告 |
|---|---|---|
| workflow | 30 | [report](../evidence/2026-10-20/Desktop-completion/2026-10-19T16-39-58-825Z/report.json) |
| stress | 100 | [report](../evidence/2026-10-20/Desktop-stress/2026-10-19T16-15-28-045Z/report.json) |
| bridge | 19 | [report](../evidence/2026-10-19/M3-bridge/2026-10-19T16-24-14-487Z/report.json) |
| full-page | 29 | [report](../evidence/2026-10-19/M2-full-page/2026-10-19T16-24-14-889Z/report.json) |
| text | 28 | [report](../evidence/2026-10-19/M2-text/2026-10-19T16-35-04-433Z/report.json) |
| svg | 51 | [report](../evidence/2026-10-19/M2-svg/2026-10-19T16-35-04-595Z/report.json) |
| visual | 40 | [report](../evidence/2026-10-19/M2-visual/2026-10-19T16-35-48-298Z/report.json) |
| layers | 34 | [report](../evidence/2026-10-19/M2-layers/2026-10-19T16-35-48-396Z/report.json) |
| forms | 36 | [report](../evidence/2026-10-19/M2-forms/2026-10-19T16-35-47-937Z/report.json) |
| shadows | 34 | [report](../evidence/2026-10-20/M2-shadows/2026-10-19T16-37-10-695Z/report.json) |
| multiselect | 29 | [report](../evidence/2026-10-19/M2-multiselect/2026-10-19T16-37-11-979Z/report.json) |
| selection | 17 | [report](../evidence/2026-10-19/M2-selection/2026-10-19T16-37-10-442Z/report.json) |
| capture | 13 | [report](../evidence/2026-10-19/M1-functional/2026-10-19T16-37-11-103Z/report.json) |

旧脚本目录沿用2026-10-19，新证据时间戳为UTC，本地执行日期为20日。以上为本次实际报告，不把历史117 tests/17 bridge或公网7项混作新运行。全页/bridge在本批较早已检查，后续UI/保真统计/日志收尾由最终自动测试和安装完整流程覆盖，未无故重复全矩阵。

100次为实际主采集流程、简单订单Section，不是100份合成包；总采集时间4544ms，P95 52ms，单次最大97ms，历史最终20条/540608字节。进程working-set采样从约584MiB到645MiB，原始逐进程/逐次数据在stress报告；不据短时采样宣称任意长会话无内存增长。报告覆盖有界缓存与成功重开，不是复杂全页性能承诺。

bridge19项使用真实插件UI、opaque iframe、本机HTTP和模拟画布，含超过256KiB实际PNG包的多块校验与真实Deflate ZIP文件导入。Figma API及文件上下文仍需最终用户核对。

## F01–F16支持与降级矩阵

| 编号 | 本地基线 | 首版行为与证据边界 |
|---|---|---|
| F01 | capture13、text28 | 原生文本/基本盒模型，无重复文字 |
| F02 | text28 | 中文/字素/富文本/视觉行；非整段重排 |
| F03 | text28、插件模拟字体测试 | 替代字体报告；逐字缺字、真实字体效果待用户 |
| F04 | workflow30、Flex自动测试、visual40 | 可靠单行/列可选Auto Layout，其余绝对布局 |
| F05 | layers34 | 常见Grid几何/绝对叠层/上下文；复杂绘制告警 |
| F06 | visual40、workflow30 | object-fit/position、背景图/裁切、WebP/GIF静态PNG |
| F07 | svg51、forms36 | 受限原生SVG与可靠伪元素；未知SVG整体占位告警，不静默远程补抓 |
| F08 | full-page29、layers34 | overflow和顶部fixed/sticky一次静态输出；非滚动行为迁移 |
| F09 | full-page29 | 懒加载/追加、有界终止、取消/恢复及旧成功包 |
| F10 | full-page29 | 回收列表启发式拒绝，无限/超高页partial说明，视口替代 |
| F11 | workflow30、capture13、资源自动测试 | 本地手动会话保护图片、资源失败；未全面验证公网跨域/反爬/生产登录 |
| F12 | workflow30 | 开放ShadowRoot/slot原生一次；封闭组件/iframe明确告警占位 |
| F13 | forms36、workflow30 | 可见当前表单状态、Tab/dialog快照与手工Overlay；不提交源业务 |
| F14 | selection17、multiselect29、capture13 | 多范围选择/排除/父级/去重、严格与完整矩形；非多矩形集合 |
| F15 | selection17、full-page29、layers34 | CSS/浏览器zoom与复杂transform告警；系统DPI150%完整矩阵未执行 |
| F16 | workflow30 | CSS动画有界暂停/恢复，Canvas/video/iframe/复杂filter明确边界；无任意JS/视频冻结承诺 |

保真报告按native/approximated/rasterized/missing内容节点计数，普通容器不占分母、missing边界计入；不能当作全图像素相似度。既有白板稳定内部像素与模拟绘制检查不证明真实Figma模糊边缘/字体一致，详见docs/14–19。

## 保留的失败与修复

早期项目流程检查曾将滚动条占用后的clientWidth错误断言为请求视口宽度，已按实际内容宽度核对；临时测试隐藏details/aria-busy等待错误、原生连线模拟任务revision不匹配也已修正。对应中间目录保留，不冒充成功。

首次打包目标目录预先创建导致cp(errorOnExist)失败，改为只创建父目录，后续真实复制通过；旧空目录保留。安装流程第一轮已通过28项业务检查，但Playwright隐藏窗口截图30秒超时（[failure.json](../evidence/2026-10-20/Desktop-completion/2026-10-19T16-35-06-448Z/failure.json)），未标成功。改用Electron原生capturePage后完整30项通过；另外短暂显示安装副本窗口补拍新合成帧，原隐藏截图保留，正式可视检查见[工作台](../evidence/2026-10-20/Desktop-completion/2026-10-19T16-39-58-825Z/workflow-shell-visible.png)、[源长页](../evidence/2026-10-20/Desktop-completion/2026-10-19T16-39-58-825Z/source-visible.png)及visible-review.json。工作台空白区域不能当原生WebContentsView网页丢失；源截图单独核对。

## 最终待用户与已知边界

当前未发现可复现未修的P0。发布候选仍待真实Figma REL01–REL06：加载配对、原型播放/关闭/返回、原生编辑/Auto Layout、备份/ZIP、取消断线/Undo及m2.5–m2.9视觉比较。用户接受标准与清理时间填入[用户结果](USER-TEST-RESULTS.md)。这些是验收证据待完成，不再把已实施工程列为计划。

非首版原生支持：封闭组件/iframe/Canvas/video内容、复杂CSS transform/filter/蒙版/多背景/内阴影等，见具体告警。嵌套虚拟滚动、SSO弹窗、全部公网认证、逐字缺字和系统DPI矩阵没有全面证明。平台限定Windows x64，签名/商店、Android、自动探索业务流程与云端协作属于后续范围。保留支持边界，不把“补齐”解释为任意网页100%还原。

## BUG-002修复构建验证

本次134项自动测试、新增全页动态更新10项、原全页29项、直连19项通过。真实发送使用本地HTTP模拟接收/画布，不是Figma验收。复现/修复、精确路径与修复版归档后核验见PROGRESS末尾；旧分发基线和数字按历史保留。
