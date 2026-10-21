# 一键整页与手机 App 转换

2026-10-21。用户已确认上一批网页与原型功能验收通过，本批增加横纵整页采集并推进手机 App 素材转换。保留原流程、SDK57、app.json、EAS 及暂存内容，没有触发手机构建、提交或推送。

## 使用

1. 电脑关闭旧实例，在 `E:\WebToPrototype` 运行 `npm start`；手机刷新 Expo Go。
2. 手机打开网页后点击 **一键转换整页**，自动采集横向和纵向内容并保存为一个画面。结束恢复原滚动位置；可取消。电脑“网页采集”底部也有 **一键转换整页**，直接转换已加载的横纵页面，不必先选择区块。
3. 手机首页进入 **转换手机 App 画面**，在目标 App 截图后返回，选择 1–5 张截图。批次去重后保存到项目；有手机识别模块时先自动识别，Expo Go 则在电脑接收转换时尝试离线识别。
4. 手机选择项目画面扫码发送；电脑“手机素材 → 转换并打开”。在“转换结果”筛选可编辑文字或保留图片。选择文字图层后可校对内容并点击 **保存文字到转换结果**，源图保留用于对照。
5. 加入原型项目，保存点击区域和动作，试播后生成项目发送 Figma。已加入项目的状态是独立副本；修改转换结果后应重新加入所需状态、重新生成项目。

## 系统录制

同一手机 App 页面中展开“也可以录制 App 画面”。现有原生模块可用时，Android 使用系统授权/停止，iOS 使用系统广播选择器/系统停止。结束回来勾选缩略图，一次保存 1–5 帧；整个批次持久保存后才清理对应临时帧。手机自动文字识别失败仍能保存图片、交电脑继续处理。

Expo Go 可导入 App 截图并传给电脑转换。系统录制及手机原生 OCR 需要包含现有模块的安装包；仍沿用户的 GitHub → Expo 官方构建流程，本轮没有触发构建。两端系统录制的源码已存在，本轮补充产品流程，不能把 Windows 的检查当成 Android/iOS 原生安装证据。

## 范围和边界

- 手机整页按横纵网格读取实际滚动位置，最后一块被浏览器夹紧时只拼接自己负责的区域，避免横纵重叠。上限：每轴 12,000 CSS px、逻辑面积 1800 万、40 块、60 秒循环，PNG 预览最多 400 万像素/4096 边长/10 MiB。达到上限仅保存已完成的整行矩形，并说明部分范围，不保存带空洞的“完整”结果。
- 页面在采集中懒加载变长/变宽，会说明本次只覆盖开始时的范围。内嵌滚动、虚拟列表、持续变化页面不保证完整。固定/已出现的吸顶内容后续块隐藏，结束恢复样式与原位置。段边界裁切的文字保留像素。
- 电脑整页按当前网页布局读取完整加载范围，宽最多 12,000px，高沿用 30,000px 等现有预算；不会拉宽视口导致网页重新排版。源参考可能只覆盖左侧视口，转换预览可勾选完整画面；可编辑布局包含横向超出部分。横向懒加载不自动遍历所有内部滚动区。
- 电脑 OCR 只调用本机系统：Windows 使用已安装语言的 Windows.Media.Ocr，macOS 使用系统 JXA → Vision，不需 Xcode/Swift 编译器。没有上传图片、下载模型或增加依赖；缺失引擎/语言、识别失败或超时都保留图片并提示。大尺寸截图先缩小到适合系统引擎的识别尺寸，文字坐标还原至原图；每张最多 500 行、45 秒；转换支持取消，取消不替换旧成功结果。
- OCR 不等于完整可编辑重建。只有通过背景/重叠检查、真正清除原文字像素的区域才生成文字，并近似采样原文字颜色；复杂背景、图标和不可靠文字区域仍是图片。App 内部 DOM、代码及业务逻辑不会被读取，原型跳转由用户手工设置。

## 本批检查

移动 `npm run verify`：契约、lint、严格类型、51 项测试及用户配置/53 份暂存保持性通过。桌面 `npm run check`：类型、159 项测试及构建通过。合成宽长页实际验证了右侧/底部内容、二维拼接和原位置恢复；自建 App 截图通过真实 Windows 离线 OCR、可靠文字转换/颜色、文字校对、加入项目和生成。

样例识别两行，可靠背景的一行转文字，另一行按规则保留图片；不以识别行数冒充可编辑行数。macOS Vision 的坐标桥有逻辑检查，真实 Mac 引擎未在本机运行；Android/iOS 系统录制/安装、手机二维截图与最终 Figma 由用户反馈。

证据见 `evidence/2026-10-21/MOB-whole-page-app` 及移动 `docs/verification/2026-10-21-whole-page-app-check.json`。初次 WinRT 在沙箱内被拒绝访问，允许本机图片读取后成功；合成页首次因测试文字自身换行而断言失败，固定测试宽度后通过。

官方 API 核对：[Expo SDK57 图片选择](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)、[Windows OCR](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine?view=winrt-26100)、[Apple Vision](https://developer.apple.com/documentation/vision/recognizing-text-in-images)、[Apple JXA](https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/Articles/OSX10-10.html)、[Android MediaProjection](https://developer.android.com/media/grow/media-projection)、[ReplayKit](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)。
