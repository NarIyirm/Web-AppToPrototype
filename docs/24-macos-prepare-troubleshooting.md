# BUG-003：Mac准备命令未找到应用

2026-10-20。最新状态：closed / user_verified。用户在修复包交付后确认“现在桌面端的都没问题了”，记录为整体使用复验通过。未新增codesign、Gatekeeper或公证专项报告；下文保留开发时的待验证记录。

用户在旧开发包运行Prepare Mac.command，终端只输出“请指定 WebToPrototype.app。”，随即结束。之后启动应用仍提示损坏。旧包时间戳为2026-10-20T02-05-03-382Z。

该输出来自prepare-app.sh的入参/目录检查，发生在codesign之前。实际旧ZIP含有完整WebToPrototype.app/Contents及正确的启动参数；但旧入口只接受与.command同目录的应用，没有查找已移入“应用程序”的副本，也没有打印实际检查路径。这能解释应用移走后的准备失败。用户尚未提供当时实际.app位置，因此不把“已移走”写成已证实事实，也不能将所有“已损坏”提示都归因为此问题。

## 修复

- 使用独立Prepare Mac.command源码打包，优先查找同目录应用，其次当前用户/系统应用程序目录；可通过终端明确传入完整路径。
- 同时发现两个安装副本时停止；同目录残缺时停止，不转而签其他副本。先核对应用标识及处理器，才进入签名。
- 显示实际目标、缺失路径和失败原因，保存Prepare-Mac.log.*，终端窗口等回车后关闭。
- codesign签名/递归严格校验成功后另行运行spctl评估。日志明确区分签名完整、Gatekeeper接受与应用实际运行。
- 独立归档检查器新增准备工具逐字节比对、脚本LF/shebang/执行权限检查，防止打入旧入口或Windows换行脚本。

## 开发验证及边界

6项Python归档规则、9项实际Bash路径选择回归与5份脚本语法检查通过。路径回归覆盖缺失、已移入系统或用户Applications、同目录优先、残缺包拒绝、两个副本拒绝、显式选择、空格/中文/字面shell字符及多参数拒绝。这些在Windows Git Bash执行，没有模拟codesign成功或声称Mac启动通过。

首次测试的Python部分通过，Git Bash初始化被Windows沙箱MSYS对象权限阻止；正常权限重试通过。应用/插件/转换器源码未因本次修复修改，旧Windows及已接受Figma范围保留，不重复验收。

当前无真实Mac可执行环境，不能确认用户机器的签名结果、系统策略或损坏提示已解除。新版候选路径及SHA由release/latest-macos-arm64.json定位。实际归档摘要及证据在生成后追加到本页，保留原包和失败历史。

## 用户复验

完整解压新版候选，保留macos-tools，退出旧进程，再运行Prepare Mac.command。检查显示的目标是要启动的副本；若应用已放入Applications会自动识别。看到“签名完整性校验已通过”后再启动该副本；如提示系统未允许，按[Mac说明](22-macos-release-guide.md)查看单应用允许入口。若仍损坏，提供Prepare-Mac.log.*，尤其是codesign和spctl输出。未提供日志前，不宣称签名或系统策略已通过。

Apple说明修改后的代码与原签名不匹配可能触发损坏提示：[应用已修改或损坏](https://support.apple.com/en-sg/guide/mac-help/mh40619/mac)。签名校验与Gatekeeper接受属于不同检查，开发候选没有Developer ID签名或Apple公证；本次修复不更改系统安全设置。


2026-10-20 BUG-003实际归档：[WebToPrototype-0.1.0-mac-arm64-2026-10-20T03-05-40-044Z.zip](../release/WebToPrototype-0.1.0-mac-arm64-2026-10-20T03-05-40-044Z.zip)，135230549字节，SHA-256 `f8d29f68fb433e9a941991c7d598e5ef2439054048acbc5c0f02ca221b1a1b3a`。独立检查630条目、319内容文件、14个Framework链接、37份构建/准备工具源码匹配；旧新.app内304份内容逐字节摘要一致，仅修改应用外准备工具与说明。6项Python、9项Bash路径回归、5脚本语法通过；证据[verification.json](../evidence/2026-10-20/BUG-003-mac-prepare/2026-10-20T03-06-31-517Z/verification.json)。真实Mac签名、系统策略、启动及损坏提示解除仍未验证，BUG-003为user_retest_pending。没有Git提交。
