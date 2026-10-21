# 17 m2.7 SVG 与常见图标第一批

日期：2026-10-19（Australia/Sydney）。M2-06b development_complete / verification_pending。用户授权按建议继续SVG与常见图标；m2.5文字、m2.6层叠仍待反馈，不把“继续”作为验收确认。m2.4及更早已接受范围无需重验。

## 启动与入口

1. 在`E:\WebToPrototype`运行`npm.cmd start`重启桌面，载入m2.7。
2. **关闭再运行原本的Figma开发插件**，无需重新导入manifest；本批新增`inline-svg`能力和矢量导入校验，旧运行实例会拒绝新能力。桌面重启后重新配对。仍可保存JSON，再由插件文件导入。
3. 从原长页页尾进入“SVG与常见图标基准”，或应用运行时访问[本地SVG页](http://127.0.0.1:43821/fixture-svg)。旧视觉、文字、层叠与故障测试页均保留。
4. 按区块或整个页面采集。此页无需滚动加载准备；原生结果包含VECTOR数据，插件通过`createNodeFromSvg`创建含路径的Frame。截图附件只是源参考，不是可编辑结果。

## 本批用户验收

| 编号 | 操作 | 预期 |
|---|---|---|
| SVG01 | 转换“内联路径、计算样式与图标精灵” | 房屋图标为莓红圆头描边，菱形为金色填充/深蓝描边；本页symbol/use两个勾分别红蓝且尺寸正确。选中SVG内部路径可选择完整图标 |
| SVG02 | 比较“坐标、组与内部资源” | 非零viewBox红蓝各半；内部translate与整组透明度保持；内部渐变和clipPath不依赖源页面。实际比较圆形裁切、色标和透明交叠 |
| SVG03 | 比较SVG图片和背景 | cover/position、边框/内边距及内圆角与源页一致，背景文字仍为独立Text；百分号与base64数据SVG均可编辑 |
| SVG04 | 比较同一SVG不同比例的fill及overflow:visible | 带viewBox的fill仍遵循SVG自身preserveAspectRatio，测试中图形160×80位于160×100视口中央、圆仍为圆；无viewBox数据图按固有坐标缩放。overflow:visible绿色图形不被额外切掉 |
| SVG05 | 展开图层并编辑路径、颜色和描边 | 有可编辑矢量子层，可以修改节点/填充/描边；不是PNG、整区截图或图片填充。原生辅助Frame是坐标/裁切容器，不要求与DOM一对一 |
| SVG06 | 转换“明确保留的边界”，查看告警 | filter、SVG text、跨文件use、独立SVG文件内style表为W_SVG_UNSUPPORTED并保留外框；平铺SVG背景为W_BACKGROUND_UNSUPPORTED，不只绘制第一块冒充完整 |
| SVG07 | 多选独立/合并、矩形切过图标、保存重开再导入 | 自包含矢量与局部颜色不丢失，外层原生Frame严格裁切；完整路径仍在，保存包可离开源站导入，不要求附带源截图 |

反馈请附SVG编号、源样例ID、范围、JSON和实际Figma截图/导入报告。普通HTML文本继续按原文字链路处理；SVG内部的`text`本批明确不支持，避免错误地将文字全部变成不可编辑轮廓。

## 支持范围与边界

- 内联SVG读取页面计算样式，固化fill/stroke/currentColor、常见描边、组透明度与内部二维变换；基础path/rect/circle/ellipse/line/polyline/polygon、内部渐变/clipPath、常见viewBox/preserveAspectRatio可进入原生SVG导入器。
- 本页`use`/`xlink:href`局部引用展开，支持位于当前SVG之外的本页symbol。实例ID与内部引用重命名，保留各自颜色；不读取跨文件精灵。定义中依赖复杂页面CSS继承的图标仍需实际核对，本批不承诺任意精灵样式。
- `<img>`及单层背景引用SVG沿用现有HTTPS/本地HTTP下载、重定向/字节/超时/取消限制；支持百分号或base64 data SVG。只下载根文件，不再拉取SVG内的任何资源。SVG作为自包含`node.svg`保存，不塞入PNG/JPEG assets。
- SVG文件中的样式表、脚本/事件、外链、image/foreignObject、text、filter/mask/marker、动画、非缩放描边等超出当前受限配置。未知内容拒绝整个SVG并说明，不自动栅格化。图标字体、Canvas图标、CSS伪元素与所有SVG标准特性不据此计入。
- 计算样式冻结后不携带网页脚本、class规则或远程依赖；已有旋转/滤镜等HTML外层近似规则仍有效。内部SVG变换与外层CSS变换分开，后者没有因此获得完整支持。
- 单SVG输入与展开后各≤256KiB、≤500元素、深度≤32；整包SVG总规范化内容≤2MiB，SVG元素复杂度与场景节点合计≤5000。引用检查也计入复杂度，预算保守；超限SVG本地占位告警，整包累计超限则拒绝且保留旧成功包。这不是Figma实际创建节点数的精确上限。
- 主协议仍1.0.0，producer=m2.7，adapter=web-dom-2；VECTOR必须声明`inline-svg`。此前实际采集的旧包没有VECTOR，保持兼容；手工编写的旧VECTOR需声明能力并符合新受限校验，不能绕过新检查。

## 开发证据

`npm.cmd run check`：101项自动测试、桌面/插件两套类型与构建通过。`npm.cmd run smoke:svg`：51项真实Electron检查，包含14个原生矢量、13个源页/规范化SVG场景稳定内部区域对照、多选、矩形和保存重开。每例最少738个颜色通道，最大通道误差0/255（容差5）。排除文字与抗锯齿边缘，底层对照仍由Chromium绘制SVG，不是全图或真实Figma渲染证明。

本批证据：`evidence/2026-10-19/M2-svg/2026-10-19T10-19-48-035Z/`，含report、pixel-comparison、真实全页/独立/合并/矩形/保存重开JSON与源/场景PNG。人工样例`examples/svg-m2.7.example.json`不是网页证据。插件生产主逻辑另以模拟宿主检查矢量调用、缩放、透明度与不安全输入预检；没有本轮真实Figma操作。

开发回归：图片/渐变40项、文字28项、层叠34项、直连17项和全页29项通过；直连为真实UI/HTTP加模拟画布。首次受限环境HTTP测试EACCES，正常权限复测通过。SVG检查最初内容区尺寸断言错误后修正；扩展像素检查实际发现有/无viewBox两类SVG尺寸协商差异，修复后13例通过，失败目录保留。最终另覆盖只框选SVG视口外溢出路径的严格矩形，保留完整矢量并由外层裁切。

映射依据[Figma createNodeFromSvg](https://developers.figma.com/docs/plugins/api/figma/#createnodefromsvg)、[W3C SVG引用](https://www.w3.org/TR/SVG/linking.html)和[SVG外部资源限制](https://www.w3.org/TR/SVG/conform.html)。本批受限配置是本项目实现范围，不代表Figma或SVG规范只支持这些功能。
