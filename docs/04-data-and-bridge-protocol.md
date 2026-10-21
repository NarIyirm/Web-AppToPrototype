# 04 数据与本地通信协议

2026-10-20移动协议仅处于设计：现CapturePackage仍1.0.0且source.kind固定web。拟新增MobileCaptureBundle原始素材格式和支持native/screenshot来源的最终包版本（建议2.0，MOB-02评审冻结），桌面/插件双读旧包；详见[25 移动端计划](25-mobile-web-and-native-plan.md)。尚未改变类型/Schema/HTTP路径，不能将原生截图谎称web输入旧插件；现43821仅回环Figma桥接，手机LAN接收必须独立鉴权和服务。

版本：主协议1.0.0 / desktop-1.0（2026-10-20）｜当前新增auto-layout、真实ZIP、分块/租约及有界FIFO；真实Figma按批次由用户验收。

对应人工样例：[capture-package.v1.example.json](../examples/capture-package.v1.example.json)。样例是开发夹具，不是真实网页采集成功记录。

## 1. 设计原则

1. 捕获数据、传输任务和 Figma 输出是不同实体。
2. 协议不包含 DOM 实例、Electron 对象、Figma 节点对象或登录凭据。
3. 同一捕获可多次导入；一次导入有独立 importId。
4. 中间格式描述场景，不照抄 Figma 内部存储格式，也不把源节点 ID 直接写成 Figma ID。
5. 资源必须能固化到包里。网络 URL 仅作来源说明，不能成为成功导入的必要隐式依赖。
6. 节点、screen、资源和交互引用必须校验；语法正确的 JSON 不代表结构合法。

## 2. 实体与标识

| 实体 | 标识 | 生命周期 |
|---|---|---|
| 项目 | projectId | 一组相关捕获的本地工作空间 |
| 页面实例 | pageEpoch | 每次导航产生；限制 DOM 句柄使用范围 |
| 捕获 | captureId | 单个选区、某个时刻的不可变结果 |
| 逻辑屏幕 | screenId | 状态/独立导入 Frame；可同 URL 不同状态 |
| 数据包 | packageId + revision | 多屏幕、资源和交互的一个版本 |
| 尝试 | attemptId | 捕获或传输的一次尝试 |
| 导入 | importId | Figma 中一次受控写入 |
| 资源 | assetId | SHA-256 内容寻址 |
| 源元素 | sourceId | 捕获局部定位，不跨导航保证稳定 |
| 输出节点 | node.id | 包内 screen 内唯一；与 Figma ID 映射保存于报告 |

sourceId 与 node.id 可以一对多，例如文字按行拆分、背景图片分片。需要比较不同 revision 时不能只比较节点 ID，应使用来源、几何和内容指纹作为候选，人工确认后再处理更新。

## 3. 包文件结构

当前JSON继续自包含inlineBase64；ZIP是另一种传输封装，解包后恢复同一CapturePackage再执行完整预检。ZIP内部由capture.json和assets/sha256.png或.jpg组成，重复摘要可共用资源；capture.json通过受限path引用归档资源，不包含外链依赖。不使用早期manifest.json/package.json草案。

packages/contracts/src/archive.ts实现Store/Deflate；桌面zlib和插件UI DecompressionStream使用有界解码。校验中央/本地目录、路径、条目数/长度/重叠、CRC、展开预算和资源摘要/类型/尺寸，未知附件拒绝，不写任意路径。ZIP≤64MiB、展开≤64MiB、条目≤5001、capture JSON≤50MiB；原资源预算继续。拒绝ZIP64、加密、多卷、符号链接/目录穿越。源对照附件独立，不参与替代原生图层。

以下m2.1封装描述是兼容历史；当前桌面/插件均支持JSON与ZIP。


m2.1 实际封装仍为自包含 JSON。可选源预览使用同目录 `<主文件>.preview.png` 与 `<主文件>.preview.json`，不新增主协议字段，也不放进 assets。元信息关联 packageId/revision、screenId、frameRect、requestedRect、实际截图覆盖的 documentRect、partial、像素尺寸、时间与 SHA-256。重开时校验关联、摘要、头尺寸和解码；附件缺失或不匹配只移除预览，不影响场景导入。路径由用户选择的主文件名派生，不接受附件提供的任意文件路径。PNG 附件 ≤20 MiB、边长 ≤2048，说明 JSON ≤16 KiB。

