# 02 技术架构

2026-10-20移动扩展为规划状态：[25 移动端计划](25-mobile-web-and-native-plan.md)。Expo共享两平台产品/任务，Android与iOS原生模块适配系统采集，手机原始包由桌面转换再交Figma。当前只有packages/contracts，移动目录/转换模块抽取、原始包和最终协议扩展都尚未实现；下方历史Android优先的表述由双平台同等优先覆盖。

版本：v1.0架构基线 / 2026-10-20 desktop-1.0实现补充｜锁定依赖见package-lock.json，当前模块与实际证据见PROGRESS和docs/21；原方案段落保留。

## 1. 总体结构

数据流：目标网页 → Web 采集适配器 → 原始快照 → 归一化/资源处理 → Capture Package → 文件或本地桥接 → Figma 插件 UI → 插件主逻辑 → 原生图层与原型 → 导入报告。

桌面端负责采集和转换；插件负责使用 Figma API 写入当前可编辑文件。插件不负责再次访问目标网站，也不需要取得用户的网站登录凭据。

## 2. 技术选型

| 部分 | 推荐 | 原因与边界 |
|---|---|---|
| 桌面宿主 | Electron + TypeScript | 内置 Chromium，便于取得实际布局；安装体积不是首要优化目标 |
| 目标网页承载 | WebContentsView | 与应用 UI 分离；不采用已废弃的 BrowserView |
| 应用 UI | React + Vite + 普通 CSS/设计变量 | 便于维护选择工具、任务队列和结果视图；不先引入复杂组件体系 |
| 提取脚本 | TypeScript 编译的独立脚本 | 可在目标页面隔离环境执行；不依赖其 React/Vue 框架 |
| 布局/图层转换 | 纯 TypeScript 核心包 | 不直接依赖 Electron 或 Figma 全局对象，可单独测量与复用 |
| 资源处理 | 主进程资源服务 + 独立工作线程 | 图片解码、哈希、缩放避免阻塞 UI；先验证随 Electron 运行的兼容性 |
| Figma 导入 | Classic plugin + TypeScript | 自用可本地加载；直接创建图层和 reactions |
| 本地存储 | 版本化 JSON 清单 + 内容寻址资源文件 | 先不引入数据库，便于检查、备份、恢复 |
| 桥接 | 回环 HTTP、短期令牌、轮询 | 易观察、可重连；实际可达性和 CSP 必须 M0 实测 |
| 测试 | Vitest + 本地 fixtures + Playwright Electron 支持评估 | 算法测试与实际 Figma 人工/集成验证分工明确 |
| 打包 | 优先评估 Electron Forge | M0 选定一种打包工具；不同时维护多套 |

这些是推荐值，尚未安装。Node、Electron、Figma typings、构建器之间的版本兼容在 M0 锁定并记录；宿主机 Node 版本不等于 Electron 内嵌 Node 版本。

## 3. 进程与权限边界

### 3.1 Electron 主进程

拥有窗口、目标视图、受控采集、磁盘存储、资源请求和桥接服务。只接受明确 IPC 操作与验证后的参数，不执行页面传来的任意脚本或命令。导航限定 http/https；本地 demo 允许 HTTP，其他不安全来源按明确设置处理，不通过关闭 webSecurity 解决问题。

### 3.2 应用渲染进程

加载随程序打包的 UI。通过窄 preload API 请求导航、选择、捕获、导出和取消。它不能把任意目标路径或脚本透传给主进程。应用预览展示结构化数据与图片，不重新执行采集到的 HTML 或 JavaScript。

### 3.3 目标网页进程

与应用 UI 分离，禁用 nodeIntegration，启用 contextIsolation 和 sandbox；独立 session 分区。正常页面只拥有浏览器环境。采集器使用宿主管理的执行入口，页面事件返回仅限已校验的选择或快照数据，不暴露 Node/Electron API。

桌面 UI 和网页各自是原生视图：应用 DOM 的浮层不一定能盖住 WebContentsView。选择边框优先放入目标页面中的隔离 ShadowRoot；坐标与状态反馈由宿主维护。该叠层、焦点、鼠标事件问题是 M0 专项验证项。

### 3.4 Figma 插件两侧

插件 UI 接收文件或连接回环服务，验证数据后通过 postMessage 把结构化数据传给插件主逻辑。主逻辑调用 Figma API，不假设它有浏览器 DOM、Node 文件系统或长期后台执行能力。用户关闭插件时网络与导入执行中断，桌面保存任务以供重试。

Electron 的隔离建议、Figma 的运行方式见来源 S04–S07。具体 IPC、桥接鉴权属于本项目设计要求。

## 4. 模块接口边界

