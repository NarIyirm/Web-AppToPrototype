# macOS Apple Silicon 开发与验收

2026-10-20。用户授权新增Mac端，并指定Apple Silicon（M系列）优先。共享现有转换核心、项目状态和Figma协议，主包1.0.0/应用0.1.0候选；保留BUG-002全页修复、原简约工作台、长页和可编辑图层。Intel脚本作为可选入口，不据此宣称已验证。

## 当前状态

Mac窗口/菜单/字体适配、跨主机ZIP打包、Mac本机准备和DMG脚本已加入源码。已取得锁定Electron44.9.0的官方arm64与x64运行时，下载时使用npm随附SHA-256校验。arm64运行时声明最低macOS13.0。

续接检查已通过：141项自动测试、两套类型/构建及6项归档规则检查。本版提供Apple Silicon ZIP开发候选，实际产物及独立归档核验通过release/latest-macos-arm64.json定位。当前机器是Windows，不存在本轮真实macOS运行、签名、公证或Figma验证；不能把ZIP结构检查当作Mac已运行。此前自动审批额度中断已解除，历史记录保留。

## 开发构建

需要Node24、锁定npm依赖和Python3.10或以上。Python仅供开发打包，最终使用者不需要安装Node/npm/Python。项目目录执行：

```sh
npm ci
npm run check
npm run test:mac-package
npm run package:mac
```

默认生成Apple Silicon ZIP。Intel入口为`npm run package:mac:intel`。脚本默认从官方Electron发行源取得与package-lock一致的运行时，不替换本机node_modules/electron/dist；缓存放在.runtime/electron-cache。不会覆盖或删除旧Windows/源码基线。

Windows跨构建保持ZIP内Unix可执行位和Framework符号链接，不在Windows磁盘解开或伪造这些链接。产物包含WebToPrototype.app、FigmaPlugin、使用说明、macos-tools、本机准备命令、MAC-BUILD.json、Electron/AJV许可与SHA256SUMS。包内CPU类型、Info.plist和架构元信息必须匹配。

应用资源放在WebToPrototype.app/Contents/Resources/app，保持apps/desktop/dist与fixtures层级。现有ROOT路径、隔离浏览器、本地43821桥接和PNG/SVG/ZIP等功能使用同一实现；不另建云端转换服务。

## Mac本机准备与安装

跨构建ZIP是开发候选，尚无Developer ID签名/Apple公证。先在Mac完整解压整个ZIP，保留`Prepare Mac.command`与同目录`macos-tools`。退出已运行的应用，再执行`Prepare Mac.command`。新版优先准备同目录的WebToPrototype.app；如果已移入系统或当前用户的“应用程序”，会自动查找该安装位置。存在两个安装副本时停止，请在终端明确指定目标：

```sh
/bin/bash "./Prepare Mac.command" "/Applications/WebToPrototype.app"
```

命令会显示实际目标路径，将输出保存为`Prepare-Mac.log.*`（目录不可写时保存到系统临时目录），结束后按回车关闭窗口。找不到应用或解压不完整时，打印检查过的完整路径并停止，不会显示成功；只移动.command而没有macos-tools也无法准备。终端手动指定路径时，从解压目录执行上面的命令；路径必须放在引号内。

