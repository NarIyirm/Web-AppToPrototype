# 19 m2.9 常见外阴影第一批

日期：2026-10-20（Australia/Sydney）。M2-06d development_complete / verification_pending。用户授权继续下一步，实施常见外阴影子集；m2.5–m2.8仍待用户反馈，不把继续当成验收通过。m2.4及此前已确认，无需重复。最终Figma验证由用户执行。

## 启动与新入口

1. 在项目目录执行 `npm.cmd start`，载入m2.9。
2. 原长页页尾进入“外阴影视觉基准”，或在应用中打开[本地阴影页](http://127.0.0.1:43821/fixture-shadows)。原工作台、长页及全部既有入口保留。
3. 沿用原插件manifest与ID；关闭重开插件载入新构建，桌面重启后重新配对。仍可保存自包含JSON后导入，没有新协议字段或能力要求。
4. 先按Section或整个页面转换，用应用源参考及网页白板比较；源参考截图不是Figma导入后的渲染。阴影样例不需要滚动加载准备。

## 支持范围与原生图层

- 读取计算后的完整box-shadow列表，最多16层，保留CSS从前到后的顺序、颜色/透明度、x/y偏移、blur和正负spread。每个长度绝对值上限10000px；表达式无法可靠读取或超限时明确告警，不悄悄只取第一层。
- 第一批要求单个矩形盒、不透明纯色底、border-box背景裁切、统一像素圆角且不超过短边一半。普通块、按钮和可靠绝对定位before/after均可复用；既有图片/渐变内容保留，生成框的原生渐变和底色一同移动，避免底色遮住渐变。
- 结果包含“外阴影与底色 / 原生绘制层”SHAPE，Figma中是普通Rectangle及原生DROP_SHADOW效果。它承载背景/圆角与阴影，父Frame保留整组透明度和内容。这样外溢子元素不会参与同一阴影，正负扩散也无需开启父级裁切。
- 自身overflow仍只裁切内容，祖先有效overflow会裁切阴影；上下文背景仍在负层子元素之下。仅阴影进入矩形/视口范围时也保留原盒和必要祖先，由原生Frame最终裁切。
- 不扩大选中元素或Section的边界来包含外阴影；要保留元素边界外的全部阴影，请选外围Section、视口或整个页面。严格矩形仍严格裁切。
- 参数保留不代表不同引擎边缘完全一致。支持项仍有W_SHADOW_APPROXIMATED，blur/spread及圆角边缘需在真实Figma比较。

## 尚未覆盖

内阴影、透明/半透明背景盒、百分比/椭圆/非统一圆角、分片行内盒、表格与复杂变换/滤镜/混合/蒙版等不在本批保证范围，W_SHADOW_UNSUPPORTED说明省略阴影，保留其余原生内容。内外混合列表会保留可支持的外阴影，明确告警省略内阴影。自行裁切的伪元素框本批也不附加外阴影，避免子阴影被错误裁掉。

文字阴影沿用W_TEXT_LAYOUT_UNSUPPORTED，filter:drop-shadow及SVG滤镜沿用其既有限制；没有实现内阴影、模糊滤镜或栅格化回退。透明控件的系统主题仍按docs/18静态近似。旧JSON可继续导入，但要获得新的多层阴影绘制树，需要重新采集；不会自动改写旧包。

## 本批验收

| 编号 | 样例/操作 | 期望 | 用户结果 |
|---|---|---|---|
| SHD01 | basic-shadow / multi-shadow / negative-shadow / border-shadow | 多层前后顺序、偏移/模糊/正负扩散和圆角参数齐全；边框独立 | 待用户验收 |
| SHD02 | 在Figma编辑原生阴影形状与Effects | 可单独改背景、圆角、阴影颜色/偏移/模糊/扩散，文字和子层仍可编辑 | 待用户验收 |
| SHD03 | child-shadow / own-clip-shadow | 绿色子内容不参与蓝盒阴影；自身overflow只裁内容，外阴影仍可见 | 待用户验收 |
| SHD04 | ancestor-shadow / alpha-shadow / context-shadow；单独选中border-shadow | 有效祖先裁切、整组透明度、背景/负层顺序；非上下文选区边框位于阴影背景上方 | 待用户验收 |
| SHD05 | pseudo-shadow / gradient-shadow | 绝对定位生成框的阴影与渐变保留，未增加位图 | 待用户验收 |
| SHD06 | outside-shadow、严格矩形；transparent-shadow / mixed-shadow / ellipse-shadow / text-shadow | 仅阴影进入范围仍保留；未支持内容明确告警，不虚构完整还原 | 待用户验收 |
| SHD07 | shadow-values与shadow-composition独立/合并、保存重开 | 两种输出及离开源页后的JSON导入保留参数/层级 | 待用户验收 |

请反馈SHD编号、样例ID、源JSON、Figma截图或导入报告，便于定位。无需重复已接受批次的验收；没有将开发结果填成用户通过。

## 已完成的开发检查

`npm.cmd run check`：117项自动测试、桌面/插件两套类型与构建通过。共享效果Schema/主协议1.0.0未改，人工[shadows-m2.9.example.json](../examples/shadows-m2.9.example.json)明确是example而非网页采集。

`npm.cmd run smoke:shadows`：34项真实Electron检查通过，覆盖多层/参数、分离子内容、裁切/透明度/负层、生成框及渐变、仅阴影进入范围、边界告警、源DOM/滚动保持、保存重开、独立/合并和严格矩形。

最终证据：[report.json](../evidence/2026-10-20/M2-shadows/2026-10-19T15-11-15-324Z/report.json)、[源页截图](../evidence/2026-10-20/M2-shadows/2026-10-19T15-11-15-324Z/shadows-page.png)、[像素记录](../evidence/2026-10-20/M2-shadows/2026-10-19T15-11-15-324Z/pixel-comparison.json)，真实全页/独立/合并/矩形/保存重开包在同目录。目录名用本地日期，运行时间戳用UTC，因此日期可相差一天。

10个零模糊硬边白板比较的是源Chromium截图和独立Canvas原生几何绘制器的稳定内部颜色，最大通道差0/255；不包含模糊边缘、字体、全图差分或真实Figma。插件生产代码另用模拟宿主验证多个DROP_SHADOW参数/顺序、Rectangle与showShadowBehindNode=false；模拟宿主不是Figma实际渲染。

本批开发回归表单36项、层叠34项、图片渐变40项、全页29项及直连17项通过；直连画布为模拟宿主。未重跑文字、SVG和公网独立脚本，其最近结果仍为m2.8历史。本轮没有真实Figma操作，亦未实现多状态原型交互、Android或安装包。

依据：[W3C box-shadow定义](https://www.w3.org/TR/css-backgrounds-3/#box-shadow)和[Figma Effect API](https://developers.figma.com/docs/plugins/api/Effect/)。CSS阴影按盒轮廓绘制；Figma spread对Frame存在条件限制，因此本批使用独立Rectangle承载效果，保留原内容裁切关系。两者模糊/扩散边缘的最终一致性仍待用户验证。

