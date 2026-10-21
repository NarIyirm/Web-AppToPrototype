export {};
import type {CapturePackage} from '../../../packages/contracts/src/index';
import type {CaptureResult,BoundaryPolicy,OutputMode,SelectionState,SelectionItem} from './capture-data';
import type {BridgeState,BridgeJob} from '../../../packages/contracts/src/bridge';
import {setupWorkflow,type WorkflowApi} from './workflow-ui';
import {fidelityCounts} from '../../../packages/contracts/src/quality';
import {drawScene} from './scene-preview';
interface AppApi extends WorkflowApi{
 editText(screenId:string,nodeId:string,text:string):Promise<CaptureResult>;
 mobilePair():Promise<{offers:{address:string;label?:string;qr:string}[];expiresAt:number}>;mobileStop():Promise<void>;mobileCopy(index:number):Promise<void>;mobileList():Promise<{id:string;bytes:number;at:number}[]>;mobileOpen(id:string):Promise<CaptureResult>;
 mobileDelete(id:string):Promise<void>;
 mobileStatus():Promise<{active:boolean;connected:boolean;deviceName?:string;expiresAt?:number}>;
 onCommand(callback:(command:'focus-address')=>void):()=>void;
 navigate(url:string):Promise<string>;demo():Promise<string>;select(enabled:boolean,mode?:string,policy?:BoundaryPolicy,multiple?:boolean):Promise<boolean>;
 selectionEdit(action:string,key?:string):Promise<void>;boundary(policy:BoundaryPolicy):Promise<void>;parent():Promise<unknown>;
 capture(kind?:string,outputMode?:OutputMode,prepare?:boolean,autoLayout?:boolean):Promise<CaptureResult>;captureSend(kind:string,outputMode?:OutputMode,prepare?:boolean,autoLayout?:boolean):Promise<CaptureResult&{job?:BridgeJob;sendError?:string}>;captureCancel():Promise<boolean>;
 renameScreen(id:string,name:string):Promise<CapturePackage>;exportCapture(name:string):Promise<{path:string;previewPath?:string;warning?:string}|null>;reopenCapture():Promise<CaptureResult|null>;
 bridgeStatus():Promise<BridgeState>;bridgePair():Promise<{code:string}>;bridgeCopy():Promise<void>;bridgeDisconnect():Promise<BridgeState>;bridgeSend(name:string):Promise<BridgeJob>;bridgeSaveReport():Promise<string|null>;
 snapshot():Promise<unknown>;exportExample():Promise<string|null>;info():Promise<{pluginManifest:string;runtime:string;url:string}>;
 onState(callback:(state:{url?:string;selecting?:boolean;loading?:boolean;error?:string;phase?:string;captureBusy?:boolean;captureProgress?:{phase:string;step:number;total:number}|null;selectionInvalidated?:boolean;selectionMode?:string;selectionNote?:string;selection?:unknown;selectionState?:SelectionState})=>void):()=>void;
}
const api=(window as unknown as {w2p:AppApi}).w2p;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string)=>$<HTMLButtonElement>(id),select=(id:string)=>$<HTMLSelectElement>(id);
api.onCommand(()=>{const address=$<HTMLInputElement>('url');address.focus();address.select();});
const status=(text:string,error=false)=>{$('status').textContent=text;$('status').dataset.error=String(error);$('status').title=text;};
let selecting=false,mode='element',busy=false,sending=false,polling=false;
let renamePending:Promise<void>=Promise.resolve();
let selection:SelectionState={items:[],excluded:[],multiple:false,mode:'element'},hasRectangle=false;
let capture:CaptureResult|undefined;
let convertedView=false;
const workspaces=['selection','mobile','result','project'] as const;
type Workspace=typeof workspaces[number];
let currentWorkspace:Workspace='selection';
let bridge:BridgeState={connected:false,paired:false,reason:'未连接',jobs:[]};
const scope=()=>select('send-kind').value;
const outputMode=()=>select('output-mode').value as OutputMode;
const boundary=()=>select('boundary').value as BoundaryPolicy;
const prepare=()=>$<HTMLInputElement>('full-prepare').checked;
const firstName=()=>capture?.data.screens[0].name??'';
async function run(action:()=>Promise<unknown>){try{await action();}catch(error){status(error instanceof Error?error.message:String(error),true);}}
function tab(name:Workspace){
 currentWorkspace=name;
 for(const key of workspaces){const active=key===name;$(`${key}-panel`).hidden=!active;$(`tab-${key}`).setAttribute('aria-selected',String(active));$(`tab-${key}`).tabIndex=active?0:-1;}
 for(const [key,id] of [['selection','web-actions'],['mobile','mobile-actions'],['result','result-actions'],['project','project-actions']])$(id).hidden=key!==name;
 document.querySelector('.panel-scroll')!.scrollTop=0;
 updateControls();
}
for(const name of workspaces){$(`tab-${name}`).onclick=()=>tab(name);$(`tab-${name}`).onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const index=workspaces.indexOf(name),next=event.key==='Home'?workspaces[0]:event.key==='End'?workspaces.at(-1)!:workspaces[(index+(event.key==='ArrowLeft'?-1:1)+workspaces.length)%workspaces.length];tab(next);$(`tab-${next}`).focus();}};}
function openDevice(kind:'figma'|'mobile',force?:boolean){const panel=$<HTMLDetailsElement>(kind==='figma'?'figma-connection':'mobile-connection');panel.open=force??!panel.open;
 if(panel.open){$<HTMLDetailsElement>(kind==='figma'?'mobile-connection':'figma-connection').open=false;document.querySelector('.panel-scroll')!.scrollTop=0;}
}
function openConnection(){openDevice('figma');}
$('connection-toggle').onclick=openConnection;
$<HTMLDetailsElement>('figma-connection').ontoggle=()=>{$('connection-toggle').setAttribute('aria-expanded',String($<HTMLDetailsElement>('figma-connection').open));};
$('mobile-connection-toggle').onclick=()=>openDevice('mobile');
$('mobile-connect-shortcut').onclick=()=>openDevice('mobile',true);
$<HTMLDetailsElement>('mobile-connection').ontoggle=()=>{$('mobile-connection-toggle').setAttribute('aria-expanded',String($<HTMLDetailsElement>('mobile-connection').open));};
$('plugin-path-copy').onclick=()=>void run(async()=>{const path=$('manifest').textContent;if(path){await navigator.clipboard.writeText(path);status('插件路径已复制，可在 Figma 中选择此 manifest 文件。');}});
$('help-toggle').onclick=()=>{$('guide').hidden=!$('guide').hidden;$('help-toggle').setAttribute('aria-expanded',String(!$('guide').hidden));if(!$('guide').hidden)$('guide').scrollIntoView({block:'nearest'});};
function updateControls(){
 const working=busy||sending;const active=bridge.jobs.some(job=>['queued','importing'].includes(job.status));
 const hasScope=scope()!=='selection'||hasRectangle||selection.items.length>0;
 const stale=scope()==='selection'&&selection.items.some(item=>item.stale);
 button('capture-page').disabled=working;button('text-save').disabled=working;
 button('capture').disabled=working||!hasScope||stale;
 button('capture-send').disabled=working||!hasScope||stale||!bridge.connected||active;
 button('capture-send').title=!bridge.connected?'请先通过右侧顶部“Figma”配对':!hasScope?'请先选择内容，或切换当前视口':active?'请等待上次导入完成':'';
 button('send-latest').disabled=working||!capture||!bridge.connected||active;
 button('save').disabled=working||!capture;
 button('project-add').disabled=working||!capture;
 button('mobile-open').disabled=working||!select('mobile-files').value;
 button('mobile-delete').disabled=working||!select('mobile-files').value;
 button('project-build').disabled=working||Number($('project-panel').dataset.stateCount??0)===0;
 button('pair').disabled=working;button('bridge-disconnect').disabled=!bridge.paired;
 button('bridge-report').disabled=!bridge.jobs.some(job=>job.status==='succeeded');
 for(const id of ['section','select','rectangle','browse','demo','reopen','parent','exclude','clear-selection','help-toggle'])button(id).disabled=working;
 button('parent').disabled=working||!selection.items.length||hasRectangle||scope()!=='selection';
 button('exclude').disabled=working||!selection.items.length||scope()!=='selection';
 button('clear-selection').disabled=working||(!selection.items.length&&!hasRectangle);
 for(const id of ['send-kind','boundary','output-mode','result-screen','reference-segment'])select(id).disabled=working;
 $<HTMLInputElement>('full-prepare').disabled=working;
 $<HTMLInputElement>('multiple').disabled=working||hasRectangle;
 $<HTMLInputElement>('url').disabled=working;$<HTMLInputElement>('capture-name').disabled=working;
 $('navigation').querySelector<HTMLButtonElement>('button')!.disabled=working;
 document.body.setAttribute('aria-busy',String(working));
 if(currentWorkspace==='selection')$('action-hint').textContent=stale?'选区已失效，请重新选择。':!hasScope?'先选择网页内容，或切换到当前视口。':'选择范围已就绪，可以预览或转换并发送。';
 if(currentWorkspace==='mobile')$('action-hint').textContent=select('mobile-files').value?'选择收到的素材，转换后再发送到 Figma。':'先在顶部连接手机，再从手机发送画面。';
 if(currentWorkspace==='result')$('action-hint').textContent=!capture?'还没有转换结果，请先采集网页或打开手机素材。':!bridge.connected?'结果已保留，连接顶部的 Figma 后即可发送。':'检查画面后发送，也可以加入原型项目。';
 if(currentWorkspace==='project')$('action-hint').textContent=Number($('project-panel').dataset.stateCount??0)?'设置状态和连线，生成项目后在转换结果中发送。':'先在转换结果中点击“加入原型项目”。';
 for(const action of document.querySelectorAll<HTMLButtonElement>('#selection-list button,#excluded-list button'))action.disabled=working;
 $('selection-controls').hidden=scope()!=='selection';$('viewport-help').hidden=scope()!=='viewport';$('full-options').hidden=scope()!=='full_page';
 $('output-options').hidden=scope()!=='selection'||selection.items.length<2;
 $('boundary-options').hidden=scope()!=='selection'||(!hasRectangle&&!(selecting&&mode==='rectangle'));
 $('capture-progress').hidden=!busy;button('capture-cancel').disabled=!busy;
 if(currentWorkspace==='selection')$('action-hint').textContent=stale?'有区块已失效，请移除或重新选择。':scope()==='full_page'?'全页按当前浏览器宽度生成，不使用区块排除。':scope()==='viewport'?'将采集当前可见网页，不使用区块列表。':hasRectangle?'将转换框选范围，检查边界策略后继续。':selection.items.length?`已选 ${selection.items.length} 个区块${selection.excluded.length?`，排除 ${selection.excluded.length} 项`:''}。${!bridge.connected?'可先预览，再连接 Figma。':'可预览或直接发送。'}`:'在网页选择内容，或切换到当前视口。';
 $('footer-selection').textContent=hasRectangle?'矩形已选择':`${selection.items.length} 个区块 · ${selection.excluded.length} 项排除`;
 for(const [id,value] of [['select','element'],['section','section'],['rectangle','rectangle'],['exclude','exclude']])$(id).setAttribute('aria-pressed',String(selecting&&mode===value));
 $('browse').setAttribute('aria-pressed',String(!selecting));
}
function renderList(id:string,items:SelectionItem[],excluded=false){
 const list=$(id);list.replaceChildren();
 for(const item of items){const row=document.createElement('li');row.className='selection-row';const icon=document.createElement('span');icon.className='row-icon';icon.textContent=excluded?'−':'▣';icon.setAttribute('aria-hidden','true');
 const main=document.createElement('div');main.className='item-main';const title=document.createElement('div');title.className='item-title';title.textContent=item.text||item.id||item.tag;title.title=title.textContent;
 const kind=({section:'区块',article:'文章区块',main:'主内容',div:'容器',p:'文本',button:'按钮',img:'图片',h1:'标题',h2:'标题',span:'文本'} as Record<string,string>)[item.tag]??'元素';
 const meta=document.createElement('div');meta.className='item-meta';meta.textContent=item.stale?'页面内容已变化，请重新选择':`${Math.round(item.rect.width)} × ${Math.round(item.rect.height)} · ${kind}`;
 main.append(title,meta);const action=document.createElement('button');action.textContent=excluded?'恢复':'移除';action.setAttribute('aria-label',`${excluded?'恢复':'移除'} ${title.textContent}`);action.disabled=busy;action.onclick=()=>void run(()=>api.selectionEdit(excluded?'restore':'remove',item.key));row.append(icon,main,action);list.append(row);}
}
function showSelection(value:SelectionState){selection=value;$<HTMLInputElement>('multiple').checked=value.multiple;renderList('selection-list',value.items);renderList('excluded-list',value.excluded,true);$('selection-empty').hidden=!!value.items.length||hasRectangle;$('excluded-section').hidden=!value.excluded.length;$('excluded-count').textContent=String(value.excluded.length);$('selection-count').textContent=String(value.items.length||(hasRectangle?1:0));
 $('selection-summary').textContent=hasRectangle?'矩形已选中。点“浏览网页”可退出选择。':value.items.length?'实线为选中内容，虚线为排除内容。排除不会移动网页布局。':'开启连续多选，可依次点选不同区块。';updateControls();
}
async function startTool(value:string){
 mode=value;hasRectangle=value==='rectangle'?false:hasRectangle;select('send-kind').value='selection';tab('selection');
 selecting=await api.select(true,value,boundary(),$<HTMLInputElement>('multiple').checked&&value!=='rectangle');
 if(value==='rectangle'){hasRectangle=false;selection={items:[],excluded:[],multiple:false,mode:value};showSelection(selection);}
 updateControls();status(value==='rectangle'?'拖出矩形选择范围，Esc 取消。':value==='exclude'?'点选已选区块内部的元素进行排除；Esc 返回浏览。':'在网页点选内容，Esc 返回浏览。');
}
for(const [id,value] of [['section','section'],['select','element'],['rectangle','rectangle'],['exclude','exclude']])$(id).onclick=()=>void run(()=>startTool(value));
$('browse').onclick=()=>void run(async()=>{await api.select(false);selecting=false;updateControls();status('可正常浏览网页，选区已保留。');});
$('multiple').onchange=()=>void run(async()=>{if($<HTMLInputElement>('multiple').checked)await startTool(mode==='element'?'element':'section');else{await api.selectionEdit('single');selecting=false;updateControls();}});
$('parent').onclick=()=>void run(()=>api.parent());
$('clear-selection').onclick=()=>void run(async()=>{await api.selectionEdit('clear');hasRectangle=false;showSelection({items:[],excluded:[],multiple:false,mode});status('已清空选区。');});
$('send-kind').onchange=()=>void run(async()=>{await api.select(false);selecting=false;updateControls();});
$('capture-cancel').onclick=()=>void run(async()=>{await api.captureCancel();status('正在取消，之前的转换结果保留。');});
$('boundary').onchange=()=>void run(()=>api.boundary(boundary()));
$('navigation').addEventListener('submit',event=>{event.preventDefault();void run(()=>api.navigate($<HTMLInputElement>('url').value));});
$('demo').onclick=()=>void run(()=>api.demo());
function renderReference(){
 if(!capture)return;const screenId=select('result-screen').value;const images=(capture.previews??(capture.preview?[capture.preview]:[])).filter(image=>image.metadata.screenId===screenId);
 const image=images[Number(select('reference-segment').value)||0];const img=$<HTMLImageElement>('source-preview');img.hidden=!image;$('preview-empty').hidden=!!image;
 if(image){img.src=image.dataUrl;const m=image.metadata;const full=capture.data.screens.find(screen=>screen.id===screenId)?.selection.mode==='full_page';$('preview-caption').textContent=full?`源参考 ${m.segmentIndex??1}/${m.segmentCount??1} · 页面 y=${Math.round(m.documentRect.y)}px · ${m.referenceMode==='sampled'?'部分/抽样位置':'分段位置'}。原网页固定层可能在参考图中重复，导出图层仅保留一次。${capture.previewNotice??''}`:`源截图 ${m.pixelWidth} × ${m.pixelHeight}px · ${m.partial?'仅覆盖当前可见部分':'可见范围已覆盖'}。原网页参考包含排除项；这些内容不会出现在转换图层中。${capture.previewNotice??''}`;}
 else{img.removeAttribute('src');$('preview-caption').textContent=capture.previewNotice??'此画面没有源截图；可编辑图层仍可导入。';}
 $('preview-heading').textContent=convertedView?'转换预览':'源画面参考';$('preview-type').textContent=convertedView?'图层示意':'转换前';img.hidden=convertedView||!image;$('preview-empty').hidden=convertedView||!!image;$('converted-preview').hidden=!convertedView;
 $('show-source').setAttribute('aria-pressed',String(!convertedView));$('show-converted').setAttribute('aria-pressed',String(convertedView));
 $('preview-full-label').hidden=!convertedView||!image?.metadata.partial;
 if(convertedView){const screen=capture.data.screens.find(s=>s.id===screenId)!;const m=image?.metadata,region=m&&!$<HTMLInputElement>('preview-full').checked?{x:m.documentRect.x-m.frameRect.x,y:m.documentRect.y-m.frameRect.y,width:m.documentRect.width,height:m.documentRect.height}:undefined;void drawScene($<HTMLCanvasElement>('converted-preview'),capture.data,screen,select('layer-list').value,region).catch(()=>status('转换预览无法显示，仍可保存或发送原始转换结果。',true));$('preview-caption').textContent='转换图层示意 · 字体和复杂效果以 Figma 实际导入为准。'+(image?.metadata.partial&&!$<HTMLInputElement>('preview-full').checked?'这里只展示当前源参考覆盖的部分。':'');}
}
$<HTMLInputElement>('preview-full').onchange=renderReference;
$('show-source').onclick=()=>{convertedView=false;renderReference();};
$('show-converted').onclick=()=>{convertedView=true;renderReference();};
function renderLayers(){
 if(!capture)return;const screen=capture.data.screens.find(s=>s.id===select('result-screen').value)??capture.data.screens[0],nodes=screen.nodes.filter(n=>n.id!==screen.rootNodeId),filter=select('layer-filter').value;
 $('layer-summary').textContent=`${nodes.filter(n=>n.type==='TEXT').length} 处可编辑文字 · ${nodes.filter(n=>n.type==='SHAPE'||n.type==='VECTOR').length} 个形状/矢量 · ${nodes.filter(n=>n.type==='IMAGE').length} 处保留图片 · ${nodes.filter(n=>n.fidelity==='missing').length} 处缺失。数量不代表面积覆盖率。`;
 const previous=select('layer-list').value,visible=nodes.filter(n=>filter==='all'||(filter==='missing'?n.fidelity==='missing':n.type===filter));
 select('layer-list').replaceChildren(new Option('选择图层定位…',''),...visible.slice(0,500).map(n=>new Option(`${({TEXT:'文字',SHAPE:'形状',IMAGE:'图片',VECTOR:'矢量',FRAME:'容器'})[n.type]} · ${n.name.slice(0,55)}`,n.id)));
 if(visible.some(n=>n.id===previous))select('layer-list').value=previous;
 const node=nodes.find(n=>n.id===select('layer-list').value);
 $('text-editor').hidden=!node?.text;if(node?.text)$<HTMLTextAreaElement>('node-text').value=node.text.characters;
 $('layer-detail').textContent=node?`${Math.round(node.rect.width)} × ${Math.round(node.rect.height)} · ${node.type==='IMAGE'?'保留像素，内部文字无法单独编辑':node.fidelity==='missing'?'内容缺失，需要检查来源':node.fidelity==='approximated'?'可编辑，排版或样式需校对':'可编辑图层'}`:visible.length>500?'先显示前 500 个图层，可按类型筛选。':'选择图层后，切到转换预览定位其范围。';
}
$('text-save').onclick=()=>void run(async()=>{const screenId=select('result-screen').value,nodeId=select('layer-list').value;if(!capture)return;showCapture(await api.editText(screenId,nodeId,$<HTMLTextAreaElement>('node-text').value));select('result-screen').value=screenId;renderResult();select('layer-list').value=nodeId;renderLayers();convertedView=true;renderReference();status('文字已更新到转换结果；源画面保留用于对照，加入项目后需重新生成原型。');});
$('layer-filter').onchange=()=>{renderLayers();renderReference();};
$('layer-list').onchange=()=>{renderLayers();convertedView=true;renderReference();};
function renderResult(){
 if(!capture)return;const data=capture.data;const screen=data.screens.find(screen=>screen.id===select('result-screen').value)??data.screens[0];
 const images=(capture.previews??(capture.preview?[capture.preview]:[])).filter(image=>image.metadata.screenId===screen.id);
 select('reference-segment').replaceChildren(...images.map((image,index)=>new Option(`第 ${image.metadata.segmentIndex??1} 段 · y=${Math.round(image.metadata.documentRect.y)}px`,String(index))));
 $('reference-segment').hidden=images.length<2;$('reference-label').hidden=images.length<2;
 $<HTMLInputElement>('capture-name').value=screen.name;
 const root=screen.nodes.find(node=>node.id===screen.rootNodeId)!;
 renderLayers();renderReference();const report=data.warnings.find(warning=>warning.code==='I_FULL_PAGE_CAPTURE');$('full-report').hidden=!report;$('full-report').textContent=report?.message??'';
 $('capture-output').textContent=JSON.stringify({packageId:data.packageId,inputKind:data.artifactKind,mode:screen.selection.mode,boundaryPolicy:screen.selection.boundaryPolicy,documentRect:screen.selection.originalRect,frame:root.rect,warnings:data.warnings,cachedAt:capture.path},null,2);
 $('warning-list').replaceChildren();const warnings=data.warnings.filter(w=>!w.screenId||w.screenId===screen.id),messages=[...new Set(warnings.map(w=>w.message))];for(const message of messages){const li=document.createElement('li');li.textContent=message;$('warning-list').append(li);}$('result-warnings').querySelector('summary')!.textContent=`转换提醒（${messages.length} 类）`;
 select('project-add-scope').disabled=data.screens.length<2;
}
function showCapture(value:CaptureResult){capture=value;$('result-empty').hidden=true;$('result-content').hidden=false;const nodes=value.data.screens.flatMap(screen=>screen.nodes);$('capture-summary').textContent=`${value.data.screens.length} 个画面 · ${nodes.length} 图层 · ${nodes.filter(n=>n.type==='TEXT').length} 文本 · ${value.data.assets.length} 图片 · ${value.data.warnings.length} 告警`;
 const q=fidelityCounts(value.data);$('fidelity-summary').textContent=`内容节点：原生 ${q.native} · 近似 ${q.approximated} · 栅格回退 ${q.rasterized} · 缺失 ${q.missing}。容器不计入。`;
 select('result-screen').replaceChildren(...value.data.screens.map(screen=>new Option(screen.name,screen.id)));renderResult();tab('result');updateControls();status('转换完成。可检查源参考、修改画面名称，再发送或保存。');
}
$('result-screen').onchange=renderResult;
$('reference-segment').onchange=renderReference;
function renameCurrent(){
 if(!capture)return renamePending;const id=select('result-screen').value,name=$<HTMLInputElement>('capture-name').value;
 if(capture.data.screens.find(screen=>screen.id===id)?.name===name)return renamePending;
 renamePending=renamePending.catch(()=>{}).then(async()=>{if(!capture)return;capture.data=await api.renameScreen(id,name);for(const option of select('result-screen').options)option.textContent=capture.data.screens.find(screen=>screen.id===option.value)!.name;renderResult();});return renamePending;
}
$('capture-name').onchange=()=>void run(renameCurrent);
$('capture-page').onclick=()=>void run(async()=>{select('send-kind').value='full_page';updateControls();status('正在转换整个页面，包括左右超出视口的已加载内容…');showCapture(await api.capture('full_page','separate',true,$<HTMLInputElement>('auto-layout').checked));});
$('capture').onclick=()=>void run(async()=>{status('正在转换选择的内容…');showCapture(await api.capture(scope(),outputMode(),prepare(),$<HTMLInputElement>('auto-layout').checked));});
$('viewport').onclick=()=>void run(async()=>{select('send-kind').value='viewport';showCapture(await api.capture('viewport'));});
$('save').onclick=()=>void run(async()=>{await renameCurrent();const result=await api.exportCapture(firstName());if(result)status(result.warning??`真实网页转换包已保存：${result.path}${result.previewPath?'（含源预览附件）':''}`);});
$('reopen').onclick=()=>void run(async()=>{const value=await api.reopenCapture();if(value)showCapture(value);});
let mobileOffers:{address:string;qr:string}[]=[];
let mobileExpires=0,mobileRefreshing=false,mobileConnected=false;
function mobileQr(){const index=select('mobile-address').selectedIndex,offer=mobileOffers[index];if(offer){$<HTMLImageElement>('mobile-qr').src=offer.qr;$('mobile-offer').hidden=false;}}
select('mobile-address').onchange=mobileQr;
$('mobile-pair').onclick=()=>void run(async()=>{button('mobile-pair').disabled=true;try{const offer=await api.mobilePair();mobileOffers=offer.offers;mobileExpires=offer.expiresAt;select('mobile-address').replaceChildren(...offer.offers.map(item=>{const option=document.createElement('option');option.textContent=item.label??item.address;return option;}));mobileQr();button('mobile-pair').textContent='重新生成配对码';$('mobile-note').textContent=`手机打开“发送到电脑”扫码，${new Date(offer.expiresAt).toLocaleTimeString()} 前有效。随后在这里允许连接。`;await mobileList();}finally{button('mobile-pair').disabled=false;}});
$('mobile-stop').onclick=()=>void run(async()=>{await api.mobileStop();mobileExpires=0;$('mobile-offer').hidden=true;$('mobile-note').textContent='手机接收已关闭，已接收素材继续保留。';await mobileList();});
$('mobile-copy').onclick=()=>void run(()=>api.mobileCopy(select('mobile-address').selectedIndex));
async function mobileList(){
 if(mobileRefreshing)return;mobileRefreshing=true;
 try{
  const previous=select('mobile-files').value,[list,connection]=await Promise.all([api.mobileList(),api.mobileStatus()]);
  select('mobile-files').replaceChildren(...list.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=`${new Date(item.at).toLocaleString()} · ${(item.bytes/1024/1024).toFixed(1)} MiB`;return option;}));
  if(list.some(item=>item.id===previous))select('mobile-files').value=previous;
  $('mobile-empty').hidden=list.length>0;$('mobile-inbox').hidden=list.length===0;
  $('mobile-count').textContent=String(list.length);$('mobile-count').hidden=!list.length;
  $('mobile-connection-summary').textContent=connection.connected?'已连接':connection.active?'接收中':'未开启';
  $('mobile-connection-toggle').title=connection.connected?`已连接 ${connection.deviceName??'手机'}`:'连接手机，接收画面素材';
  document.body.dataset.mobileConnected=String(connection.connected);button('mobile-stop').disabled=!connection.active;
  if(connection.connected&&!mobileConnected){$<HTMLDetailsElement>('mobile-connection').open=false;tab('mobile');}
  mobileConnected=connection.connected;updateControls();
 }finally{mobileRefreshing=false;}
}
$('tab-mobile').addEventListener('click',()=>void run(mobileList));
setInterval(()=>{if(document.hidden)return;void mobileList().catch(()=>{});if(mobileExpires&&Date.now()>mobileExpires){mobileExpires=0;$('mobile-offer').hidden=true;$('mobile-note').textContent='二维码已过期。已连接的手机可继续发送；新连接请重新生成配对码。';}},3000);
void mobileList().catch(()=>{});
$('mobile-refresh').onclick=()=>void run(mobileList);
$('mobile-delete').onclick=()=>void run(async()=>{const id=select('mobile-files').value;if(id){await api.mobileDelete(id);await mobileList();}});
$('mobile-open').onclick=()=>void run(async()=>{if(busy||sending)return;const id=select('mobile-files').value;if(!id)return;busy=true;updateControls();try{showCapture(await api.mobileOpen(id));status('手机素材转换完成，请与源画面校对后发送到 Figma。');}finally{busy=false;updateControls();}});
function showBridge(value:BridgeState){const previous=bridge.jobs.at(-1),wasConnected=bridge.connected;bridge=value;document.body.dataset.connected=String(value.connected);$('connection-label').textContent='Figma';$('connection-summary').textContent=value.connected?'已连接':value.paired?'已断连':'未连接';
 $('bridge-status').textContent=!value.paired&&!$('pair-panel').hidden?'配对码已生成，请粘贴到 Figma 插件。':value.reason;$('bridge-target').textContent=value.target?`${value.target.documentName} / ${value.target.pageName}`:'';
 if(value.connected&&!wasConnected)$<HTMLDetailsElement>('figma-connection').open=false;
 if(value.paired){$('pair-panel').hidden=true;$('pair-value').textContent='';}
 const last=value.jobs.at(-1),active=value.jobs.find(j=>j.status==='importing')??value.jobs.find(j=>j.status==='queued')??last,queued=value.jobs.filter(j=>j.status==='queued').length;if(active)$('bridge-job').textContent=`${active.message} · ${active.completed}/${active.total}${queued?` · ${queued}个等待`:''}`;if(last&&previous?.id===last.id&&previous.status!==last.status&&['succeeded','failed','cancelled','interrupted'].includes(last.status))status(last.message,last.status!=='succeeded');updateControls();
}
async function refreshBridge(){if(polling)return;polling=true;try{showBridge(await api.bridgeStatus());}catch{status('连接状态暂不可用，可继续预览和保存文件。',true);}finally{polling=false;}}
setInterval(()=>void refreshBridge(),1000);void refreshBridge();
$('pair').onclick=()=>void run(async()=>{const value=await api.bridgePair();$('pair-panel').hidden=false;$('pair-value').textContent=value.code;await refreshBridge();});
$('pair-copy').onclick=()=>void run(async()=>{await api.bridgeCopy();status('配对码已复制，请粘贴到 Figma 插件。');});
$('bridge-disconnect').onclick=()=>void run(async()=>{showBridge(await api.bridgeDisconnect());$('pair-panel').hidden=true;$('pair-value').textContent='';});
async function sendTask(action:()=>Promise<void>){if(sending)return;sending=true;updateControls();try{await run(action);}finally{sending=false;await refreshBridge();updateControls();}}
$('capture-send').onclick=()=>void sendTask(async()=>{const result=await api.captureSend(scope(),outputMode(),prepare(),$<HTMLInputElement>('auto-layout').checked);showCapture(result);if(result.sendError)status(`转换已保留，发送未完成：${result.sendError}`,true);else status('整批转换已发送，等待 Figma 导入结果。');});
$('send-latest').onclick=()=>void sendTask(async()=>{await renameCurrent();const job=await api.bridgeSend(firstName());$('bridge-job').textContent=job.message;status('已发送当前整批转换，未重新采集网页。');});
$('bridge-report').onclick=()=>void run(async()=>{const path=await api.bridgeSaveReport();if(path)status(`导入报告已保存：${path}`);});
$('snapshot').onclick=()=>void run(async()=>{$('output').textContent=JSON.stringify(await api.snapshot(),null,2);status('布局诊断已读取。');});
$('export').onclick=()=>void run(async()=>{const path=await api.exportExample();if(path)status(`人工样例已保存：${path}`);});
api.onState(state=>{
 if(state.url)$<HTMLInputElement>('url').value=state.url;
 if(state.selectionMode)mode=state.selectionMode;
 if(typeof state.selecting==='boolean')selecting=state.selecting;
 if(typeof state.captureBusy==='boolean')busy=state.captureBusy;
 if(state.phase)$('capture-phase').textContent=state.phase;
 if('captureProgress' in state){const meter=$<HTMLProgressElement>('capture-meter');if(state.captureProgress){meter.max=state.captureProgress.total;meter.value=state.captureProgress.step;}else meter.removeAttribute('value');}
 if(state.selectionInvalidated){hasRectangle=false;showSelection({items:[],excluded:[],multiple:false,mode:'element'});$('output').textContent='页面已跳转，原选区已失效。';}
 if('selection' in state){hasRectangle=!!(state.selection&&typeof state.selection==='object'&&'kind' in state.selection&&(state.selection as {kind:string}).kind==='rectangle');if(state.selection)$('output').textContent=JSON.stringify(state.selection,null,2);}
 if(state.selectionState)showSelection(state.selectionState);
 updateControls();
 if(state.error)status(state.error,true);else if(state.selectionNote)status(state.selectionNote);else if(state.phase)status(state.phase);else if(state.loading)status('正在打开网页…');else if(state.loading===false&&$('status').dataset.error!=='true')status('网页已就绪。选择内容，或直接转换当前视口。');
});
void run(async()=>{const info=await api.info();$('manifest').textContent=info.pluginManifest;$('runtime').textContent=info.runtime;if(!$<HTMLInputElement>('url').value)$<HTMLInputElement>('url').value=info.url;});
showSelection(selection);
setupWorkflow(api,showCapture,status,()=>tab('project'));
