import type {CapturePackage} from '../../../packages/contracts/src/index';
import {absoluteRects,drawScene} from './scene-preview';

/** Local click-through uses the saved interactions; it never guesses a transition. */
export function setupPrototypePlayer(read:()=>CapturePackage|null){
 const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 let data:CapturePackage|null=null,baseId='',overlayId='',revision=0;
 async function render(){if(!data)return;const current=data,version=++revision,base=current.screens.find(s=>s.id===baseId);if(!base)return;
  const root=base.nodes.find(n=>n.id===base.rootNodeId)!;
  const canvas=$<HTMLCanvasElement>('prototype-base');canvas.style.width=Math.min(280,420*root.rect.width/root.rect.height)+'px';
  await drawScene(canvas,current,base);if(version!==revision)return;
  const overlay=current.screens.find(s=>s.id===overlayId),extra=$<HTMLCanvasElement>('prototype-overlay');extra.hidden=!overlay;
  if(overlay){const r=overlay.nodes.find(n=>n.id===overlay.rootNodeId)!.rect;extra.style.width=Math.min(260,r.width/root.rect.width*parseFloat(canvas.style.width))+'px';await drawScene(extra,current,overlay);if(version!==revision)return;}
  $('prototype-player-name').textContent=overlay?`${base.name} → ${overlay.name}`:base.name;
  const currentScreen=overlay??base,actions=$('prototype-actions');actions.replaceChildren();
  for(const link of current.interactions.filter(i=>i.fromScreenId===currentScreen.id)){const button=document.createElement('button'),node=currentScreen.nodes.find(n=>n.id===link.triggerNodeId),target=current.screens.find(s=>s.id===link.toScreenId);button.textContent=`${node?.name??'点击区域'} → ${link.action==='close_overlay'?'关闭弹窗':target?.name??'目标画面'}`;button.onclick=()=>activate(link);actions.append(button);}
  $('prototype-player-note').textContent='点击已设置的区域试播；这里只演示保存的跳转，最终播放在 Figma 验证。';
 }
 function click(event:MouseEvent,overlay:boolean){if(!data)return;const screen=data.screens.find(s=>s.id===(overlay?overlayId:baseId));if(!screen)return;
  const canvas=event.currentTarget as HTMLCanvasElement,b=canvas.getBoundingClientRect(),root=screen.nodes.find(n=>n.id===screen.rootNodeId)!.rect;
  const x=(event.clientX-b.x)/b.width*root.width,y=(event.clientY-b.y)/b.height*root.height,rects=absoluteRects(screen);
  const link=data.interactions.filter(i=>i.fromScreenId===screen.id).filter(i=>{const r=rects.get(i.triggerNodeId);return r&&x>=r.x&&y>=r.y&&x<=r.x+r.width&&y<=r.y+r.height;}).sort((a,b)=>{const x=rects.get(a.triggerNodeId)!,y=rects.get(b.triggerNodeId)!;return x.width*x.height-y.width*y.height;})[0];
  if(!link){$('prototype-player-note').textContent='此处没有保存点击动作，可退出试播后添加连线。';return;}
  activate(link);
 }
 function activate(link:CapturePackage['interactions'][number]){
  if(!data)return;
  if(link.action==='close_overlay')overlayId='';else if(link.action==='open_overlay')overlayId=link.toScreenId!;else{baseId=link.toScreenId!;overlayId='';}
  void render();
 }
 $('prototype-play').onclick=()=>{const value=read();if(!value?.screens.length)return;data=structuredClone(value);baseId=data.screens[0].id;overlayId='';$('prototype-player').hidden=false;void render();};
 $('prototype-stop').onclick=()=>{revision++;$('prototype-player').hidden=true;data=null;};
 $('prototype-base').onclick=e=>click(e,false);$('prototype-overlay').onclick=e=>click(e,true);
 return ()=>{revision++;$('prototype-player').hidden=true;data=null;};
}
