# Android 配对回执修复 preview

2026-10-22（Australia/Sydney）。用户在 Android 12 直接安装的 APK 中遇到“配对回执无效”，电脑却显示已连接；同步时间后问题仍存在，同环境 iPhone 正常。用户要求同步 GitHub 并重新构建 Android preview。

## 源码与构建

- 修复提交：[3b205f5](https://github.com/NarIyirm/Web-AppToPrototype/commit/3b205f50a0c0b38656d2155714ee0b2b13ad693a)，已推送 GitHub main。
- [EAS Android preview 构建](https://expo.dev/accounts/gress-26s2/projects/webapptoprototype/builds/9f972a76-4401-46e6-8cae-054179aaad8c)：1.0.1（versionCode 3），应用标识 com.nariyirm.webapptofigma，复用既有远程 keystore，当前等待云构建完成。

## 改动与验证

配对回执新增电脑 serverTime，手机按会话时长建立本地到期时间；旧电脑回执允许有限小时钟偏差。手机在保存连接前携带令牌确认会话，电脑在确认后才显示已连接。回执校验或确认失败时尽力撤销已发出的凭证；未确认会话在30秒后不可激活。错误码区分凭证、回执格式、分块规格、时钟、会话时长与会话确认，不展示凭证。

桌面类型检查、168项测试及构建通过；移动 lint、类型检查与72项测试通过。包含真实本机 HTTPS/LAN 收件服务、分块/摘要、确认及失败撤销测试。Android 安装包仍走原生固定证书 HTTPS，iOS v2 配对仍走既有加密 LAN；本次没有未经证实地切换安卓通道。

Android 真机上具体哪个字段导致旧包报错，尚未取得日志，仍需安装新 APK 复测；自动测试不等同真机修复确认。

## 桌面配套

完整的 serverTime 与确认后显示连接逻辑需要桌面运行本次提交。使用源码时，在根目录重新启动 `npm start`。本次用户要求仅重建 Android preview，已有桌面安装包尚未重新打包；新 APK 对旧桌面仍保留回执兼容处理。
