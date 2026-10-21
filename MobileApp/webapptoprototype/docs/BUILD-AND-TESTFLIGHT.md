# WebAppToFigma 打包与 TestFlight

更新：2026-10-21（Australia/Sydney）。移动端命令均在 `E:\WebToPrototype\MobileApp\webapptoprototype` 执行。

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

首次 Android 构建 1235cc07 因三个本地模块缺少 SDK57 插件要求的 defaultConfig.versionName 失败，已按已安装官方模块补齐版本字段。当前[Android preview 构建页](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/4b360f69-2605-4cf7-8042-62f9466fc228)。以页面最终状态为准；排队/进行中不表示已产出 APK。

完成后在 Android 手机打开构建页下载 APK；按系统提示允许当前下载来源安装，然后打开 WebAppToFigma。测试截屏采集、OCR、系统授权、同 Wi-Fi 扫码传电脑。系统采集涉及原生模块，需实际安装后验证。

## iOS production：先完成签名

需要有效 Apple Developer Program 会员及具有证书/标识权限的 Apple 团队账号。Expo 登录与 Apple 登录是独立的；首次配置请在本机终端输入 Apple 密码及双重认证，不把凭据写入仓库或聊天。

```powershell
npx eas-cli@latest credentials:configure-build --platform ios --profile production
```

按提示选择正确的 Apple Developer 团队，允许为主应用和 CaptureBroadcast 扩展配置分发证书、描述文件及 App Groups。两者需要各自匹配的 provisioning profile。若账号有多个团队，先确认哪一个团队持有该 App，不随意选择。

用户已于2026-10-21完成主应用和录屏扩展的签名配置，使用 Apple 团队 U57D6BB6H7。当前 [iOS production 构建](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/b81f8c83-9731-4e0f-9fc8-cb5ca1349f58)，版本1.0.0、构建号2，已提交云端；以最终状态为准。

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
npx eas-cli@latest submit --platform ios --profile production
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
