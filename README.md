# WebToPrototype 项目方案与续接入口

当前仓库统一管理桌面端、Figma 插件和移动端，远程为 [NarIyirm/Web-AppToPrototype](https://github.com/NarIyirm/Web-AppToPrototype)。桌面与插件在项目根目录运行 `npm ci`、`npm run check`；移动端在 `MobileApp/webapptoprototype` 单独运行 `npm ci`、`npm run verify`。两套依赖各自锁定，移动端不属于根 npm workspaces。

2026-10-21 已清理旧发布副本和测试缓存；最新发布包、真实采集及验收原始证据仅保留在本地，不随源码上传。目录与维护规则见[仓库与清理说明](docs/32-repository-and-cleanup.md)。下方阶段记录保留历史，功能现状以[桌面续接](docs/HANDOFF.md)与[移动续接](MobileApp/webapptoprototype/docs/HANDOFF.md)最新条目为准。

移动端新对话开发从[Expo项目文档入口](MobileApp/webapptoprototype/docs/README.md)开始；[移动HANDOFF](MobileApp/webapptoprototype/docs/HANDOFF.md)提供实际目录/当前失败/首批任务和可复制提示词。计划已基于用户初始化的Expo58独立仓库修订，本轮尚未实施移动业务。

移动端规划（2026-10-20）：用户确认桌面整体可用，现规划Expo同时支持Android/iOS的网页及原生App采集、扫码传电脑和Figma混合可编辑输出。两平台同等优先；已知测试机iPhone16Pro，Android设备/实际系统待核实。[详细计划](docs/25-mobile-web-and-native-plan.md)已落盘，尚未开始移动端实施。下方首次Mac候选待验证描述保留为历史，整体用户接受及专项证据边界见USER-TEST-RESULTS。

Mac开发候选（2026-10-20）：M系列.app ZIP已生成，141项自动测试/类型/构建、6项归档检查及相关Windows回归通过。Mac本机运行/签名、公证及Figma尚待验证。下载路径与SHA见release/latest-macos-arm64.json，首次运行见[Mac说明](docs/22-macos-release-guide.md)，实际证据见[Mac验证](docs/23-macos-verification.md)。现有Windows包与已接受范围保留。

版本：桌面0.1.0候选（Windows / Apple Silicon Mac开发候选）｜更新：2026-10-20（Australia/Sydney）

项目目录：`E:\WebToPrototype`

Windows首版0.1.0候选 / converter desktop-1.0 / adapter web-dom-2 / Schema1.0.0。用户授权补齐首版剩余开发，并指定只用本地验证。多状态与原生原型、历史/视口/会话、有限Auto Layout、WebP/GIF、开放组件、ZIP、队列/分块/日志和Windows分发均已实施。最终真实Figma仍由用户执行；m2.4及此前user_accepted保持，m2.5–m2.9及REL01–REL06不冒充通过。

使用请读[Windows使用与验收](docs/20-desktop-release-guide.md)，开发证据见[发布检查记录](docs/21-desktop-release-verification.md)，最新分发路径与SHA-256记录在 `release/latest-windows.json`。解压整个分发包后运行WebToPrototype.exe，无需Node/npm或开发服务器；也可运行Install.cmd按用户安装。源码开发仍可使用下方命令。公网HTTPS入口保留，本轮依用户要求只验证本地流程。

## 项目目标

开发一个 Windows 桌面程序，通过内置浏览器采集网页，将整页、当前视口、Section、单个元素或自由框选区域转换为可编辑 Figma 图层，并支持手工配置关键流程的原生原型交互。

核心转换在本机完成，自行实现，不依赖 html.to.design 或 code.to.design 等付费转换服务。Figma 端使用自建 Classic plugin 导入。Android 是后续优先支持的平台，本轮只预留接入边界。

## 从哪里开始

1. 先读 [当前进度](docs/PROGRESS.md)，确认已经完成和真正待做的事项。
2. 再读 [续接说明](docs/HANDOFF.md)，按其中的最小阅读顺序恢复上下文。
3. 开发前读 [阶段与任务](docs/06-roadmap-and-backlog.md)，按Windows首版当前状态续接，保留历史验收记录。
4. 技术细节发生变化时，同时更新对应规格、决策记录和进度，不能只在聊天里说明。

## 文档索引

| 文件 | 内容与用途 |
|---|---|
| [01 产品范围与验收](docs/01-product-and-acceptance.md) | 用户需求、功能优先级、边界、操作流程、完成定义 |
| [02 技术架构](docs/02-architecture.md) | 技术栈、进程隔离、模块职责、持久化、Figma 导入策略 |
| [03 采集与转换细则](docs/03-capture-and-conversion.md) | 框选算法、坐标、文字、图片、CSS、长页面、交互映射 |
| [04 数据与通信协议](docs/04-data-and-bridge-protocol.md) | 中间格式、字段约定、本地桥接、版本、错误、恢复 |
| [05 验证与稳定性](docs/05-validation-and-reliability.md) | 基准页面、验证矩阵、视觉指标、压力与故障测试 |
| [06 阶段与任务](docs/06-roadmap-and-backlog.md) | 可勾选任务、依赖、阶段交付物与验收门槛 |
| [07 决策、风险与来源](docs/07-decisions-risks-and-sources.md) | 已确认与暂定决策、待验证假设、风险及官方资料 |
| [08 本地开发](docs/08-local-development.md) | 启动命令、插件加载、真实证据与本轮兼容问题 |
| [09 手工验收](docs/09-manual-acceptance.md) | 真实 Section 转换、资源异常和稳定性操作清单 |
| [10 视口与框选验收](docs/10-viewport-and-rectangle-acceptance.md) | 新选择模式、源截图预览、附件与本轮用户验收 |
| [11 本地直连验收](docs/11-local-bridge-acceptance.md) | 配对、一键发送、页面保护、回执与 B01–B06 验收 |
| [12 多选与工作台验收](docs/12-multiselect-and-workbench-acceptance.md) | 新布局、连续多选、排除、两种画面输出与 C01–C06 验收 |
| [13 全页与长页验收](docs/13-full-page-and-long-demo-acceptance.md) | 滚动加载、固定层、进度/取消、分段源参考、扩充示例及 D01–D09 验收 |
| [14 图片与渐变验收](docs/14-visual-fidelity-acceptance.md) | m2.4 新视觉页、原生图片裁切/背景/渐变、兼容边界与 E01–E07 |
| [15 富文本与字体验收](docs/15-text-fidelity-acceptance.md) | m2.5 原生文字runs、换行/emoji/字体列表、边界与 TXT01–TXT07 |
| [16 层叠与裁切验收](docs/16-stacking-and-clipping-acceptance.md) | m2.6 z-index/上下文、原生裁切与背景/边框顺序、LYR01–LYR07 |
| [17 SVG与图标验收](docs/17-svg-and-icons-acceptance.md) | m2.7 内联/精灵/图片与背景SVG、原生矢量和SVG01–SVG07 |
| [18 表单/生成内容与公网说明](docs/18-forms-and-generated-content-acceptance.md) | m2.8 当前值、静态控件、绝对定位before/after、FRM01–FRM07与公网使用边界 |
| [19 外阴影验收](docs/19-shadows-acceptance.md) | m2.9 多层外阴影、原生Effects、范围/合成与SHD01–SHD07 |
| [20 Windows使用与验收](docs/20-desktop-release-guide.md) | 独立运行、项目与原型、恢复和REL01–REL06 |
| [21 发布检查记录](docs/21-desktop-release-verification.md) | 本地基准矩阵、压力、分发包与证据边界 |
| [22 macOS使用](docs/22-macos-release-guide.md) | M系列开发候选、本机准备与MAC01–MAC08 |
| [23 macOS验证](docs/23-macos-verification.md) | 实际包结构、共同核心回归及原生验证边界 |
| [24 Mac准备故障](docs/24-macos-prepare-troubleshooting.md) | BUG-003应用路径修复、日志与Mac复验 |
| [25 移动端详细计划](docs/25-mobile-web-and-native-plan.md) | Expo双平台网页/原生App、扫码传输、协议、阶段与验收 |
| [用户测试结果](docs/USER-TEST-RESULTS.md) | 待用户反馈的验收状态 |
| [PROGRESS](docs/PROGRESS.md) | 唯一的当前实施进度、最近验证与下一步 |
| [HANDOFF](docs/HANDOFF.md) | 新会话、其他开发者的续接流程与更新要求 |
| [示例数据包](examples/capture-package.v1.example.json) | 人工编写的协议样例，不是真实采集产物或通过验收的证据 |

## 本轮边界

- 系统：Windows 11 x64，本机开发环境已核实；其他系统后续适配。
- 输入：内置浏览器中的 HTTPS 网页和本地 HTTP demo。
- 输出：可编辑 Figma 图层、自定义本地数据包、导入报告；手工配置的原生跳转与Overlay。
- 自由选择：整页、视口、元素、Section、矩形、多选与排除均属于本轮完整验证版目标；按阶段交付。
- 暂不实施：Android 真机、桌面原生应用采集、iOS、浏览器扩展、AI 重建、自动遍历所有页面、代码双向同步。
- 图层可编辑、视觉接近、原型可演示分别验收。生成图层不等于已恢复所有网页行为。

## 状态与证据原则

`planned` → `in_progress` → `verification_pending` → `done`。

只有具备可复现操作和对应证据的任务才能标为 `done`。工具运行成功、API 文档存在、截图看起来相似，都不能单独证明完整能力已实现。受外部环境影响的任务可以记录为 `blocked`，并写明解除条件。

未来每次开发结束都更新 PROGRESS；完成任务时勾选任务清单并关联证据。若修改范围或技术选型，在决策文档追加记录，不静默改写历史。

## 使用方式与费用边界

日常使用需要打开 Figma 文件并运行自建插件。现可选择配对直连或自包含 JSON/ZIP 文件导入；截至 m2.3 全页的实际使用已获用户整体确认，完整专项矩阵不据此逐项推定通过。

Figma 官方说明 Classic plugins 免费开发、发布，开发插件支持所有套餐。本方案不依赖 Figma AI 或付费转换接口。Figma 的高级原型、团队协作和企业配置仍依照用户套餐与策略执行。详见来源 S01–S03。

Git 使用根目录的 main 分支统一管理，origin 为 NarIyirm/Web-AppToPrototype；移动端原独立 Git 元数据与53份原暂存索引已备份在本地 `.local-maintenance/mobile-git-before-monorepo`，不上传 GitHub。

## 当前运行

在 `E:\WebToPrototype` 执行 `npm.cmd run check` 检查工程，`npm.cmd start` 启动桌面探针。

Figma 开发插件清单：`E:\WebToPrototype\apps\figma-plugin\dist\manifest.json`。详细步骤及当前边界见 [本地开发说明](docs/08-local-development.md)。

