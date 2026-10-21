# Apple Silicon Mac开发候选验证记录

后续BUG-003：下文为首次候选的历史检查。用户Mac准备未找到应用、签名未开始；修复和新候选见[故障记录](24-macos-prepare-troubleshooting.md)。本页的历史归档通过不能证明Mac启动通过。

2026-10-20（Australia/Sydney）。用户明确新增Mac端并指定M系列，后续“继续吧”恢复已授权检查。开发候选已生成；本记录严格区分共同核心/归档验证与真实Mac运行。

## 实际交付物

[M系列Mac应用ZIP](../release/WebToPrototype-0.1.0-mac-arm64-2026-10-20T02-05-03-382Z.zip)，135227929字节（约135MB），最低macOS13.0，应用0.1.0 / Electron44.9.0 / converter desktop-1.0 / Schema1.0.0。ZIP SHA-256：

fd8e2e605c48d8598297a2cac8cb25cce8de996a4d6c0a21bf27303ac224b5a6

当前定位文件为[latest-macos-arm64.json](../release/latest-macos-arm64.json)，源码基线为[latest-source.json](../release/latest-source.json)。旧Windows包和源码基线保留。Mac ZIP包含WebToPrototype.app、独立FigmaPlugin、Prepare Mac.command、macos-tools、使用说明、许可和SHA清单；未放入开发node_modules、用户项目或真实采集历史。Intel只提供可选构建入口，本批没有生成Intel候选。

使用先读[Mac说明](22-macos-release-guide.md)。首次在Mac解压整个ZIP，按说明运行本机签名准备，再将.app移到应用程序。最终用户不需要Node/npm/Python；开发构建另需Node24与Python3.10+。当前ZIP是跨构建开发候选，未做Developer ID签名/Apple公证；没有生成DMG。

## 开发和归档检查

| 检查 | 实际结果与证据 |
|---|---|
| TypeScript/协议/算法/插件主逻辑等自动测试 | 141项，两套类型与构建通过；[check.log](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/check.log) |
| Python结构测试 | 6项：SHA/CPU不匹配、越界/循环链接、原生权限/链接链、元数据替换；[日志](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/python-package-tests.log) |
| 实际ZIP完整性 | 629个条目，318个内容文件CRC/SHA核对通过 |
| Framework相对链接 | 14个链/目的地校验通过，保留Unix链接标志，不在Windows磁盘解出 |
| ARM64/权限 | 实际Mach-O头CPU和Info.plist匹配，主执行文件及准备命令权限核对 |
| 当前构建一致性 | 32个应用/插件/fixture文件与当前构建逐文件摘要匹配 |
| 原生脚本语法 | 两份脚本bash -n通过，宿主是Windows Git Bash；[记录](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/shell-syntax.json) |
| Windows文字回归 | 28项；[实际报告](../evidence/2026-10-19/M2-text/2026-10-20T01-57-10-018Z/report.json) |
| Windows完整项目流程 | 29项；[实际报告](../evidence/2026-10-20/Desktop-completion/2026-10-20T01-57-11-346Z/report.json) |
| 实际平台命令/隔离 | 4项：地址聚焦/全选、未知命令忽略、源页无桥接、原生采集；[实际报告](../evidence/2026-10-20/Mac-port/2026-10-20T02-00-25-014Z/report.json) |

机器可读汇总：[verification.json](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/verification.json)。Windows报告时间戳是UTC，文字旧脚本目录沿用2026-10-19，不误读成本批测试发生在19日。7个新增生命周期/菜单/字体测试包含模拟事件和字体列表，只证明逻辑；不能当作Mac Dock、菜单引擎或实际字体渲染已通过。

包结构保持Contents/Resources/app/apps/desktop/dist与fixtures等层级，main入口与原ROOT路径相容；没有把Windows可执行文件改后缀冒充Mac。Framework仍使用官方Mac运行时，字节按锁定npm随附SHA验证。打包时重写主/Helper身份，保留其执行文件名和动态链接布局。原生签名按内层代码、Helper/Framework、外层.app的顺序，最后递归严格校验；不自动上传Apple，不更改Gatekeeper或清除隔离属性。

## 失败留痕

前次完整检查被自动审批服务用量限制拒绝，未执行；后续用户恢复请求后按正常审批完成，没有降低权限绕过。源准备阶段的Font.lineHeight测试类型错误已修正，最终141项通过。

本轮Python测试先遇沙箱临时目录WinError5，改为项目.runtime/mac-package-tests隔离目录后通过。首次实际打包把Framework的Versions/Current多级链接当成缺失目标；修正为逐级解析、越界/循环拒绝，补实测链与循环用例后实际包通过。初始不完整ZIP保留但未更新latest。日志见[临时目录失败](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/initial-python-sandbox-failure.log)、[链接链失败](../evidence/2026-10-20/Mac-port/2026-10-20T02-03-51-098Z/initial-framework-link-failure.log)。

Git Bash沙箱内MSYS运行对象被拒绝，正常权限仅做语法检查后通过，不冒充Mac codesign/hdiutil已执行。最终包重新生成并独立检查；旧候选及摘要不改写。签名后会改变.app字节，ZIP原始SHA只校验原归档，不应拿它比较本机签名后的应用。

## 尚待真实Mac/用户完成

MAC01–MAC08全部仍verification_pending：独立启动/本机签名、关闭隐藏/Dock恢复/Command+Q、Command+L与编辑快捷键、Retina/缩放坐标、完整本地流程/BUG-002、状态/历史/文件恢复、Figma原生编辑/原型、干净用户/DMG安装。具体步骤见[Mac说明](22-macos-release-guide.md)，用户结果见[USER-TEST-RESULTS](USER-TEST-RESULTS.md)。

当前没有可访问的Mac执行环境、签名身份或公证凭据。没有真实Mac进程启动、codesign验证、Gatekeeper通过、DMG生成或真实Figma导入报告。首版Windows通过范围保留，不要求用户重复Windows验收。Android、Intel实际发布和正式Apple公证另按后续授权/环境推进。
