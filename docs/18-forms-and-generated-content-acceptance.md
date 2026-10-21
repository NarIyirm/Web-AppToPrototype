# 18 m2.8 表单与生成内容第一批

收尾核对：2026-10-20；开发与证据日期保留如下。

日期：2026-10-19（Australia/Sydney）。M2-06c development_complete / verification_pending。用户授权继续下一步，并询问公网是否可转换。m2.5/6/7尚无明确验收反馈，不把继续开发当作通过；m2.4及此前已接受范围无需重验。最终新增范围Figma验证由用户执行。

## 公网页面现在可以转换吗

可以。在应用地址栏输入**公网HTTPS网址**，待页面加载后正常浏览、按需手动登录，再选元素/区块、视口或整个页面转换。使用原有“转换并发送到Figma”或保存JSON后导入。此能力此前已有导航/采集实现，本批补了实际公网样例检查，没有改成仅能读取本地测试页的工具。

本轮实际用隔离Electron会话打开`https://example.com/`，元素、视口、已加载全页转换、浏览器隔离及公网HTTP拒绝等7项检查通过。证据`evidence/2026-10-19/M2-public/2026-10-19T11-14-44-159Z/`，含3种实际JSON、源截图与report。该样例为普通静态文字页面，未验证真实登录站、图片防盗链或所有公网网站，更没有执行真实Figma验收。

- 公网只允许HTTPS；本地开发页允许`http://localhost:端口`/`127.0.0.1:端口`。普通公网HTTP地址明确拒绝。
- 登录在应用内置浏览器完成，使用独立持久会话；不自动读取Chrome登录信息。弹出新窗口被禁用，依赖弹窗的SSO可能无法完成。
- 图片根资源沿用同一Electron session读取和既有下载限制，但需Referer、特殊授权、站点拦截或不支持格式时仍可能失败，按告警定位。当前固化PNG/JPEG与受限SVG；WebP/GIF等未完成。
- iframe、Canvas、复杂SVG、Shadow DOM、特殊CSS和虚拟列表等仍有现有支持边界。能打开网页，不等于整站每种效果或业务交互都能迁移。
- 全页读取当前路由已展开/已加载内容，可选有界滚动准备，不自动遍历全部路由、Tab和业务状态。

## 启动与本地入口

