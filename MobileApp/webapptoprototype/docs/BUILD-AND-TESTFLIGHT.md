# WebAppToFigma 打包与 TestFlight

更新：2026-10-21（Australia/Sydney）。移动端命令均在 `E:\WebToPrototype\MobileApp\webapptoprototype` 执行。

## 当前发布：1.0.1

用户已授权新版构建和 iOS 自动上传。iOS production 1.0.1（5）与 Android preview 1.0.1（2）均已成功，文件在根 `release/`；Android APK 与桌面 0.1.1 从 [GitHub Releases](https://github.com/NarIyirm/Web-AppToPrototype/releases/tag/v0.1.1) 下载。

iOS build5 已自动上传至 App Store Connect，Apple 已处理成功，目前为“缺少出口合规信息”。请在 [TestFlight](https://appstoreconnect.apple.com/apps/6825243915/testflight/ios) 打开 **1.0.1（5）**，完成该构建的加密问卷；完成后再测试本次界面和系统录屏入口。不要重新提交已上传的同一构建。后续构建可复用 eas.json 中既有 ascAppId / appleTeamId 和 EAS 保存的 API key，真实密钥不入库。

本次 EAS 自动提交的 `what-to-test` 字段因套餐限制被服务拒绝，移除该字段后按同一 build ID 独立提交成功，没有因此重建或重复上传。完整结果及摘要见[本次发布记录](../../../docs/33-release-0.1.1-mobile-1.0.1.md)。下文保留 1.0.0 的签名配置及历史排错过程。

## iPhone 扫码连接修复（2026-10-21）

用户确认 WebAppToFigma 的本地网络访问已开启，但同一 Wi-Fi 下 Expo Go 能连接、独立包失败。检查实际 build3 IPA 已包含 NSLocalNetworkUsageDescription 和 NSAllowsLocalNetworking=true，因此不能把旧提示视为权限诊断。此前正式包优先使用原生固定证书 HTTPS，Expo Go 使用 v2 AES-GCM 加密局域网通道；原生失败原因还没有手机原始错误佐证。

新版 iOS 对 v2 二维码统一走既有认证加密通道，配对、状态查询与分块发送保持同一通道，不因失败切换通道。Android 独立包与旧协议继续使用固定证书 HTTPS。错误提示区分超时、安全校验与明确的权限拒绝，不再把普通失败都建议为开启权限。

修复包：iOS production 1.0.0（4），构建 `e638f6f8-c197-4493-8a48-ccd52cb2a542`，云构建已成功。IPA 在根目录 `release/WebAppToFigma-1.0.0-ios-production-4.ipa`，包内版本/权限/内置修复代码核对通过。请按下方提交命令上传这次新构建，并在 TestFlight 选择第 4 版；保留电脑接收窗口，重新生成二维码，扫码并在电脑允许连接。第 3 版不会自动包含修复。

## 本次应用身份

| 项目 | 值 |
|---|---|
| 安装显示名称 | WebAppToFigma |
| iOS Bundle ID | com.nariyirm.webapptofigma |
| Android 包名 | com.nariyirm.webapptofigma |
| iOS 录屏扩展 ID | com.nariyirm.webapptofigma.capture-broadcast |
| iOS App Group | group.com.nariyirm.webapptofigma.capture |
| 版本 | 1.0.0；构建号由 EAS 远程管理 |
| Expo 项目 | @gress-26s2/webapptoprototype |
| Expo 项目 ID | 9b9900b7-a3e1-446a-9352-94547e2143b6 |
| 生效配置 | app.config.ts、eas.json |
| 新图标 | assets/webapptofigma-icon.png |

保留原 Expo slug、owner、projectId 和 URL scheme；显示名称、图标与平台标识在 app.config.ts 中覆盖。录屏扩展与主应用分别签名，共享 App Group。扩展无需单独创建 App Store Connect App 记录。

## Android preview

```powershell
npx eas-cli@latest build --platform android --profile preview
```

preview 生成 release APK，包含 JS 与本地原生模块，可下载安装，无需 Expo Go 或 Metro。首次构建已由 EAS 生成远程 keystore；后续构建继续复用，勿更换签名。

首次 Android 构建 1235cc07 因三个本地模块缺少 SDK57 插件要求的 defaultConfig.versionName 失败，已按已安装官方模块补齐版本字段。第二次 Android 构建 4b360f69 在录屏模块出现 Kotlin 帧列表泛型推断错误，已明确 Map 与空列表类型后重试。当前[Android preview 构建页](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/e7eeae3b-5195-41e8-bfa9-d58500b011d9)。本次重试已成功，APK 在根目录 `release/WebAppToFigma-1.0.0-android-preview-1.apk`，版本1.0.0、versionCode1。包内JS、三个本地模块、录屏服务、四种CPU架构与v2签名区块检查通过；真机安装/运行由用户验收。

完成后在 Android 手机打开构建页下载 APK；按系统提示允许当前下载来源安装，然后打开 WebAppToFigma。测试截屏采集、OCR、系统授权、同 Wi-Fi 扫码传电脑。系统采集涉及原生模块，需实际安装后验证。

## iOS production：先完成签名

需要有效 Apple Developer Program 会员及具有证书/标识权限的 Apple 团队账号。Expo 登录与 Apple 登录是独立的；首次配置请在本机终端输入 Apple 密码及双重认证，不把凭据写入仓库或聊天。

```powershell
npx eas-cli@latest credentials:configure-build --platform ios --profile production
```

按提示选择正确的 Apple Developer 团队，允许为主应用和 CaptureBroadcast 扩展配置分发证书、描述文件及 App Groups。两者需要各自匹配的 provisioning profile。若账号有多个团队，先确认哪一个团队持有该 App，不随意选择。

用户已于2026-10-21完成主应用和录屏扩展的签名配置，使用 Apple 团队 U57D6BB6H7。首次成功的 [iOS production 构建](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/2112359e-5b35-46c6-8289-7e8669b5bcd7)，版本1.0.0、构建号3，已成功完成云构建。IPA 保存在根目录 `release/WebAppToFigma-1.0.0-ios-production-3.ipa`；主应用与扩展的ID/版本/描述文件/App Group/内置JS包核对通过，未执行真机安装。

上次 iOS 构建 b81f8c83 的主应用编译发现 UIKit 视图注册缺少闭包，导致选择了 SwiftUI 重载；已按 SDK57 的 ViewFactories.swift 改为 `View(BroadcastPicker.self) {}` 后重试。录屏扩展在上次已编译和签名通过。

配置完成后打包：

```powershell
npx eas-cli@latest build --platform ios --profile production
```

production 使用 App Store 分发签名，产物为真机 IPA。IPA 需要经过 App Store Connect/TestFlight 分发，不能像 APK 一样直接下载安装。本项目未自动提交 App Store 审核或公开上架。

## 在 App Store Connect 创建新 App

1. 先完成上面的 Apple 标识与签名配置；确认主 Bundle ID 已存在于正确 Apple 团队。若手工注册，在 [Apple Developer 标识管理](https://developer.apple.com/account/resources/identifiers/list) 中创建 App 的显式 Bundle ID `com.nariyirm.webapptofigma`，并与 EAS 使用同一团队。
2. 登录 [App Store Connect](https://appstoreconnect.apple.com/)，进入“我的 App / Apps”→左上角“+”→“新建 App / New App”。需要 Account Holder、Admin 或 App Manager 权限，账号持有人须先接受最新协议。
3. 平台选 iOS；名称填 `WebAppToFigma`（若名称被占用，需选择可用显示名）；主要语言按实际产品选择，例如简体中文。
4. Bundle ID 选 `com.nariyirm.webapptofigma`。不要选 `.capture-broadcast` 扩展 ID。
5. SKU 可填自用唯一值 `webapptofigma-ios-001`；按需要设置用户访问范围，点击创建。
6. 打开“App 信息 / App Information”，记录“Apple ID”这一串数字，即 `ascAppId`。它不是邮箱、Bundle ID 或 Expo 项目 ID。

苹果官方步骤：[创建 App 记录](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/)。

## 上传 IPA 并通过 TestFlight 安装

App 记录创建且 production 构建成功后，在移动端目录执行：

```powershell
npx eas-cli@latest submit --platform ios --profile production --id e638f6f8-c197-4493-8a48-ccd52cb2a542
```

选择本次成功的 production 构建，按提示关联正确 Apple 团队和刚创建的 App；可使用 EAS 支持的 App Store Connect API Key 方式认证。若有多个构建，按构建 ID 选择，避免上传旧版本。API 私钥和密码不提交 Git。

也可在 eas.json 的 submit.production.ios.ascAppId 填入刚获得的真实数字 ID，再提交；当前没有填写占位 ID。Windows 可以通过 EAS Submit 上传，不需要本机 Xcode。上传后等待 Apple 处理，在该 App 的 TestFlight 页查看构建。

如提示缺少出口合规信息，在 App Store Connect 按实际加密使用填写。项目包含加密素材传输，当前未擅自把 ITSAppUsesNonExemptEncryption 设为 false；是否需要文档以 Apple 问卷及实际技术情况为准。

自己先测：进入 TestFlight →“内部测试 / Internal Testing”旁“+”，创建测试组，添加本次构建和有该 App 访问权限的自己。iPhone 安装 Apple 的 TestFlight App，通过邀请接受测试并安装 WebAppToFigma。内部测试者须是符合权限的 App Store Connect 用户。

邀请其他人：在“外部测试 / External Testing”建组，补测试说明、反馈邮箱和审核联系信息，加入构建并提交 TestFlight App Review。首次外部测试构建需要 Beta 审核，通过后可邀请邮箱或启用公开链接。TestFlight 外部审核与正式 App Store 上架是不同操作。

官方资料：[Expo iOS 提交](https://docs.expo.dev/submit/ios/)、[内部测试](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)、[外部测试](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)、[加密合规](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)。

## 桌面安装包

根目录 `release/latest-windows.json` 与 `release/latest-macos-arm64.json` 指向本次 Windows x64 ZIP 和 Apple Silicon Mac ZIP。Windows 整包解压后运行 WebToPrototype.exe，也可运行 Install.cmd。Mac 整包解压，保留 macos-tools 与 Prepare Mac.command，按包内说明完成本机签名准备，再运行 WebToPrototype.app。

Mac ZIP 已做结构、CPU、链接及文件摘要校验，但跨构建环境没有执行真实 Mac 应用；本包没有 Developer ID 签名/Apple 公证。详细说明见根 docs/22-macos-release-guide.md。Intel Mac 需另用根目录 `npm run package:mac:intel` 生成。

## 本次最终结果

后续 iPhone 连接修复已生成 iOS production 1.0.0（4），替代第 3 版用于下一轮 TestFlight 验证；Android 与桌面包继续使用本次已有产物。最新文件由 release/latest-mobile-builds.json 指向。

Windows x64、Mac ARM64、iOS production 1.0.0（3）与 Android preview 1.0.0（1）均已生成。四类文件均在根 release 目录，SHA-256 校验文件随包保留。手机云构建均为 FINISHED；App Store Connect 上传与TestFlight分发由用户按上文执行，本轮没有自动提交或正式上架。

详细实际检查见[打包结果记录](verification/2026-10-21-release-builds.json)，不把云编译/归档通过当作手机或Mac真机测试通过。