该步骤核对应用标识/处理器，然后用Mac自带codesign由内向外签名Mach-O、嵌套Helper/Framework及外层应用，最后递归严格校验；只启用Electron JIT所需entitlement。签名完成后另行运行spctl评估并记录结果。不会关闭Gatekeeper、删除隔离属性、要求sudo或更改系统安全设置。签名校验成功不等于功能验证、Apple公证或Gatekeeper允许打开。若系统阻止打开，使用系统“隐私与安全性”中的单应用允许流程；若没有允许入口或仍提示损坏，请提供准备日志，不能据此宣称已解决。签名顺序依据[Apple代码签名说明](https://developer.apple.com/library/archive/technotes/tn2206/_index.html)。

签名完整性校验通过后，将.app拖入“应用程序”并运行；如果已在“应用程序”中，则启动日志显示的同一副本。Figma插件可使用包内FigmaPlugin目录；请放在不会随后删除的固定位置，也可使用.app内Contents/Resources/app/apps/figma-plugin/dist/manifest.json。插件沿用原ID，新版字体解析需要关闭重开插件。桌面重启后重新配对；无需重验此前已通过的Windows范围。

2026-10-20已收到旧包反馈：“请指定 WebToPrototype.app。”后退出，随后应用提示损坏。该日志证明旧准备流程没有找到同目录应用，签名未开始；不能把这次运行当作签名成功。新版修复路径查找和日志，但实际Mac签名/启动仍待复验。旧包完整性检查不等于用户解压位置、签名及系统策略都已验证。

正式面向普通用户分发前，应在Mac完成Developer ID签名、公证及干净用户运行验证。需要Apple开发者账号/证书和Mac环境，本轮没有代建账号或上传Apple服务。相关要求见[Electron签名说明](https://www.electronjs.org/docs/latest/tutorial/code-signing)。

## Mac原生操作

- 红色关闭按钮隐藏窗口，保留当前浏览器状态、项目和连接；点击Dock图标恢复。Command+Q真正退出并释放服务。
- Command+L切回地址栏并选中地址，原生编辑菜单提供Command+C/V/A等操作。
- 保留Mac标准标题栏，不把交通灯覆盖到网页工具栏；WebContentsView仍按内容区108px顶部、32px底部和原侧栏尺寸布局。
- 工作台优先使用Mac系统字体。Figma解析新增Apple系统字体、Menlo/SF Mono、PingFang SC和Apple Color Emoji候选；只选择实际可用字体并保留替代诊断，不承诺逐字缺字或跨平台像素完全一致。
- 数据使用Electron的当前用户应用数据目录，具体位置见“诊断与文件工具”。Windows项目通过备份项目或JSON/ZIP迁移，不复制浏览器Cookie或外部Chrome资料。

## 原生DMG

仅在Mac上可执行：

```sh
npm run package:mac -- --dmg
```

脚本用ditto解开新ZIP，在新目录完成本机签名，添加Applications拖放入口并调用hdiutil。默认是本机ad-hoc开发签名；可通过MAC_SIGN_IDENTITY指定已在钥匙串配置的身份。没有自动公证或网络上传。输出若存在会拒绝覆盖，中间签名目录保留。DMG创建、codesign和Gatekeeper行为不能用Windows上的结构检查证明。

## 本地验收

| 编号 | 必须在Mac执行的检查 | 当前状态 |
|---|---|---|
| MAC01 | 解压可执行位/Framework链接正确，签名校验与独立启动 | 待Mac |
| MAC02 | 关闭隐藏、Dock恢复、重复启动、Command+Q退出/释放43821 | 待Mac |
| MAC03 | Command+L及复制/粘贴/全选在地址栏与源页正常 | 待Mac |
| MAC04 | Retina/缩放/窗口调整后选择、矩形、原生内容坐标准确 | 待Mac |
| MAC05 | 本地长页、懒加载、动态全页BUG-002、取消与恢复 | 待Mac |
| MAC06 | 状态/热点/连线、历史/备份与JSON/ZIP保存重开 | 待Mac |
| MAC07 | Figma配对/发送、字体/图片/原生编辑、Overlay播放 | 待Mac与用户Figma |
| MAC08 | 干净用户目录/另一台Mac、签名和DMG安装 | 待Mac |

源运行可用`npm run smoke:workflow`、`npm run smoke:layout-changes`及既有受影响专项。验证.app时设置W2P_APP_PATH指向`WebToPrototype.app/Contents/MacOS/Electron`；该可执行文件名保留Electron，Finder显示WebToPrototype。工作流脚本在Mac使用系统PATH，不依赖用户的Node/npm。

结构性打包检查使用合成小运行时，只证明归档规则、SHA、Mach-O架构标识、可执行位/链接和路径保护；不能当成Mac应用已运行。所有真实报告、失败和待验证状态写入PROGRESS与USER-TEST-RESULTS。

## 本批开发证据

141项自动测试、两套类型/构建、6项Python归档规则通过；Windows文字28项、完整项目29项、真实平台命令4项通过，均不冒充Mac已运行。实际ZIP的CPU、权限、文件摘要、14个Framework链接以及当前构建一致性由独立检查器核对。详细路径/失败/边界记录在项目的docs/23-macos-verification.md；该开发证据文档不随运行包附带。本说明随开发候选交付，打包后的摘要核验另存证据，不回写已校验ZIP。
