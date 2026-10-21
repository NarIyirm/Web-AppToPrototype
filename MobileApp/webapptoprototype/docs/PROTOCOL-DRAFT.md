# 移动素材与电脑接收协议

2026-10-20，alpha.1实现规范。原始素材格式为0.1.0-alpha.1，最终设计包为CapturePackage2.0.0（同时兼容旧1.0.0）。新增v2扫码配对供Expo Go直接发送；独立安装包保留固定证书TLS路径。原生模块编译与手机实际运行仍待用户反馈。

## 契约与来源

2026-10-21 alpha 增量：网页节点可选携带 fontFamily（≤200字符）、fontWeight（1–1000）、lineHeight（1–30000）、textAlign（left/center/right/justify）。旧素材仍可读；新素材需本轮桌面校验器，源 Schema/校验器/摘要及桌面副本已同步。长页沿用一个 capture，logicalHeight 为实际 CSS 覆盖高度，图片尺寸可能缩小；不将缩小后的像素坐标用作 DOM 坐标。未增加凭据、远程资源 URL 或可执行字段。

源类型在src/core/project.ts，JSON Schema在contracts/schema.mjs，生成校验器在contracts/generated。npm run contract:build生成contracts/artifacts/0.1.0-alpha.1，manifest记录源仓库、commit（当前未提交故为空）、AJV运行版本、各文件字节数/SHA。npm run contract:check检查产物漂移。

桌面只消费packages/mobile-contracts/0.1.0-alpha.1的对应副本。移动工程不import父目录，不依赖父工程node_modules。最终场景类型/双读校验以父工程packages/contracts为主来源。

## 原始ZIP

```text
mobile.json
captures/<captureId>/snapshot.json
assets/<sha256>.png
```

mobile.json包含artifactKind=mobile_capture、formatVersion、packageId/revision/createdAt、producer、project、captures、assets。snapshot包含来源/平台、逻辑与图像尺寸、坐标空间、OCR/DOM观察、警告及redacted状态；精确定义看生成Schema，不另手抄不同类型。

sourceKind为web/imported_image/android_native/ios_native；web必须有移除查询/片段/凭据的sourceUrl，非web不携带URL。OCR位置始终使用当前图像像素，DOM节点使用逻辑画布坐标。原生来源不能伪装web。遮挡写入实际像素，清空旧观察，导出只引用处理后资源，不夹带旧源图或会话信息。

首版ZIP只生产/接受无压缩STORE，流式写入分块不超过256KiB；不支持Deflate/ZIP64/加密/数据描述符。路径严格白名单，校验目录与本地头/CRC/资源SHA/PNG尺寸/引用与未知字段，拒绝未声明文件。最大64MiB、每批1–5画面、图片10MiB/边4096、最多16个文件；单项目20画面，本机素材配额256MiB。桌面最终包仍有自己的30MiB资源/10000节点等预算，超过时应拆批，不绕过最终校验。

手机导出不是Figma设计包。桌面读取后做基础DOM或视觉重建，生成2.0，新增mobile-sources能力、mobileSource和每状态来源。旧1.0及其Schema保持；旧插件会拒绝2.0。可靠文字区域必须先清除原字像素，再生成近似TEXT；复杂区域保留图片并告警。原图只作独立参考。

## 配对与TLS

桌面手机接收为按需开启的独立HTTPS动态端口，不复用或暴露Figma的43821回环桥接。关闭接收/退出时作废令牌与临时证书身份，完整收件保留。

QR字段：protocol=w2p-mobile-1、endpoint（私网IPv4 HTTPS动态端口）、certificateSha256（叶证书DER的SHA-256）、code（32随机字节hex）、expiresAt、desktopName。有效2分钟、单次使用。手机先核对电脑，再由电脑确认手机；成功会话15分钟。令牌只在内存，原生客户端逐连接核对证书与主机，禁止重定向，不设全局TLS例外。

当前电脑生成protocol=w2p-mobile-2，保留上述HTTPS字段，新增lan={endpoint,key,id}。lan.endpoint必须为与TLS端点相同私网IPv4的HTTP动态端口；key为32随机字节hex，id为16随机字节hex。Expo Go走加密LAN路径，包含MobileTransfer的安装包走原HTTPS路径。不修改app.json、不安装证书、不关闭TLS校验或增加全局明文网络例外。

