# Expo Go 先体验 App 采集

用户反馈修复：框选现在打开独立全屏编辑界面，不在预览滚动页内直接画框；完成后应用、取消保留原选区。固定起点/根坐标位移解决遮罩出现后选框抖动/偏小，详见移动 PROGRESS 第15节与 USER-VERIFICATION 最新段。Expo Go 刷新即可试，不需新包。

2026-10-21。用户希望先体验，再决定是否推进 Expo/TestFlight 安装包。

手机“添加画面 → 转换手机 App 画面 → 体验采集流程（无需打包）”。入口在系统采集模块不可用或未配置时作为主操作，不再只给相册按钮。

## 用户可以体验

- 阅读正式采集的开始指引，选择明确标注的示例商店/示例待办。
- 点击列表进入详情，待办可勾选状态，手动定位需要的画面。
- iPhone 点击“模拟停止并返回预览”，Android 点击“采集当前示例页”。仅捕获示例 View，指引和按钮不进图片。
- 使用既有 ImageRegionPicker 的整张/手势框选/精确范围。
- 真实保存到项目，已有连接直接发送，未连接扫码后继续；电脑按已有步骤真实转换。相同画面/选区/项目重复发送复用保存回执。
- 换自己的 App 截图比较结果，或再体验一个示例状态；不会覆盖原来的保存结果。

## 实现

新增路由 src/app/capture/demo.tsx，示例视图 src/features/capture/example-app.tsx。使用已安装、SDK57 Expo Go 包含的 react-native-view-shot5.1.0 对示例 View 截图，通过现有 normalizeImage 做边长/字节/SHA/私有持久化，finally 释放临时截图。无新增库、原生模块或配置。

示例始终有界面标记，保存时 sourceKind 为 imported_image，名称“流程演示 · …”，告警注明没有跨 App 系统采集。没有伪造系统授权弹窗、已安装 App 列表、系统采集运行状态或原生来源。选自己的截图后恢复普通图片来源说明。发送使用既有一次性内存请求和真实 LAN 链路；电脑接收、转换、真实 Figma 仍分开反馈。

这是操作体验，不验证 ReplayKit、MediaProjection、悬浮按钮、广播扩展签名、跨进程和系统权限。相关真实流程见[引导采集](30-guided-app-capture.md)。用户确认体验后再决定构建，本次未触发构建、提交或推送。

开发检查 npm run verify：契约/lint/typecheck/既有57逻辑测试及app.json/53份暂存保持。没有把 Node 测试写成手机 ViewShot、手势或真实传输成功。手机最终体验由用户按移动 USER-VERIFICATION 最新段反馈；不扩展旧桌面验收。证据在移动 docs/verification/2026-10-21-expo-go-demo-check.json。

API依据：[Expo SDK57 react-native-view-shot](https://docs.expo.dev/versions/v57.0.0/sdk/captureRef/) 与已装5.1.0类型/实现；共用预览和发送沿已有SDK57 API。
