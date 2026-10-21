# App 引导采集与发送

后续新增：Expo Go 现在可以使用明确标注的内置示例体验完整操作流程，不必先导入自己的截图。见[体验模式](31-expo-go-capture-demo.md)。下文真实系统采集的安装包要求保持。

2026-10-21。MOB-05A / MOB-05I 的交互与原生源码增量；手机真机、原生编译和真实 Figma 验证待用户。没有触发 Expo 构建、修改 app.json/EAS 或提交推送。

## 当前操作

手机“添加画面 → 转换手机 App 画面”。顶部显示开始采集、打开目标 App、预览并发送三个实际步骤，项目更换放到下方。默认采集一个画面；从相册导入 1 张也使用同一预览/框选/发送流程，导入多张仍保存到项目。

- Android：开始采集 → 允许悬浮按钮（首次）→ 返回并授权系统共享 → 手动打开目标 App（系统支持时可选单个 App）→ 定位页面 → 点击可拖动的“采集当前页”→ 按钮隐藏后读取新帧 → 保存一张并停止共享 → 返回应用预览。完成通知在系统允许通知时可点击返回采集页；未允许通知可手动返回。60 秒有效，拒绝/取消/超时不会代入之前的画面。
- iPhone：开始采集 → 看三步指引 → 点击系统按钮，选择“界面采集/开始广播”→ 打开目标 App，目标页面停留约 3 秒 → 使用顶部系统录屏状态或控制中心停止 → 返回后默认预览本次最后一张候选画面。若提前返回，明确提示先停止；主 App 的原生前后台标记使扩展跳过本应用画面。
- 预览：选择“整张画面”或“框选部分”，拖动框选需要的范围，也可输入精确像素范围。点击“确认并发送到电脑转换”，先保存到项目再发送；也可只保存到项目。发送页返回后，相同画面/选区/项目复用已保存画面。更换选区或项目会保存一个新画面。
- 已连接电脑：确认后进入发送页并直接发送这张/这批画面。未连接：保留已选内容，扫码并确认电脑，连接成功后继续发送。失败只保留重试入口，不自动反复重传。普通发送入口仍需主动选择发送。
- 其他采集画面按需展开，可改选较早画面、丢弃或批量选择 1–5 张保存并发送。保存成功后才移除所选原生源帧；清理失败不使已保存画面失效。

## 实现与边界

Android MediaProjection 服务不再定时落盘。只有用户点悬浮按钮后才隐藏窗口、丢弃旧缓冲并用同一 VirtualDisplay 恢复输出，等待新帧；4 秒没有新帧则提示重试，不发送旧缓冲。停止、返回本应用和取消会阻止后续保存；会话最大 60 秒。RGBA 缓冲/缩放/图像写入保留在原生工作线程，输出边长 2048、10MiB，收件上限 20 张。悬浮按钮需要 SYSTEM_ALERT_WINDOW，权限拒绝时保留截图入口，未申请查询全部安装应用权限。

iOS 仍是 ReplayKit 广播，不能在其他 App 上显示本应用的提示或悬浮采集按钮。每约 3 秒保留候选帧，最长 60 秒；当前会话的候选可滚动替换以保留最新画面，最多 20 张，之前会话的画面不自动删除。App Group 中原子前后台标记跳过主应用与最初 1.2 秒切换；进程持有非阻塞文件锁用于区分广播暂停、正常结束和进程意外退出，避免只凭旧时间戳判断停止。最后一张仍需用户预览确认，系统面板/切换/目标 App 内容不能靠画面自动判定。

新 JS 检查 guidedCapture 能力。旧原生包不会调用新悬浮 API，提示更新并允许处理已有帧；Expo Go 只提供截图导入与预览。实际系统采集需要包含本次原生模块/ReplayKit 扩展的安装包；iOS 标识、App Group 与签名在用户之后的 Expo 构建阶段配置，不代选。

直接发送只接受本次“发送转换”点击产生的内存一次性请求，绑定项目和完整画面集合，15 分钟过期、最多 8 个。外部深链参数本身不能触发自动上传。连接重新核实后才准备/发送；电脑收到、电脑转换、Figma 导入仍是三个不同回执，手机收到成功不代表已转换或已导入。

修正三个自定义模块及 CNG 扩展的 Swift 语言模式 5.9 → 5.0。5.9 是工具链版本，不是 Swift 5 语言模式值；没有改变 Expo SDK、依赖版本或用户项目身份。

## 本次检查

移动 npm run verify：契约、lint、类型、57 项测试和 app.json/53 份暂存保持性通过。新增逻辑覆盖新会话没有画面时不回退旧图、恢复排序、反向/越界/小幅/非有限框选、发送请求的项目/集合约束、一次性、过期和数量上限；CNG 合成配置核对语言模式。最终报告见移动 docs/verification/2026-10-21-guided-app-capture-check.json 与父 evidence/2026-10-21/MOB-guided-app-capture。

没有运行 Kotlin/Swift 原生编译、两端系统授权/悬浮/ReplayKit、手机裁切手势/扫码或真实 Figma。桌面代码和素材契约未改变，不重跑旧桌面验收。用户按移动 USER-VERIFICATION 最新段反馈。

## 官方依据

- [Android MediaProjection 与单 App 共享](https://developer.android.com/media/grow/media-projection)
- [悬浮窗类型与权限](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#TYPE_APPLICATION_OVERLAY)
- [系统悬浮权限设置](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_OVERLAY_PERMISSION)
- [ReplayKit 系统广播按钮](https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview)
- [Apple flock 进程锁](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/flock.2.html)
- [Expo SDK57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)、[Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)、[原生 Module API](https://docs.expo.dev/modules/module-api/)
- [Swift 语言模式](https://www.swift.org/migration/documentation/swift-6-concurrency-migration-guide/enabledataracesafety/)
