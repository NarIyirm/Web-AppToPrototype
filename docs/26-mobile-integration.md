# 手机素材与桌面集成（alpha）

2026-10-20。移动独立工程在`MobileApp/webapptoprototype`。本轮接入手机原始素材读取、局域网收件、最终场景2.0及旧1.0兼容，保留已有桌面布局与原网页采集行为。用户执行最终手机/Figma验证；当前没有打手机包或触发发布。

## 入口

- 电脑“转换结果→打开手机素材 / 转换包”：读取手机`.w2pm.zip`并重建；也支持识别首项mobile.json的改名ZIP。
- “手机收件箱”：开启独立HTTPS接收、QR/复制配对信息、电脑确认手机、刷新完整收件、转换/删除。
- 转换结果可加入原有“项目与原型”，手工热点/跳转/弹窗/关闭和既有Figma桥接继续使用。

Figma43821服务仍绑定回环地址。手机接收按需监听独立动态端口，证书和会话仅驻留内存，关闭或重启需重新配对。完整收件持久化；部分上传只支持当前有效会话恢复。

## 契约与转换边界

源契约产物在`packages/mobile-contracts/0.1.0-alpha.1`，manifest记录对应移动源码/Schema/校验器SHA与运行依赖，不手工漂移。手机包不是最终设计包。

旧`packages/contracts/capture-package.schema.json`保持1.0。新增capture-package.v2.schema.json及生成校验器；2.0显式声明mobile-sources、原始bundle身份、来源kind/platform，不给原生截图伪造网页URL。新桌面/插件双读，旧插件拒绝2.0。

基础DOM观察生成近似文字/背景/图片区域。OCR只有通过保守背景检查并移除旧文字像素后才生成近似TEXT；复杂或重叠区域保留图片并报告。原始截图只作独立参考，不自动叠到设计根。完整CSS/原生视觉重建、视频与手机长页等仍在移动任务表中。

## 开发证据与用户验证

本轮`npm run check`通过：桌面/插件类型、151项自动测试和编译。包括旧包/新包/混合项目、原字像素清除、TLS证书指纹、单次配对、重放拒绝、分块查询续传、持久收件，以及模拟Figma宿主导入2.0；模拟不等于真实Figma结果。

查看[移动进度](../MobileApp/webapptoprototype/docs/PROGRESS.md)、[当前协议](../MobileApp/webapptoprototype/docs/PROTOCOL-DRAFT.md)、[用户验证步骤](../MobileApp/webapptoprototype/docs/USER-VERIFICATION.md)。手机三个原生模块尚无原生编译/签名/安装/真机证据，Android/iOS及四个传输组合分别待用户验证。

本轮没有Git暂存/提交/推送，移动app.json/EAS用户配置原样保留；桌面新增源码不会自动进入此前生成的桌面压缩包。
