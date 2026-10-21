import type {ProjectDocument} from './project';
import type {CaptureResult} from './capture-data';
import {absoluteRects,drawScene} from './scene-preview';
import {setupPrototypePlayer} from './prototype-player';
import type {Rect} from '../../../packages/contracts/src/index';
export interface WorkflowApi{
 projectRead():Promise<ProjectDocument&{storageError?:string}>;projectAdd(ids?:string[]):Promise<ProjectDocument>;projectEdit(action:string,value:Record<string,unknown>):Promise<ProjectDocument>;projectBuild():Promise<CaptureResult>;projectReset():Promise<ProjectDocument|null>;projectFile(mode:string):Promise<unknown>;
 historyList():Promise<Array<{id:string;name:string;at:number;screens:number}>>;historyOpen(id:string):Promise<CaptureResult>;viewportSize(size:{width:number;height:number}|null):Promise<unknown>;clearSession():Promise<boolean>;
}
export function setupWorkflow(api:WorkflowApi,show:(capture:CaptureResult)=>void,status:(s:string,error?:boolean)=>void,openProject:()=>void=()=>{}){
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,sel=(id:string)=>$<HTMLSelectElement>(id),input=(id:string)=>$<HTMLInputElement>(id);
 let project:ProjectDocument,pending:Rect|undefined,down:{x:number;y:number}|undefined,working=false,drawRevision=0;
 let canvasView:Rect={x:0,y:0,width:1,height:1},baseCanvas:HTMLCanvasElement|undefined;
 const stopPlayer=setupPrototypePlayer(()=>project?.data??null);
 const screen=()=>project?.data?.screens.find(s=>s.id===sel('project-state').value);
 async function run(work:()=>Promise<void>){if(working)return;working=true;$('project-panel').setAttribute('aria-busy','true');try{await work();}catch(e){status(String(e),true);}finally{working=false;$('project-panel').removeAttribute('aria-busy');}}
 const edit=async(action:string,value:Record<string,unknown>)=>{project=await api.projectEdit(action,{screenId:sel('project-state').value,...value});render();};
 function render(){
   stopPlayer();
   const old=sel('project-state').value,screens=project.data?.screens??[];
   const list=$('project-state-list');list.replaceChildren();for(const [index,s] of screens.entries()){const button=document.createElement('button');button.className='state-card';button.dataset.stateId=s.id;button.setAttribute('aria-pressed',String(s.id===old));const preview=project.previews.find(v=>v.metadata.screenId===s.id);if(preview){const img=document.createElement('img');img.src=preview.dataUrl;img.alt='';img.loading='lazy';button.append(img);}const text=document.createElement('span');text.textContent=`${index+1}. ${s.name}`;button.append(text);button.onclick=()=>{sel('project-state').value=s.id;renderState();};list.append(button);}
   $<HTMLButtonElement>('prototype-play').disabled=!screens.length;
   $('project-panel').dataset.stateCount=String(screens.length);
   $('project-description').textContent=`${screens.length}/20 个状态 · ${project.data?.interactions.length??0} 条连线 · 自动保存`;
   input('project-title').value=project.name;sel('project-state').replaceChildren(...screens.map(s=>new Option(s.name,s.id)));if(screens.some(s=>s.id===old))sel('project-state').value=old;
   sel('link-target').replaceChildren(...screens.map(s=>new Option(s.name,s.id)));
   for(const id of ['project-build','project-delete','project-rename','project-up','project-down','link-save'])$<HTMLButtonElement>(id).disabled=!screens.length;
   const links=$('project-links');links.replaceChildren();for(const link of project.data?.interactions??[]){const row=document.createElement('li');row.className='selection-row';const text=document.createElement('span');text.className='item-main';const s=screens.find(s=>s.id===link.fromScreenId),node=s?.nodes.find(n=>n.id===link.triggerNodeId);text.textContent=`${s?.name} · ${node?.name} → ${link.action==='close_overlay'?'关闭弹窗':screens.find(s=>s.id===link.toScreenId)?.name} (${({navigate:'跳转',open_overlay:'打开弹窗',close_overlay:'关闭弹窗'})[link.action]})`;const remove=document.createElement('button');const locate=document.createElement('button');locate.textContent='定位';locate.onclick=()=>{sel('project-state').value=link.fromScreenId;renderState();sel('project-node').value=link.triggerNodeId;sel('trigger-mode').value='element';triggerMode();paintSelection();};remove.textContent='删除连线';remove.onclick=()=>void run(()=>edit('remove-link',{id:link.id}));row.append(text,locate,remove);links.append(row);}renderState();
 }
 function selectedView(){const s=screen();if(!s)return undefined;const previews=project.previews.filter(v=>v.metadata.screenId===s.id);return previews[Number(sel('project-reference').value)];}
 function renderState(){pending=undefined;down=undefined;const s=screen();input('state-name').value=s?.name??'';
   sel('project-node').replaceChildren(new Option('点选画面或选择元素…',''),...(s?.nodes??[]).filter(n=>n.id!==s?.rootNodeId).map(n=>new Option(n.name.slice(0,55)+' · '+n.type,n.id)));
   const previews=project.previews.filter(v=>v.metadata.screenId===s?.id);sel('project-reference').replaceChildren(new Option('转换画面','converted'),...previews.map((v,i)=>new Option(`源参考 ${i+1}${v.metadata.partial?'（部分）':''}`,String(i))));
   const index=project.data?.screens.findIndex(item=>item.id===s?.id)??0,target=project.data?.screens[index+1]??project.data?.screens.find(item=>item.id!==s?.id);
   if(target)sel('link-target').value=target.id;
   for(const card of document.querySelectorAll<HTMLElement>('.state-card'))card.setAttribute('aria-pressed',String(card.dataset.stateId===s?.id));
   $('trigger-summary').textContent='点选元素，或切换热点后拖出范围。';triggerMode();void draw();
 }
 function resizeCanvas(){const canvas=$<HTMLCanvasElement>('project-preview');canvas.style.width=(input('project-preview-zoom').checked?280:Math.min(280,420*canvas.width/canvas.height))+'px';canvas.style.maxHeight='none';}
 function paintSelection(){const canvas=$<HTMLCanvasElement>('project-preview'),c=canvas.getContext('2d')!,s=screen();if(!s||!baseCanvas)return;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(baseCanvas,0,0);
   const rects=absoluteRects(s),sx=canvas.width/canvasView.width,sy=canvas.height/canvasView.height;
   const outline=(r:Rect,color:string)=>{c.strokeStyle=color;c.lineWidth=2;c.strokeRect((r.x-canvasView.x)*sx,(r.y-canvasView.y)*sy,r.width*sx,r.height*sy);};
   for(const link of project.data?.interactions.filter(i=>i.fromScreenId===s.id)??[]){const r=rects.get(link.triggerNodeId);if(r)outline(r,'#568baf');}
   const n=s.nodes.find(n=>n.id===sel('project-node').value);if(n){outline(rects.get(n.id)!,'#a3275f');$('trigger-summary').textContent=`已选：${n.name} · ${Math.round(n.rect.width)} × ${Math.round(n.rect.height)}`;}
   if(pending){outline(pending,'#a3275f');$('trigger-summary').textContent=`热点：${Math.round(pending.width)} × ${Math.round(pending.height)}`;}
 }
 async function draw(){const revision=++drawRevision,canvas=$<HTMLCanvasElement>('project-preview'),s=screen();baseCanvas=undefined;canvas.hidden=!s;if(!s)return;const v=selectedView();
   $('project-preview-note').textContent=v?'源画面对照，蓝框为已有连线，莓红框为当前选择。':'转换图层示意，蓝框为已有连线；字体与效果以 Figma 为准。';
   const temp=document.createElement('canvas');let nextView:Rect;
   if(v){const image=new Image();image.src=v.dataUrl;try{await image.decode();temp.width=image.width;temp.height=image.height;temp.getContext('2d')!.drawImage(image,0,0);}catch{if(revision===drawRevision)$('project-preview-note').textContent='参考图不可读取，请切换转换画面。';return;}
     const m=v.metadata;nextView={x:m.documentRect.x-m.frameRect.x,y:m.documentRect.y-m.frameRect.y,width:m.documentRect.width,height:m.documentRect.height};
   }else{await drawScene(temp,project.data!,s);nextView={...s.nodes.find(n=>n.id===s.rootNodeId)!.rect};}
   if(revision!==drawRevision)return;canvasView=nextView;baseCanvas=temp;canvas.width=temp.width;canvas.height=temp.height;resizeCanvas();paintSelection();
 }
 function point(event:PointerEvent){const c=$<HTMLCanvasElement>('project-preview'),b=c.getBoundingClientRect();if(!screen()||!baseCanvas)return;return{x:(event.clientX-b.x)/b.width*canvasView.width+canvasView.x,y:(event.clientY-b.y)/b.height*canvasView.height+canvasView.y};}
 function hotspot(event:PointerEvent){const end=point(event),s=screen();if(!down||!end||!s)return;const root=s.nodes.find(n=>n.id===s.rootNodeId)!.rect;const x=Math.max(0,Math.min(root.width,Math.min(down.x,end.x))),y=Math.max(0,Math.min(root.height,Math.min(down.y,end.y)));pending={x,y,width:Math.max(0,Math.min(root.width-x,Math.abs(end.x-down.x))),height:Math.max(0,Math.min(root.height-y,Math.abs(end.y-down.y)))};for(const key of ['x','y','width','height'] as const)input('hotspot-'+key).value=pending[key].toFixed(1);paintSelection();}
 $('project-preview').onpointerdown=event=>{event.preventDefault();down=point(event);(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);};
 $('project-preview').onpointermove=event=>{if(down&&sel('trigger-mode').value==='hotspot')hotspot(event);};
 $('project-preview').onpointerup=event=>{const end=point(event),s=screen();if(!down||!end||!s)return;if(sel('trigger-mode').value==='hotspot'){hotspot(event);status('热点已选，设置点击动作后保存。');}else{const rects=absoluteRects(s);const hit=[...s.nodes].reverse().find(n=>{const r=rects.get(n.id)!;return n.id!==s.rootNodeId&&end.x>=r.x&&end.x<=r.x+r.width&&end.y>=r.y&&end.y<=r.y+r.height;});if(hit){sel('project-node').value=hit.id;paintSelection();}}down=undefined;};
 $('project-preview').onpointercancel=()=>{down=undefined;};
 function triggerMode(){$('hotspot-fields').hidden=sel('trigger-mode').value!=='hotspot';$('project-node').hidden=sel('trigger-mode').value==='hotspot';sel('link-target').disabled=sel('link-action').value==='close_overlay';}
 $('trigger-mode').onchange=()=>{pending=undefined;triggerMode();paintSelection();};
 $('project-node').onchange=()=>{pending=undefined;paintSelection();};
 $('project-reference').onchange=()=>void draw();input('project-preview-zoom').onchange=resizeCanvas;
 for(const key of ['x','y','width','height'])input('hotspot-'+key).oninput=()=>{pending=Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(input('hotspot-'+k).value)])) as unknown as Rect;paintSelection();};
 $('link-action').onchange=triggerMode;$('project-state').onchange=renderState;
 $('project-title-save').onclick=()=>void run(()=>edit('name',{name:input('project-title').value}));
 $('project-add').onclick=()=>void run(async()=>{const ids=sel('project-add-scope').value==='all'?undefined:[sel('result-screen').value];project=await api.projectAdd(ids);render();sel('project-state').selectedIndex=sel('project-state').options.length-1;renderState();openProject();status('画面已加入项目。选择点击区域、设置动作，然后保存连线。');});
 for(const [id,action] of [['project-rename','rename'],['project-delete','delete'],['project-up','move'],['project-down','move']])$(id).onclick=()=>void run(()=>edit(action,{name:input('state-name').value,direction:id==='project-up'?-1:1}));
 $('project-build').onclick=()=>void run(async()=>{show(await api.projectBuild());status('项目已生成，可保存JSON/ZIP或发送到Figma。');});
 $('project-reset').onclick=()=>void run(async()=>{const p=await api.projectReset();if(p){project=p;render();}});
 $('project-backup').onclick=()=>void run(async()=>{if(await api.projectFile('save'))status('项目备份已保存。');});
 $('project-open').onclick=()=>void run(async()=>{if(await api.projectFile('open')){project=await api.projectRead();render();status('项目副本已打开。');}});
 $('link-save').onclick=()=>void run(async()=>{const selected=sel('project-state').value;const rect=sel('trigger-mode').value==='hotspot'?Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(input('hotspot-'+k).value)])):undefined;
   if(!rect&&!sel('project-node').value)throw Error('请先点选画面中的元素，或切换为绘制热点。');
   if(sel('link-action').value!=='close_overlay'&&!sel('link-target').value)throw Error('请先添加一个目标画面，再设置跳转或弹窗。');
   await edit('link',{nodeId:sel('project-node').value,action:sel('link-action').value,targetId:sel('link-target').value,...rect?{rect}:{}});sel('project-state').value=selected;renderState();status('连线已保存，可试播原型，或生成项目发送到 Figma。');});
 async function history(){const records=await api.historyList();sel('history-list').replaceChildren(...records.map(r=>new Option(`${r.name} · ${new Date(r.at).toLocaleString()}`,r.id)));$<HTMLButtonElement>('history-open').disabled=!records.length;}
 $('history-refresh').onclick=()=>void run(history);$('history-open').onclick=()=>void run(async()=>show(await api.historyOpen(sel('history-list').value)));
 $('viewport-apply').onclick=()=>void run(async()=>{await api.viewportSize({width:Number(input('viewport-width').value),height:Number(input('viewport-height').value)});status('已设置网页视口，画面缩放适配工作区。');});
 $('viewport-reset').onclick=()=>void run(async()=>{await api.viewportSize(null);status('已恢复随窗口调整的视口。');});
 $('session-clear').onclick=()=>void run(async()=>{if(await api.clearSession())status('内置浏览器会话已清除。');});
 void run(async()=>{project=await api.projectRead();render();await history();if('storageError'in project&&project.storageError)status(String(project.storageError),true);});
}
