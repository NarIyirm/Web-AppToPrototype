# 仓库与本地文件维护

2026-10-21，按用户要求清理后，将完整源码统一纳入仓库 [NarIyirm/Web-AppToPrototype](https://github.com/NarIyirm/Web-AppToPrototype)。根目录为 Git 工作区，主分支为 main。用户随后将 GitHub 仓库切换为 public，2026-10-21 已读取远端确认。

## 源码目录与检查

| 目录 | 内容 | 检查 |
|---|---|---|
| `apps/desktop` | Electron 桌面应用 | 根目录 `npm ci`、`npm run check` |
| `apps/figma-plugin` | Figma 插件 | 同上 |
| `packages/contracts` | 桌面协议与移动消费副本 | 同上 |
| `MobileApp/webapptoprototype` | Expo 移动端及本地原生模块 | 此目录 `npm ci`、`npm run verify` |
| `scripts`、`tests`、`examples`、`docs` | 构建、回归测试、协议样例与开发文档 | 保留在仓库 |

移动端保留独立 package-lock.json，未加入根 npm workspaces。从移动目录运行 Git 命令同样操作根仓库。移动 app.json、EAS 关联、业务代码和原生模块保持原样；本次不触发 EAS 构建、手机发布或部署。

移动 `verify` 默认执行契约一致性、lint、类型和逻辑测试。原初始化暂存快照只用于历史审计；可选 `--check-initialization` 仅适用于该历史环境，不适用于首次提交后的新克隆。

## 清理范围

清理了旧 Windows/Mac/源码发布副本、根目录重复 ZIP、`.runtime` 下旧测试/解压/下载缓存目录、`.test-build`、应用生成的 dist、Python 字节码及移动端临时验证缓存，共约 5.33 GB。详细删除路径与字节数保存在本地 `.local-maintenance/cleanup-manifest.json`。

清理前核对了 release/latest-windows.json、latest-macos-arm64.json、latest-source.json 所指 ZIP 的 SHA-256；三个最新指针及对应 ZIP、校验文件和已有目录保留。现有发布包是历史构建，不代表最新移动功能源码；需要新的安装包时使用打包脚本重新生成。

验收原始证据 evidence、手工采集 tests/test*.json 与 tests/capture-*.json、运行诊断单文件、依赖 node_modules 和移动 .expo 配置保留本地。验收文档中指向 evidence、release 或 .runtime 的路径属于本地记录，新克隆不包含这些产物，也不据此宣称真机验收通过。

## Git 与忽略规则

移动端原嵌套 `.git` 已移至本地 `.local-maintenance/mobile-git-before-monorepo`，完整保存其配置、对象与53份初始化暂存索引。业务文件按实际工作区内容统一提交，不把移动目录作为子模块。

忽略依赖、构建输出、运行缓存、发布包、原始证据、手工采集样本、维护备份、环境私密配置和签名凭据。协议/回归样例中的 JSON、ZIP 与图片仍保留；不使用全局 `*.zip` 或 `*.json` 忽略规则。

完整源码的普通提交与 push 从项目根目录执行。不要 force push，不要把 `.local-maintenance`、用户采集或发布大包加入 Git；安装包分发需另行安排。

本次上传前检查：桌面 `npm run check` 的类型、159项测试与构建通过；移动 `npm run verify` 的契约、lint、类型与59项测试通过。桌面首次检查因沙箱禁止127.0.0.1连接而失败，允许本机回环后完整重跑通过。已核对 app.json 与原始基线一致、移动端53份原暂存索引备份摘要一致。待提交文件扫描未发现常见私钥/访问令牌格式或超过5 MB的单文件。自动检查会重新生成少量被忽略的 dist/测试缓存；它们不上传。
