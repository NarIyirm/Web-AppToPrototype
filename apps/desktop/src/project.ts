import {parseCapturePackage,type CapturePackage,type Rect} from '../../../packages/contracts/src/index';
import type {SourcePreview} from './capture-data';
import {decodeBase64,inspectImage,sha256} from '../../../packages/contracts/src/resources';
export interface ProjectDocument {format:'w2p-project-1';id:string;name:string;revision:number;data:CapturePackage|null;previews:SourcePreview[]}
export const emptyProject=(id:string):ProjectDocument=>({format:'w2p-project-1',id,name:'未命名项目',revision:1,data:null,previews:[]});
export function selectProjectScreens(data:CapturePackage,ids?:unknown):CapturePackage{
 if(ids===undefined)return data;
 if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||ids.some(id=>!data.screens.some(s=>s.id===id)))throw Error('请选择有效的转换画面。');
 const screens=data.screens.filter(s=>ids.includes(s.id)),used=new Set(screens.flatMap(s=>s.nodes.map(n=>n.assetId)));
 return parseCapturePackage({...data,screens,assets:data.assets.filter(a=>used.has(a.assetId)),warnings:data.warnings.filter(w=>!w.screenId||ids.includes(w.screenId)),interactions:data.interactions.filter(i=>ids.includes(i.fromScreenId)&&(!i.toScreenId||ids.includes(i.toScreenId)))});
}
const name=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>120)throw Error('名称需为1–120字符');return value.trim();};
export function validateProject(input:unknown):ProjectDocument{
  const p=input as ProjectDocument;if(!p||p.format!=='w2p-project-1'||typeof p.id!=='string'||!/^project-[\w-]{1,100}$/.test(p.id)||!Number.isInteger(p.revision)||p.revision<1||!Array.isArray(p.previews)||p.previews.length>240)throw Error('E_PROJECT_INVALID');
  name(p.name);if(p.data)parseCapturePackage(p.data);let bytes=0;for(const v of p.previews){if(!v||typeof v.dataUrl!=='string'||!v.dataUrl.startsWith('data:image/png;base64,')||v.dataUrl.length>28*1024*1024||!v.metadata||!p.data?.screens.some(s=>s.id===v.metadata.screenId))throw Error('E_PROJECT_PREVIEW_INVALID');const image=decodeBase64(v.dataUrl.slice(22));bytes+=image.length;if(bytes>64*1024*1024)throw Error('E_LIMIT_EXCEEDED: project preview bytes');const info=inspectImage(image);if(info.width>2048||info.height>2048||sha256(image)!==v.metadata.sha256||info.width!==v.metadata.pixelWidth||info.height!==v.metadata.pixelHeight)throw Error('E_PROJECT_PREVIEW_INVALID');for(const r of [v.metadata.documentRect,v.metadata.frameRect])if(!r||!['x','y','width','height'].every(k=>Number.isFinite(r[k as keyof Rect]))||r.width<=0||r.height<=0)throw Error('E_PROJECT_PREVIEW_INVALID');}return p;
}
export function addProjectStates(input:ProjectDocument,data:CapturePackage,previews:SourcePreview[],nonce:string):ProjectDocument{
  const p=structuredClone(input),source=parseCapturePackage(structuredClone(data));
  if(!p.data)p.data={...source,packageId:p.id,projectId:p.id,revision:p.revision,screens:[],assets:[],warnings:[],interactions:[]};
  const dest=p.data,ids=new Map(source.screens.map((s,i)=>[s.id,`state-${nonce}-${i}`]));
  if(source.schemaVersion==='2.0.0'||dest.schemaVersion==='2.0.0'){
    dest.schemaVersion='2.0.0';dest.source.platform??='desktop';
    dest.mobileSource={formatVersion:'0.1.0-alpha.1',bundleIds:[...new Set([...(dest.mobileSource?.bundleIds??[]),...(source.mobileSource?.bundleIds??[])])]};
  }
  for(const s of source.screens){const id=ids.get(s.id)!;dest.screens.push({...s,id,stateKey:id,sourceOverride:{...(source.source.url?{url:source.source.url}:{}),pageEpoch:source.source.pageEpoch,captureContext:source.source.captureContext,capturedAt:source.createdAt,...(dest.schemaVersion==='2.0.0'?{kind:source.source.kind,platform:source.source.platform??'desktop'}:{}),...s.sourceOverride}});}
  dest.requiredCapabilities=[...new Set([...(dest.requiredCapabilities??[]),...(source.requiredCapabilities??[])])];
  const assets=new Map(dest.assets.map(a=>[a.assetId,a]));for(const a of source.assets){if(assets.has(a.assetId)&&JSON.stringify(assets.get(a.assetId))!==JSON.stringify(a))throw Error('E_PACKAGE_CONFLICT: 图片标识冲突');assets.set(a.assetId,a);}dest.assets=[...assets.values()];
  dest.warnings.push(...source.warnings.map(w=>({...w,...w.screenId?{screenId:ids.get(w.screenId)}:{}})));
  dest.interactions.push(...source.interactions.map((link,i)=>({...link,id:`link-${nonce}-${i}`,fromScreenId:ids.get(link.fromScreenId)!,...link.toScreenId?{toScreenId:ids.get(link.toScreenId)}:{}})));
  p.previews.push(...previews.filter(v=>ids.has(v.metadata.screenId)).map(v=>({...v,metadata:{...v.metadata,screenId:ids.get(v.metadata.screenId)!,packageId:p.id}})));
  return finish(p);
}
function finish(p:ProjectDocument){p.revision++;if(p.data){p.data.revision=p.revision;p.data.createdAt=new Date().toISOString();parseCapturePackage(p.data);p.previews=p.previews.map(v=>({...v,metadata:{...v.metadata,revision:p.revision,packageId:p.data!.packageId}}));}return validateProject(p);}
export function editProject(input:ProjectDocument,action:string,value:Record<string,unknown>):ProjectDocument{
  const p=structuredClone(input);if(action==='name'){p.name=name(value.name);return finish(p);}
  if(!p.data)throw Error('请先保存一个状态');const data=p.data,s=data.screens.find(s=>s.id===value.screenId);
  if(action==='remove-link'){const removed=data.interactions.find(l=>l.id===value.id);data.interactions=data.interactions.filter(l=>l.id!==value.id);
    if(removed){const owner=data.screens.find(s=>s.id===removed.fromScreenId);if(owner&&removed.triggerNodeId.startsWith('hotspot-')&&!data.interactions.some(l=>l.fromScreenId===owner.id&&l.triggerNodeId===removed.triggerNodeId))owner.nodes=owner.nodes.filter(n=>n.id!==removed.triggerNodeId);}
    return finish(p);}
  if(!s)throw Error('E_LINK_TARGET_MISSING: 状态不存在');
  if(action==='rename'){s.name=name(value.name);s.nodes.find(n=>n.id===s.rootNodeId)!.name=s.name;}
  else if(action==='move'){const index=data.screens.indexOf(s),to=index+Number(value.direction);if(!Number.isInteger(to)||to<0||to>=data.screens.length)throw Error('不能移到此位置');data.screens.splice(index,1);data.screens.splice(to,0,s);}
  else if(action==='delete'){data.screens=data.screens.filter(x=>x!==s);data.interactions=data.interactions.filter(l=>l.fromScreenId!==s.id&&l.toScreenId!==s.id);data.warnings=data.warnings.filter(w=>w.screenId!==s.id);p.previews=p.previews.filter(v=>v.metadata.screenId!==s.id);const used=new Set(data.screens.flatMap(s=>s.nodes.map(n=>n.assetId)));data.assets=data.assets.filter(a=>used.has(a.assetId));if(!data.screens.length)p.data=null;}
  else if(action==='link'){
    let trigger=String(value.nodeId??'');const action=String(value.action);
    if(!['navigate','open_overlay','close_overlay'].includes(action))throw Error('交互动作无效');
    if(action!=='close_overlay'&&!data.screens.some(s=>s.id===value.targetId))throw Error('E_LINK_TARGET_MISSING: 目标状态不存在');
    if(value.rect){const r=value.rect as Rect,root=s.nodes.find(n=>n.id===s.rootNodeId)!.rect;if(!['x','y','width','height'].every(k=>Number.isFinite(r[k as keyof Rect]))||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>root.width+.01||r.y+r.height>root.height+.01)throw Error('热点必须位于画面内部');
      trigger=`hotspot-${value.id}`;if(s.nodes.some(n=>n.id===trigger))throw Error('热点标识重复');s.nodes.push({id:trigger,name:'交互热点',type:'SHAPE',parentId:s.rootNodeId,order:s.nodes.length,rect:r,style:{fills:[{kind:'solid',color:{r:1,g:1,b:1,a:0}}]},fidelity:'native'});
    }
    if(!s.nodes.some(n=>n.id===trigger))throw Error('E_LINK_TARGET_MISSING: 触发元素不存在');
    data.interactions=data.interactions.filter(l=>!(l.fromScreenId===s.id&&l.triggerNodeId===trigger));
    data.interactions.push({id:`link-${value.id}`,fromScreenId:s.id,triggerNodeId:trigger,trigger:'click',action:action as 'navigate'|'open_overlay'|'close_overlay',...action==='close_overlay'?{}:{toScreenId:String(value.targetId)},transition:'instant'});
    data.requiredCapabilities=[...new Set([...(data.requiredCapabilities??[]),'click-navigation'])];
  }else throw Error('未知项目操作');
  return finish(p);
}