## 4. 顶层字段

| 字段 | 类型 | 必需 | 约定 |
|---|---|---|---|
| schemaVersion | string | 是 | SemVer；本草案 1.0.0 |
| artifactKind | capture / example | 是 | example 仅在明确开发模式导入 |
| packageId / projectId | string | 是 | 不含凭据与个人信息 |
| revision | integer ≥1 | 是 | 修改包内容时递增 |
| createdAt | ISO 8601 string | 是 | 必须带时区 |
| producer | object | 是 | appVersion、converterVersion、adapterVersion |
| source | object | 是 | kind=web、url、title、pageEpoch、captureContext |
| screens | array | 是 | 至少一个，每个为独立画面 |
| assets | array | 是 | 可为空，不允许重复 assetId |
| interactions | array | 是 | 可为空，目标引用必须存在 |
| warnings | array | 是 | 可为空；失败和降级结构化保存 |

source.url 导出前默认移除 fragment 和 query；诊断时用户可选择保留必要参数。原始含令牌 URL 不进入日志、图层名和共享包。来源地址被删减不会影响资源导入。

captureContext 包含 viewport.width/height、devicePixelRatio、zoomFactor、scroll.x/y。长度均为 CSS px，DPR 和 zoomFactor 为正数。

## 5. Screen、选区和节点

### m2.4 可选视觉能力（旧包兼容）

主版本仍 `1.0.0`，producer.converterVersion=`m2.4`，adapterVersion=`web-dom-2`。有新字段时按需声明 requiredCapabilities，不对无新字段的纯色包强加新要求。更新后的桌面和插件继续接收此前包；旧插件不支持新字段/能力，会拒绝新包而不是默默改变外观。使用前重新运行已构建插件。

| 能力/字段 | 语义 |
|---|---|
| `image-placement` / IMAGE.imageSizing=`stretch` | rect 已是 CSS 图片在父裁切 Frame 内的显示矩形（可偏移/超出）；图像完整映射到此矩形，插件 IMAGE Paint CROP + identity imageTransform。父级 clipsContent/圆角保留裁切，无需协议再携带 DOM CSS。旧 IMAGE 缺省仍 FILL，保持旧包的居中铺满 |
| `linear-gradients` / style.fills[].kind=`linear_gradient` | angle 为 CSS 角度 `[0,360)`，0向上/90向右；stops 为2–32个按非降序排列的 `{position:[0,1],color:{r,g,b,a}}`。重复 position 合法，用于硬边；插件按物理宽高投影构造原生 GRADIENT_LINEAR transform |
| `solid` | 旧 `{kind:'solid',color}` 完全保留，和新渐变组成联合类型 |

imageSizing 只允许 IMAGE；新字段缺能力声明、无序色标、越界值、未知字段都在写画布前拒绝。图片定位使用普通父子 rect；资源摘要、尺寸、去重与预算不变。独立/合并输出重映射图片请求及告警 owner，再固化图片几何；导出包没有图片请求、网络凭据或页面对象。

本批背景使用底色 + 独立原生裁切 Frame/图片或渐变形状，放在文字之前。复杂组合 W_BACKGROUND_UNSUPPORTED / W_GRADIENT_UNSUPPORTED 包含 nodeId、details.property、fallback；图片布局表达式无法映射时 W_IMAGE_LAYOUT_UNSUPPORTED 留占位。资源失败沿用 E_ASSET_UNAVAILABLE。

