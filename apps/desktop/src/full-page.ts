export const FULL_PAGE_LIMITS=Object.freeze({height:30000,steps:30,prepareMs:30000,references:12,previewBytes:32*1024*1024});
export interface PageInfo {x:number;y:number;width:number;viewportHeight:number;height:number;revision:number;virtualized:boolean;cancelled:boolean;settled?:boolean}
export interface FullPageAdapter {begin():Promise<PageInfo>;scroll(y:number):Promise<PageInfo>;restore(initial:PageInfo):Promise<boolean>}
export interface FullPageSummary {prepared:boolean;partial:boolean;reason:'loaded'|'bottom'|'height_limit'|'step_limit'|'time_limit'|'layout_growth';steps:number;documentHeight:number;capturedHeight:number;settled:boolean}
export function checkPage(info:PageInfo){if(info.cancelled)throw Error('E_CANCELLED: 全页采集已取消');if(info.virtualized)throw Error('E_FULL_PAGE_VIRTUALIZED: 滚动时部分列表内容被回收或替换，请改用视口/区块分段采集');}
export async function prepareFullPage(adapter:Pick<FullPageAdapter,'scroll'>,prepare:boolean,assertCurrent:()=>void,progress:(step:number,info:PageInfo)=>void,limits:{height:number;steps:number;prepareMs:number;references:number;previewBytes:number}={...FULL_PAGE_LIMITS},now:()=>number=Date.now):Promise<FullPageSummary>{
 const started=now();assertCurrent();let info=await adapter.scroll(0);assertCurrent();if(prepare)checkPage(info);
 let steps=0,reason:FullPageSummary['reason']=prepare?'bottom':'loaded',settled=info.settled!==false;
 progress(steps,info);
 if(prepare)while(true){
   assertCurrent();checkPage(info);
   const bottom=info.y+info.viewportHeight;
   if(bottom>=limits.height){reason=info.height>limits.height?'height_limit':'bottom';break;}
   if(bottom>=info.height-2){reason='bottom';break;}
   if(steps>=limits.steps){reason='step_limit';break;}
   if(now()-started>=limits.prepareMs){reason='time_limit';break;}
   const next=Math.min(info.y+Math.max(120,info.viewportHeight*.8),Math.max(0,Math.min(info.height,limits.height)-info.viewportHeight));
   const previous=info.y;info=await adapter.scroll(next);steps++;assertCurrent();checkPage(info);settled&&=info.settled!==false;progress(steps,info);
   if(info.y<=previous+.5&&info.y+info.viewportHeight<Math.min(info.height,limits.height)-2){reason='step_limit';break;}
 }
 if(info.height>limits.height&&(!prepare||reason==='bottom'))reason='height_limit';
 const partial=['height_limit','step_limit','time_limit'].includes(reason);
 const capturedHeight=Math.min(info.height,limits.height,prepare&&partial?info.y+info.viewportHeight:Infinity);
 return {prepared:prepare,partial,reason,steps,documentHeight:info.height,capturedHeight,settled};
}
export async function withFullPageSession<T>(adapter:FullPageAdapter,work:(initial:PageInfo)=>Promise<T>):Promise<{value:T;restored:boolean}>{
 const initial=await adapter.begin();let value!:T,restored=false;
 try{value=await work(initial);}finally{try{restored=await adapter.restore(initial);}catch{restored=false;}}
 return {value,restored};
}
export function referencePositions(height:number,viewportHeight:number,max=FULL_PAGE_LIMITS.references):{positions:number[];sampled:boolean}{
 if(height<=0||viewportHeight<=0||max<1)throw Error('E_LIMIT_EXCEEDED: 无效预览范围');
 const count=Math.max(1,Math.ceil(height/viewportHeight));const sampled=count>max;
 const positions=Array.from({length:Math.min(count,max)},(_,i)=>Math.round(sampled?i*Math.max(0,height-viewportHeight)/Math.max(1,max-1):Math.min(i*viewportHeight,Math.max(0,height-viewportHeight))));
 return {positions:[...new Set(positions)],sampled};
}