1. 在`E:\WebToPrototype`执行`npm.cmd start`重启桌面，载入m2.8。
2. 沿用原开发插件与manifest。若仍运行旧构建，请关闭重开并重新配对。本批没有新增协议字段/能力；勾选标记和箭头复用已有inline-svg，文字复用styled-text。
3. 从原长页页尾进入“表单与生成内容基准”，或应用运行时访问[本地表单页](http://127.0.0.1:43821/fixture-forms)。旧工作台和全部测试页保留。
4. 可按区块或整个页面采集，无需滚动准备。图层是静态快照，导入后可修改文字、颜色、边框、圆角和标记；网页输入/提交/弹出菜单行为不会自动迁移。

## 本批用户验收

| 编号 | 操作 | 预期 |
|---|---|---|
| FRM01 | 转换“当前值、占位文字与可编辑内容” | 当前输入值Alpha、select当前label、输入按钮显示文字正确；不出现旧value属性/旧textarea内容。placeholder颜色和透明度保留 |
| FRM02 | 核对密码框及textarea | 密码仅有圆点，包中没有密码值；textarea按当前宽度换行、空行和scrollTop=24显示，完整文字行仍在裁切框内可编辑 |
| FRM03 | 核对disabled/readonly与自定义checkbox | 当前状态对应的颜色/值保留；自定义勾选框已选/未选不同。导入后为可编辑静态图层，不强制锁定或保留网页输入状态机 |
| FRM04 | 比较原生checkbox/radio/select | checked、indeterminate、disabled与选中点/箭头为原生图层近似；存在W_FORM_NATIVE_APPROXIMATED，不要求系统主题/微小边缘完全相同 |
| FRM05 | 转换“绝对定位::before/::after” | NEW、attr生成标签和原正文各出现一次；空content红蓝装饰仍存在；边框、圆角、right/bottom定位与层叠顺序正确。文字、生成框分别可编辑 |
| FRM06 | 核对裁切/透明度/负层及明确边界 | 生成红块遵循所属overflow内圆角，半透明与负层顺序正确；文流前缀/旋转生成内容告警，复杂滑块控件保留外框并告警 |
| FRM07 | 改值/改选中项后重采集，多选独立/合并、严格矩形与保存重开 | 新值与新勾选状态以本次为准；原生生成层、文字及裁切链保留，保存包可独立导入 |

反馈附FRM编号、样例ID、范围、JSON与实际Figma截图/导入报告。源截图是网页对照，不等于转换后的渲染。

## 实现范围与边界

- 读取控件的当前`value`/`selectedOptions[].label`、`checked`/`indeterminate`和计算样式，覆盖常见文本输入、textarea、单选select、输入按钮与勾选控件。placeholder仅在无值时输出。
- 文字在工具自身的闭合Shadow DOM内用隐藏测量元素和Range读取，不修改源页面内容/样式。当前值先检查字符预算；密码只将圆点放入测量节点/JSON。textarea按当前内容宽度测量，每视觉行一个Text，保留空行位置及当前滚动偏移；没有完整段落自动重排。可见表单的完整值行不因显示裁切而丢失，整个控件在采集范围之外时仍会省略。
- 原生浏览器控件的主题、光标、选择高亮、菜单、数字步进/搜索清除按钮、输入交互等不完整迁移，使用W_FORM_NATIVE_APPROXIMATED说明。RTL、竖排、特殊大小写/字形和字距等需核对；日期/时间/颜色/文件/滑块、多行select等为W_FORM_UNSUPPORTED。
- 伪元素第一批只支持能从解析后CSS可靠定位的`position:absolute`矩形生成框，基础纯色/常见线性渐变、均匀实线边框/像素圆角和简单字符串。`attr`需浏览器已解析成字符串。支持before/after顺序、z-index/透明度和现有有效裁切链。
- 文流伪元素、flex/grid内部排版、未解析counter/url/attr、图片生成内容、非均匀/三角边框、百分比/椭圆圆角、复杂变换/滤镜/蒙版/阴影等告警省略。绝对定位auto位置/尺寸不能可靠解析时不猜测。未扩大为所有CSS生成内容支持。
- 继续使用FRAME/TEXT/SHAPE/VECTOR、原有场景顺序与能力声明，主协议1.0.0、adapter web-dom-2，converter m2.8。无新依赖/外部转换服务；字符、节点、时间和全页取消/恢复预算保留，测量元素在finally清除。

## 开发证据

`npm.cmd run check`109项自动测试、桌面/插件两套类型与构建通过。`npm.cmd run smoke:forms`36项实际Electron检查通过，证据`evidence/2026-10-19/M2-forms/2026-10-19T11-27-59-427Z/`，包含当前/更新状态、独立/合并、矩形、保存重开JSON，源截图和report。人工`examples/forms-m2.8.example.json`不是网页证据。

3个装饰框样例仅比较稳定内部颜色区域，最大通道差0/255，每例至少564个通道；对照使用本地场景绘制器与Chromium，不包含字体或原生系统widget像素验收，也不是全图/真实Figma证明。文字28项和SVG51项开发回归通过，其他回归见PROGRESS。公网7项是单次真实网络/采集检查，未使用模拟页面冒充公网。

初次检查发现textarea被裁切范围剔除时丢失不可见的当前值行，修正为可见表单保留完整原生值行；另修正测试中未加content-box边框的尺寸预期。失败证据保留，最终Figma由用户确认。

实现依据[HTML表单控件](https://html.spec.whatwg.org/multipage/form-elements.html)、[input当前值](https://html.spec.whatwg.org/multipage/input.html)与[CSSOM解析样式](https://www.w3.org/TR/cssom-1/)。受限配置是本项目范围，不代表标准只支持这些内容。