示例：[visual-m2.4.example.json](../examples/visual-m2.4.example.json)（人工数据，非网页采集）；Schema/类型及兼容测试同步。用户步骤与范围见 [docs/14](14-visual-fidelity-acceptance.md)。Figma 填充 API 映射依据 [官方 Paint 文档](https://developers.figma.com/docs/plugins/api/Paint/)。

### m2.5 可选 styled-text（旧包兼容）

producer.converterVersion=`m2.5`，adapter仍`web-dom-2`，schemaVersion仍`1.0.0`。新增字段存在时，requiredCapabilities必须包含`styled-text`：

| 字段 | 语义与上限 |
|---|---|
| Font.fallbacks? | 按CSS顺序保存的后续字体族，最多8项，每项1–256字符。family仍是首选；泛用族在插件中映射到可用的常见字体 |
| Text.runs[].color? | 原生文字范围的sRGB RGBA，通道[0,1] |
| Text.runs[].letterSpacing? | 范围字距，CSS px，[-4096,4096] |
| Text.runs[].decoration? | none / underline / line-through，单一原生装饰 |

start/end继续采用UTF-16半开区间，非重叠、非倒序、不越界、不拆代理对；旧包只有start/end/font的runs保持兼容。新采集器按字素分段，大小写扩展后以输出文本重新计算run范围；同一视觉行安全合并后重定位到共同父Frame，保留其他容器图层及选择/裁切关系。

插件先加载所有实际字体、设置整节点fill，再应用setRangeFontName/FontSize/Fills/LetterSpacing/TextDecoration，避免最后设置整节点fill覆盖多色文字。字体选择按CSS列表→同族近似样式→确定的系统回退；E_FONT_MISSING.details记录requested、chosen、reason、glyphCoverage=unverified。字形覆盖不可从可用字体列表推定。

人工样例：[text-m2.5.example.json](../examples/text-m2.5.example.json)，用户范围：[docs/15](15-text-fidelity-acceptance.md)。依据[Figma TextNode](https://developers.figma.com/docs/plugins/api/TextNode/)及[字体加载说明](https://developers.figma.com/docs/plugins/working-with-text/)，旧插件应重开新构建才能导入新字段。桥接契约与预算不变。

### m2.6 层叠/裁切：仅归一化现有原生场景

converterVersion=m2.6，adapterVersion=web-dom-2，schemaVersion仍1.0.0，无新字段/requiredCapability。DOM层叠上下文、包含块、辅助背景/裁切标记只在采集归一化阶段使用，不导出CSS对象或DOM句柄。结果仍用既有FRAME/SHAPE/TEXT/IMAGE、parentId、rect、order、clipsContent、radii与opacity表达，旧包/导入器字段兼容；旧JSON不会重新计算视觉树。

输出数组为父级在先的绘制树，order重编号且同父层稳定。定位后代可离开普通非上下文祖先进入所属上下文；适用的祖先裁切复制为空原生Frame，坐标保持源绝对位置。背景和边框必要时独立为原生层，负层保持正确前后关系。新增辅助层计入原节点/时间预算。多选根合并仍保留每根局部树；跨根完整层叠需采集共同父级/全页。

示例：[layers-m2.6.example.json](../examples/layers-m2.6.example.json)（人工数据），范围与LYR验收见[docs/16](16-stacking-and-clipping-acceptance.md)。CSS阶段依据[W3C Appendix E](https://www.w3.org/TR/CSS2/zindex.html)，原生映射使用[Figma FrameNode](https://developers.figma.com/docs/plugins/api/FrameNode/)和既有children插入顺序，不增加远程处理或资源类型。

### m2.7 可选 inline-svg（受限静态矢量）

converterVersion=m2.7、adapter=web-dom-2，schemaVersion仍1.0.0。复用已有VECTOR/svg与clipsContent字段，含VECTOR时必须声明`inline-svg`，非VECTOR不得夹带svg。两端共用`packages/contracts/src/svg.ts`的受限XML解析/规范化，预检在创建任何Figma节点前执行；不依赖DOM或插件内不可用的TextEncoder。旧插件无法识别新能力时明确拒绝，需关闭重开新构建。

支持基础形状/路径/组、局部渐变与clipPath，use展开并重命名实例内部ID；拒绝未知元素/属性、DTD/实体声明、活动内容、外链与复杂效果，序列化只输出受控标签/属性。不自动请求SVG内部资源或将未知内容栅格化。单SVG≤256KiB/500元素/32层，规范化SVG总量≤2MiB，元素检查复杂度与场景节点合计≤5000，超限不静默截断。node.svg字符串Schema上限同步262144。

SVG作为node.svg自包含保存，assets仍只允许PNG/JPEG；没有新增SVG MIME资产或外部路径。网页快照生成的SVG已具有目标视口，图片需遵循自身viewBox/PAR；插件使用规范化SVG和必要的外层SVG坐标包装缩放内部路径，避免单独resize Frame遗漏内部几何。保留导入器返回的SVG根透明度并与场景透明度相乘，保持原生路径子层。

此前真实采集包没有输出VECTOR，兼容原有字段与能力；手工旧VECTOR需增加inline-svg并满足受限校验。人工样例：[svg-m2.7.example.json](../examples/svg-m2.7.example.json)，实际范围：[docs/17](17-svg-and-icons-acceptance.md)。依据[Figma SVG导入API](https://developers.figma.com/docs/plugins/api/figma/#createnodefromsvg)与[W3C SVG引用](https://www.w3.org/TR/SVG/linking.html)。桥接鉴权、任务和文件回退契约不变。

### m2.8 表单与生成内容：复用现有原生场景

converterVersion=m2.8、adapter=web-dom-2、schemaVersion1.0.0，无新字段/能力。控件当前显示文字是TEXT，外框/裁切/状态是FRAME/SHAPE，勾选与下拉标记复用VECTOR/inline-svg；按原规则自动声明styled-text等已有能力。没有输出HTMLInputElement、密码值、源站句柄或交互状态机。

绝对定位before/after以普通原生FRAME/TEXT及现有z顺序/坐标/圆角/透明度表达，sourceId增加伪元素后缀用于定位；仍不新增DOM或CSS对象。文字测量镜像、可见表单保留完整值行的裁切集合，以及按pageEpoch共享的采集脚本安装Promise都仅为运行时数据，不进包。旧JSON、资源预算、桥接鉴权/API和文件回退保持。

原生系统控件静态近似报告W_FORM_NATIVE_APPROXIMATED，复杂类型W_FORM_UNSUPPORTED，超出生成内容子集W_PSEUDO_UNSUPPORTED；均不能充作交互迁移成功。人工样例[forms-m2.8.example.json](../examples/forms-m2.8.example.json)，支持边界与FRM验收见[docs/18](18-forms-and-generated-content-acceptance.md)。

### 原有画面与选择契约（继续）

每个 screen 必须有 id、captureId、name、stateKey、selection、rootNodeId、nodes。stateKey 是自定义状态名，不是 URL 去重键。可选 sourceOverride 保存该状态自己的脱敏 URL、pageEpoch、captureContext 和 capturedAt；没有覆盖时继承顶层 source。跨路由、不同视口或滚动位置的真实捕获必须填写覆盖，不能错误共用顶层状态。

selection 字段：

| 字段 | 说明 |
|---|---|
| mode | viewport / full_page / element / rectangle |
| sourceNodeIds | 当前 screen 的源节点标识；视口可为空 |
| excludedSourceNodeIds | 排除项，可为空 |
| originalRect | 在源文档坐标中的 x/y/width/height |
| boundaryPolicy | strict / complete_elements |
| contentScope | visible / loaded_content |

多选通过多个 screen 表达；合并模式是一份共同选区 screen，并在 sourceNodeIds 保存多个根。浮层是否作为独立 screen 由用户确认。

m2.2 已采用以上结构，主包 1.0.0 不变。选择来源使用捕获上下文内稳定的 dom-* 标识，排除项保留标识但不生成对应绘制子树。独立画面有各自 captureId、selection 与 nodeMap 命名空间；合并时重映射内部节点/图片请求/告警引用以避免重复 n0 等 ID。当前同页同次捕获共享来源上下文；跨路由多状态尚未实现。

预览不属于主 JSON 或 assets：首画面保留 `<path>.preview.png/.json`，后续为 `<path>.<screenId>.preview.png/.json`，元信息核对对应 screenId、包版本、尺寸与摘要。CaptureResult 的 previews 返回可用附件，preview 保留首画面兼容字段；可有部分画面无图。主 JSON 仍足以供插件导入，整批作为一个桥接 job，不拆成多个并发任务。

m2.3 全页继续使用协议 1.0.0 的 full_page / loaded_content，无新节点类型。全页归一化到文档顶部，source.captureContext.scroll=(0,0)；原浏览位置由临时采集会话恢复，不作为快照位置写包。I_FULL_PAGE_CAPTURE 的 details 记录 prepared、partial、reason、steps、documentHeight、capturedHeight、settled、referenceCount/referenceMode；W_FULL_PAGE_PARTIAL 记录预算截断，I_FULL_PAGE_POSITION 说明固定/吸顶层静态近似。不能从“成功”推断无限加载已完整结束。

预览附件元信息新增可选 segmentIndex（从 1 开始）、segmentCount（1–12）、referenceMode（segments / sampled）。全页首段仍 `<path>.preview.*`，后续 `<path>.screen-1.segment-2.preview.*` 等；普通多画面旧命名兼容。每段独立校验包/画面/版本/坐标/摘要/尺寸，后续损坏段跳过并提示，其他有效段仍可查看；首段是段数索引，若它缺失或损坏，该画面源参考不加载，主包不受影响。生成位图总预算 32 MiB，重开另设约 48 MiB 编码预算，附件不参与主包导入。源 screenId 仅在匹配 `[A-Za-z0-9_-]{1,80}` 时用作后缀，否则以 `id-<SHA256 前32位>` 替代，附件不能通过 ID 逃逸到主文件目录之外。具体说明及用户步骤见 docs/13。

节点采用平铺数组，以 parentId 建树。每个 screen 恰好一个 parentId=null 的 FRAME 根，必须等于 rootNodeId；其他节点父级必须是同 screen FRAME，不能存在环，不能成为多个父级的子节点。order 决定同父层的绘制顺序，允许整数，冲突时按输入顺序稳定排序并告警。

| 节点字段 | 约定 |
|---|---|
| id、sourceId、name | id 必需；sourceId 可为热点/合成节点的自定义来源 |
| type | FRAME / TEXT / SHAPE / IMAGE / VECTOR |
| parentId | 根为 null；其他节点引用同 screen 父 FRAME |
| order | 同父绘制次序 |
| rect | x/y 相对父级，width/height 非负；根 x=y=0 且尺寸为正 |
| transform | 可选二维六元组；启用时不能再把轴对齐边界当作局部尺寸 |
| fidelity | native / approximated / rasterized / missing |
| style | 透明度、fills、border、radii、effects |
| clipsContent | FRAME 可选，默认 false |
| layout | FRAME 可选，mode=absolute 或 flex；不强迫开启 Auto Layout |
| text | TEXT 必需，其他类型不得包含 |
| assetId | IMAGE 必需，必须在 assets 中存在 |
| svg | VECTOR 必需，已清理的内联 SVG 字符串 |

style.fills 第一组支持 kind=solid，color={r,g,b,a}，各分量 0–1；渐变与图片填充在正式 Schema 中增加可辨别联合类型。border={width,color}，radii 顺序为左上、右上、右下、左下；effects 先支持外阴影 type=drop_shadow、x/y、blur、spread、color。禁止 NaN、Infinity、负宽高和超预算坐标。

text 包含 characters、font={family,style,weight,size}、lineHeight、letterSpacing、align、runs。font.weight 为源权重信息，Figma 的可用 style 由导入字体解析决定。runs 使用 JavaScript UTF-16 索引区间 [start,end)，不能切断代理对；不得越界或互相重叠。lineHeight 为 CSS px，align 为 left/center/right/justify；没有 runs 则使用整体样式。

layout.mode=absolute 时只使用节点几何；flex 时额外包含 direction、gap、padding、主/交叉轴对齐、子级尺寸策略。M2 前未实现的 flex 不得被 v1 导入器无提示误解释为 absolute。

## 6. 资源、交互、告警和报告

资源字段：assetId、sha256、mime、byteLength、width、height、path 或 inlineBase64。sha256 必须匹配解码后字节，mime 与解码类型必须一致；所有尺寸、大小受预算限制。来源 URL 可选且脱敏。样例未包含资源，因此不需外部文件即可解析。

交互字段：id、fromScreenId、triggerNodeId、trigger=click、action=navigate/open_overlay/close_overlay、可选 toScreenId、transition=instant。navigate/open_overlay 要求目标 screen 存在；close_overlay 不要求目标。v1 只支持明确声明的动作；未知动作直接报告不支持，不自动执行。

告警字段：code、severity=info/warning/error、message、可选 screenId/nodeId、details、fallback。details 仅存允许字段，不能包含认证值或完整输入事件。

导入报告必须有 reportKind=actual_import、importId、packageId、revision、startedAt、finishedAt、status、targetPageId、rootNodeIds、nodeMap、counts、warnings、errors、versions。nodeMap 条目包含 screenId、sceneNodeId、figmaNodeId；部分失败单独统计。最终状态是 succeeded / succeeded_with_warnings / failed / cancelled / interrupted。

报告只有实际 Figma 操作生成后才能称 actual_import；人工数据和模拟测试必须标记 synthetic，不能用于验收已导入能力。

## 7. 桥接分阶段策略

### 7.1 文件链路为强制能力

桌面导出 → 用户在插件 UI 选文件 → UI 校验/读取资源 → 插件主逻辑导入 → 可下载/复制导入报告。该链路不需要 REST API token，不需要 Figma OAuth。它仍然是在 Figma 编辑环境运行插件，不代表完全离线的 Figma 服务。

### 7.2 本地 HTTP 桥接：首版已实现，真实 Figma 最终验收待用户

仅监听 127.0.0.1，默认候选端口 43821，端口冲突可选择新端口并显示配对信息。manifest 的本地域名/端口和 devAllowedDomains、allowedDomains、reasoning 依当期官方规则声明。不能假设声明后一定能连通：Figma UI 的 CSP、Origin、本地网络限制和企业策略必须实测。

第一实现优先固定端口配文件回退；动态端口如果无法在 manifest 中精确兼容，就保留明确配置的端口，不通过允许全部网络域名来省略设计。

### 7.3 配对与权限

- 桌面显示一次性配对秘密，复制到插件；有效期 5 分钟，用后失效。
- POST /v1/pair 用秘密换取随机 256-bit session token；配对错误限速，令牌仅保存在本机会话，不写到包/日志/URL。
- 后续请求使用 Authorization: Bearer；session token 空闲 30 分钟过期，可主动断开。
- 校验 Host 和允许的请求来源；Figma UI 可能使用特殊 Origin，M0 记录真实行为。Origin/CORS 不代替鉴权。
- 除不含项目数据的 health 外，队列、资源、报告全部要认证；目标网页不能取得连接令牌。
- 不向源网页提供 bridge 地址、令牌或资源读写权限，不接受任意文件路径/任意 URL 下载。

## 8. HTTP 契约

### 8.1 已实现契约（protocol=1.0.0，2026-10-20更新）

以 `packages/contracts/src/bridge.ts`、`apps/desktop/src/bridge.ts` 为准。只有一个配对插件会话；有界FIFO最多5个queued/importing任务、合计正文100MiB，一个任务导入。包内继续inlineBase64，默认分块交付整包JSON字节；兼容旧claim直接返回data。主 Capture Package schemaVersion 仍为 1.0.0。

| 方法/路径 | 输入 | 输出 |
|---|---|---|
| GET /v1/health | 无 | 无项目数据的服务诊断；不证明已配对 |
| POST /v1/pair | `{code,target}` | `{sessionToken,target,protocol}` |
| POST /v1/heartbeat | `{target}` + Bearer | BridgeState；页面不匹配时 connected=false |
| POST /v1/jobs/claim | `{chunked:true}` + Bearer | `{delivery:null}` 或 `{delivery:{job,transfer}}`；省略chunked兼容返回job/data，重试沿用job/importId |
| POST /v1/jobs/chunk | `{jobId,importId,index}` + Bearer | `{index,base64,sha256}`；核对配对目标与有效租约 |
| POST /v1/jobs/progress | `{jobId,importId,completed,total}` + Bearer | `{accepted}`；completed 不倒退 |
| POST /v1/jobs/result | `{jobId,importId,report}` 或 `{jobId,importId,error}` + Bearer | `{accepted,replayed?}`；重复一致回执成功，冲突 409 |
| POST /v1/disconnect | `{}` + Bearer | `{ok:true}` |

target 为 `{bindingId,documentName,pageId,pageName}`。bindingId 由每次插件运行生成，避免多个文件都使用 `0:1` 之类 Page ID 而误匹配。bindingId+pageId 绑定接收实例，名称用于人读核对，不是可跨运行解析的 fileKey；不支持关闭插件自动唤醒。

BridgeJob 包含 id、importId、packageId、revision、packageSha256、target、status、createdAt/updatedAt、completed/total、message，以及可选leaseExpiresAt，可保存成功report。任务状态为 `queued → importing → succeeded`，异常为 `failed/cancelled/interrupted`。同配对目标的同 packageId/revision 返回已有任务；内容指纹不同拒绝。任务摘要保留20项、最近3份成功报告，UI展示最近10项，不能作为无限期全局去重。包正文仅留内存，重启不恢复待导入正文。

所有写请求为 application/json，控制/回执请求最大 2 MiB；claim 响应中的包服从既有 50 MiB 包预算。服务只监听 127.0.0.1，Host 必须为当前端口的 localhost/127.0.0.1。只允许无 Origin 或字符串 null；null 支持 opaque plugin UI，仍必须配对鉴权。OPTIONS 支持 JSON/Authorization 预检和请求时的 Private Network header；不接受普通网页任意 Origin。目标网页没有 preload/Node 或 bridge IPC。

配对码为 18 随机字节 base64url、一次有效、5 分钟过期；每分钟至多 5 次失败尝试。token 为 32 随机字节、空闲 30 分钟失效；两者只存在会话内存，不写包/日志/URL。生产固定 localhost:43821，端口冲突明确失败；测试使用 OS 分配端口并替换测试 UI 地址，不代表生产支持动态端口。

插件正常约每 1 秒心跳/领取，临时错误 3 秒重试，请求 10 秒超时；超过 8 秒无心跳则 queued→cancelled、importing→interrupted，禁止自动重新导入。旧 token 未过期且原绑定恢复时，可以补交原回执。桌面重启把活动任务记为 interrupted，重新配对；日志损坏保守停用直连，文件功能不受影响。

插件收到任务后锁定目标，创建隐藏暂存根并逐步导入；稳定 importId+owner/state 标记及最近 3 个 clientStorage 回执防止重复创建。回放回执必须核对实际根仍存在且 committed；残留/被删除结果不盲目重建。保存成功回执在同步提交图层之前，重放以实际根为准。网络丢失时只重发待确认回执，不领取新任务。手工文件导入仍创建新副本。切换页面时中止当前导入并清理本次根，普通页面切换不会把绑定改到另一页。

### 8.2 早期扩展草案（历史，不是当前HTTP路径）

大包/租约已按8.1和下方当前扩展实现；以下早期REST路径仅保留历史，不能当作当前接口调用。

| 方法/路径 | 输入 | 输出 | 幂等与限制 |
|---|---|---|---|
| GET /v1/health | 无 | 协议版本、服务可用状态 | 不暴露捕获列表 |
| POST /v1/pair | secret、clientVersion | sessionToken、expiresAt、protocolVersion | 一次性秘密，不可重放 |
| GET /v1/jobs | 已认证、cursor | 可领取任务摘要 | 无资源正文，短轮询 |
| POST /v1/jobs/{id}/claim | importId、pluginSessionId | lease、package 元信息 | 一个租约，其他消费者 409 |
| GET /v1/jobs/{id}/package | 租约 | 不可变 package.json | ETag/摘要校验 |
| GET /v1/assets/{assetId} | 租约与包授权 | 二进制资源 | 仅能访问被授权包内资源 |
| POST /v1/jobs/{id}/progress | importId、sequence、phase、counts | acceptedSequence | 旧序号不覆盖新进度 |
| POST /v1/jobs/{id}/result | importId、完整报告 | accepted | 同 importId 幂等；内容冲突 409 |
| POST /v1/jobs/{id}/cancel | importId | cancel_requested | 合作式取消，不伪报已回滚 |

扩展草案的建议配置：轮询 1 秒；无操作时退避至 5 秒；租约心跳 5 秒、失效 30 秒。取消指令可由进度响应返回。插件失联进入 interrupted，不能因租约过期就自动在 Figma 中创建第二份。首版实际超时与恢复规则见 8.1。

本地桥接采用至少一次传输，因此结果上传重试与“已创建图层”必须解耦：提交图层成功但报告上传失败时，插件保存回执并重发报告，不能重新执行导入。

## 9. 状态机

捕获：idle → selecting → preparing → extracting → resolving_assets → converting → ready；处理中可进入 failed/cancelled，失败重试用新 attemptId。

完整目标的传输：queued → claimed → transferring → importing → succeeded/succeeded_with_warnings；异常为 failed/cancelled/interrupted。取消请求先是 cancel_requested，清理完成后才是 cancelled。首版将 claimed/transferring 合入 importing，成功任务统一 succeeded，告警保留在 report；没有独立 cancel_requested HTTP 接口，实际状态见 8.1。

导入：preflight → staging → creating_nodes → linking → validating → committed；失败进入 cleaning_up → failed。插件突然关闭可保留 interrupted 标记；下次启动列出其拥有的临时根，用户可清理或重新导入。v1 恢复以删除本次残留后重建为主，不承诺逐节点断点续跑。

## 10. 错误码与处理

| 错误码 | 含义 | 默认处理 |
|---|---|---|
| E_TARGET_CHANGED | 导航/页面实例变化 | 重新选择 |
| E_SELECTION_STALE | 目标节点失效 | 保留选择意图，要求重新选中 |
| E_CAPTURE_TIMEOUT | 稳定等待或提取超时 | 显示阶段，可按当前状态重试 |
| E_LIMIT_EXCEEDED | 节点、大小、高度预算超限 | 缩小范围/分包，不静默截断 |
| E_PACKAGE_INVALID | 引用、结构、资源摘要不合法 | 写入前终止 |
| E_VERSION_UNSUPPORTED | 协议不兼容 | 升级对应端或使用匹配版本 |
| E_FONT_MISSING | 字体不可用 | 使用已确认替代并报告 |
| E_ASSET_UNAVAILABLE | 资源无法固化 | 局部截图或 missing |
| E_BRIDGE_UNREACHABLE | 本地连接不可达 | 文件导入 |
| E_PAIRING_EXPIRED | 配对或令牌过期 | 重新配对，不删除捕获 |
| E_TARGET_NOT_EDITABLE | 目标文件不可写 | 更换可编辑文件 |
| E_IMPORT_INTERRUPTED | 插件关闭或执行中断 | 检测残留后重试 |
| E_LINK_TARGET_MISSING | 原型源/目标缺失 | 跳过该连线并报告 |

## 11. 版本与校验

主版本不兼容直接拒绝；较新次版本只有在 requiredCapabilities 全部受支持、未知字段不影响含义时才允许。正式 Schema 将 requiredCapabilities 纳入顶层，M0 先固定 1.0.0，避免实现期间形成多个未记录变体。

完整目标的校验分四层：JSON/ZIP 语法、字段与类型、引用与树结构、执行预算及资源字节。两端均验证；来自本地的数据也不直接信任。当前 inline JSON 已实现摘要/长度/MIME/头尺寸/PNG CRC，以及宿主图片解码尺寸核对；资源和执行预算见 resources.ts、docs/09。运行器拒绝 path/ZIP，不能把 Schema 中的路径字段当作已支持文件加载。自动测试通过不代表所有 Figma 异常/取消/Undo 已验收，手工结果由用户提供。

### m2.9 外阴影：复用已有drop_shadow列表

converterVersion=m2.9，adapter web-dom-2、schemaVersion1.0.0不变，无新字段/能力。已有style.effects最多16项drop_shadow，按CSS前到后保留x/y/blur/spread/color。新采集把背景绘制为原生SHAPE，其effects对应Figma Rectangle的DROP_SHADOW；不在父Frame上对整个子树附加阴影，父级opacity仍只合成一次。插件显式设置showShadowBehindNode=false，沿用旧默认；旧JSON不自动迁移绘制树。

阴影外延仅用于运行时pruneScene，未写入Schema，也不改变边界或内容clip。W_SHADOW_APPROXIMATED表示原生参数已保留、边缘需比较；W_SHADOW_UNSUPPORTED表示部分或全部阴影省略，原生其余外观保留。人工[shadows-m2.9.example.json](../examples/shadows-m2.9.example.json)及[docs/19](19-shadows-acceptance.md)给出范围；内阴影未扩展进协议，文件/桥接API与已有预算不变。

## desktop-1.0当前扩展

- transfer为{byteLength,sha256,chunkSize:262144,chunks}，每块base64与SHA-256，插件校验块序号、长度、逐块及整包摘要，再parseCapturePackage。传输期间每3块心跳，90秒总限；不把未校验正文提交插件主逻辑。
- claim写入30秒leaseExpiresAt，同一目标heartbeat续租；8秒心跳不确定中断规则继续，不能等到租约过期后自动重复建图层。claim/终态需原子任务日志写入成功；终态回执落盘失败重试先重新持久化再确认。日志读取≤32MiB，损坏保留/停用直连，文件链路可用。
- 可选能力auto-layout：FRAME.layout.mode=horizontal/vertical时必需gap与padding[top,right,bottom,left]且声明能力；absolute仍兼容。插件创建子层后设置原生layoutMode、固定宽高/轴、间隔和内边距，恢复源父尺寸；复杂场景绝对布局。
- 项目草稿独立格式w2p-project-1，包含id/name/revision/data/previews，不作为CapturePackage给插件。新增状态重新映射screen/state/node/交互引用，保留sourceOverride描述原URL/上下文/时间；删除状态清理连线，单个触发节点只允许一个click动作。预览上限64MiB，项目128MiB。
- ImportReport可选fidelity为native/approximated/rasterized/missing内容节点计数；普通FRAME容器不进分母，但missing边界占位计入missing。统计不是像素相似度或真实字体/图层编辑证明。