| 模块 | 输入 | 输出 | 不能承担的职责 |
|---|---|---|---|
| browser-controller | URL、导航/视口指令 | 浏览状态、页面标识 | 不直接生成 Figma 图层 |
| selection-controller | 指针、快捷键、模式 | SelectionSpec | 不修改源页面业务数据 |
| web-capture | 页面上下文、SelectionSpec | 原始 DOM/布局快照 | 不把浏览器对象写入持久化包 |
| normalizer | 原始快照 | 场景节点树、源映射、告警 | 不下载资源、不调用 Figma |
| asset-service | 捕获关联的资源请求 | 本地资源、摘要、尺寸 | 不允许任意来源访问本机文件/端口 |
| layout-converter | 场景树、策略 | 输出布局和保真级别 | 不擅自推断组件业务意义 |
| package-store | 包与资源 | 原子保存、历史索引 | 不保存认证令牌到导出包 |
| bridge-server | 配对、任务、资源请求 | 受控传输、导入报告 | 不对局域网或公网监听 |
| figma-importer | 已校验 Capture Package | 节点映射、报告 | 不把源 DOM ID 当作 Figma ID |
| prototype-linker | 自定义交互与节点映射 | Figma reactions | 不执行网页 JavaScript |

未来 AndroidCaptureAdapter 输出同一份归一化协议，并为节点标记“控件信息/视觉推断/图片保留”。桌面版现在只定义接口，不创建假 Android 实现。

## 5. 建议的实现目录

以下为未来目录规划，当前仅 README、docs 与 examples 存在。

| 路径 | 作用 |
|---|---|
| apps/desktop | Electron main、preload、应用 UI、目标视图管理 |
| apps/figma-plugin | manifest、UI、主逻辑、构建输出 |
| packages/contracts | 协议、解析、版本兼容与校验 |
| packages/web-capture | 页面提取、选择、源对象映射 |
| packages/converter | 坐标、样式、布局、节点归一化 |
| packages/assets | 资源处理与内容寻址 |
| packages/bridge | 本地传输与任务状态 |
| fixtures | 可重复运行的基准页面与预期 |
| tests | 跨模块、Electron 集成、故障注入测试 |
| evidence | 实测截图、报告、环境与复现记录 |

## 6. 本地存储与恢复

运行数据放在 Electron userData 目录下的项目专用子目录；开发源目录不保存真实登录会话。每个项目有 project.json、captures、assets、imports 和 logs。资源按 SHA-256 去重；捕获包不可变，编辑名称或流程生成新 revision。

持久化采用先写临时文件、校验后同卷原子替换。首次启动检查未完成任务和临时文件，只恢复可验证清单。删除捕获不立即删除共享资源；单独清理时检查全部引用。日志按大小轮转；原始网页数据仅按用户诊断选择留存。

导出格式暂定 `.w2p.zip`，包含 manifest.json、package.json、assets 和可选 preview。它是本项目格式，不是 Figma 官方 `.fig` 文件。manifest 列出条目摘要；插件不向任意磁盘位置解压。

## 7. Figma 写入与重试

1. 读取包，先检查版本、预算、资源完整性和字体可用性。
2. 记录目标 pageId；创建带 importId 的隐藏临时 Section，作为创建期间的暂存边界。
3. 按父子顺序创建节点，分批让出执行权，缓存字体与图片。
4. 建立源节点映射；当前实测环境要求 NAVIGATE 目标是页面顶层 Frame，连线前把画面移到锁定的目标 Page，并分别写入 owner/importId/state。
5. 创建跨状态连线，校验输出，删除空暂存 Section，定位成功的多个画面根并保存报告；此时才反馈成功。
6. 失败/取消删除临时容器及本次已发布到页面顶层、具有相同 importId 的根，保留历史成功导入。插件关闭或崩溃后需检测两种残留。

这不是 Figma 数据库事务，不承诺崩溃时完全原子回滚。预留恢复提示、残留清理与 Undo 验证。重复 importId 已成功则返回原结果；新 importId 导入同 captureId，默认生成新副本。v1 不覆盖用户手动修改的旧 Frame。

2026-10-19 实施说明：上述顶层 Frame 策略由真实 Figma 测试得出。当前 M0 只实现基础创建/失败清理与报告，没有完成幂等、崩溃恢复、Undo 和大包事务验收。

2026-10-19 M3 首版更新：已增加单会话配对/任务桥接（desktop bridge.ts）、独立编译的插件 UI（figma-plugin/ui/index.ts）与共享 bridge 类型。直连以稳定 importId、原子 journal、实际根标记及最近 3 个 clientStorage 回执处理重复/不确定状态；文件导入仍创建新副本。旧文中的 M0“尚无幂等”为历史状态。当前固定 localhost:43821、inline JSON 一次交付、一个活动任务，不实现分块/全局 exactly-once。详情见 docs/04 8.1 与 docs/11；真实 Figma 最终验收仍待用户，完整崩溃/Undo 矩阵未据模拟测试宣称通过。

## 8. 费用与发布

核心链路不依赖云服务、AI 或付费转换 API。用户仍需 Figma 账号及文件编辑权限；超出当前套餐的功能不能通过插件绕开。自用版先产出本地开发插件与 Windows 分发包；公开发布、企业私有插件、签名证书和自动更新另设任务。

发布前输出 Electron/Chromium、插件构建、协议与转换规则版本。自动升级不在首版实现范围；每个已验证版本保留可回退安装包和对应文档。