LAN只接受POST /mobile/secure，HTTP载荷始终是加密信封{id,body}，不是直接发送JSON素材/令牌。密钥用HKDF-SHA-256从QR key与lan.id派生，request/response的info分别为w2p-mobile-2/request、w2p-mobile-2/response。AES-256-GCM采用12字节随机IV和16字节tag；AAD为w2p-mobile-2/<direction>/<lan.id>/<requestId>；combined为IV|ciphertext|tag，外层base64。请求ID为16随机字节hex，服务器在本接收会话内拒绝重复ID，最多8192条。手机使用SDK自带expo-crypto，电脑使用Node crypto，未自写密码算法。二维码携带连接密钥，应只展示给自己的手机；接收关闭后会清理密钥。

请求明文为{method,path,token,body}，body为JSON或256KiB二进制块的base64；响应明文为{status,body}（body是原接口JSON字符串）。方法/路径严格白名单、外层512KiB、控制正文4096字节、响应最多8192字节，双端验证响应请求ID。没有未加密的配对/上传HTTP路径，无浏览器Origin/CORS通道。明文HTTP网关只把认证通过的请求交给相同收件逻辑，仍需电脑确认、会话授权、SHA及素材合同检查；它与Figma回环桥独立。关闭接收同时关闭两个端口。手机需获得系统的本地网络访问许可。

LAN wire/client源在移动src/core/lan-{wire,client}.ts，桌面消费packages/mobile-lan/v2副本；移动不依赖父工程。此改动不改变素材包合同版本。

## 当前HTTP接口

所有路径均在手机接收端口，非配对接口需要Authorization: Bearer会话令牌。拒绝浏览器Origin、外网来源与未知路径。

| 方法/路径 | 语义 |
|---|---|
| POST /mobile/pair | JSON：code/deviceId/deviceName；电脑确认后返回sessionToken/expiresAt/chunkBytes |
| GET /mobile/session | 查询当前会话是否仍有效及到期时间 |
| POST /mobile/disconnect | 使当前会话失效 |
| POST /mobile/uploads | JSON：packageId/sha256/bytes；创建或查询同一摘要上传 |
| GET /mobile/uploads/<sha> | 查询nextOffset/bytes/status |
| PUT /mobile/uploads/<sha>/<offset> | application/octet-stream，最多256KiB；顺序写入并持久确认；相同旧块内容可重试 |
| POST /mobile/uploads/<sha>/commit | 完整SHA、素材合同及资源检查后原子提交收件 |

收件名仅由SHA生成，不能传任意文件路径；5个会话上传/128MiB声明预算，持久收件最多20份/256MiB。用户可从电脑收件箱删除原始收件，已保存项目继续保留。

回执status为receiving/received，converted=false、figmaImported=false。只有电脑“转换并打开”完成后才算转换，只有真实插件结果才算Figma导入。素材接收不会自动猜测交互或重复向Figma发任务。

## 中断与未完成范围

当前支持同一有效会话、同一准备包在页面内的分块暂停/重试和丢回执查询。完整收件按SHA幂等并跨电脑重启保留；电脑重启必须新配对，旧未完成.part在新会话清理，手机重新发送。手机进程退出后的待发任务恢复尚未实现。一次传输成功不代表四组合、后台及内存通过。

后续包括跨进程恢复日志、更多异常矩阵、状态回传细化、视频/长页扩展；改变合同需新版本及夹具/消费者同步。执行/证据见PROGRESS，用户验收见USER-VERIFICATION。

## 主要API依据

- [当前Expo 57](https://docs.expo.dev/versions/v57.0.0/)、[文件系统](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)、[相机](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
- [Expo CNG扩展声明](https://docs.expo.dev/build-reference/app-extensions/)
- [Android MediaProjection](https://developer.android.com/media/grow/media-projection)
- [Android局域网权限](https://developer.android.com/privacy-and-security/local-network-permission)：SDK58默认target36当前不申请新权限；未来升target37时需一并迁移权限声明/运行时请求，不能只改target数值。
- [Apple系统广播picker](https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview)、[广播sample handler](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)

这些是实现依据，不是本机安装/签名成功证据。
