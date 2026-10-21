import { parseCapturePackage, type CapturePackage } from '../../../packages/contracts/src/index';
import type { DomCapture } from './capture-data';
export function sanitizeSource(value: string): string {
  const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href;
}
export function convertCapture(capture: DomCapture, assets: CapturePackage['assets'], pageEpoch: string, packageId: string): CapturePackage {
  return convertCaptures([capture],assets,pageEpoch,packageId);
}
export function mergeCaptures(captures:DomCapture[]):DomCapture{
  if(!captures.length)throw Error('E_SELECTION_REQUIRED');if(captures.length===1)return captures[0];
  const bounds=captures.map(capture=>capture.selection.originalRect);
  const x=Math.min(...bounds.map(r=>r.x)),y=Math.min(...bounds.map(r=>r.y));
  const rect={x,y,width:Math.max(...bounds.map(r=>r.x+r.width))-x,height:Math.max(...bounds.map(r=>r.y+r.height))-y};
  const nodes:DomCapture['nodes']=[{id:'merged-root',name:'合并选区',type:'FRAME',parentId:null,order:0,rect:{...rect,x:0,y:0},style:{fills:[]},fidelity:'native',clipsContent:false,layout:{mode:'absolute'}}];
  const warnings:DomCapture['warnings']=[],images:DomCapture['images']=[],flexCandidates:NonNullable<DomCapture['flexCandidates']>=[];
  captures.forEach((capture,index)=>{const prefix=`part-${index}-`;flexCandidates.push(...(capture.flexCandidates??[]).map(h=>({...h,id:prefix+h.id})));for(const node of capture.nodes){nodes.push({...node,id:prefix+node.id,parentId:node.parentId?prefix+node.parentId:'merged-root',order:nodes.length,rect:node.parentId?{...node.rect}:{...node.rect,x:bounds[index].x-x,y:bounds[index].y-y}});}warnings.push(...capture.warnings.map(w=>({...w,...(w.nodeId?{nodeId:prefix+w.nodeId}:{})})));images.push(...capture.images.map(image=>({...image,nodeId:prefix+image.nodeId,...(image.ownerNodeId?{ownerNodeId:prefix+image.ownerNodeId}:{})})));});
  return {...captures[0],nodes,images,warnings,flexCandidates,requestedRect:rect,selection:{...captures[0].selection,originalRect:rect,sourceNodeIds:captures.flatMap(c=>c.selection.sourceNodeIds),excludedSourceNodeIds:[...new Set(captures.flatMap(c=>c.selection.excludedSourceNodeIds))]}};
}
export function convertCaptures(captures:DomCapture[],assets:CapturePackage['assets'],pageEpoch:string,packageId:string):CapturePackage{
  if(!captures.length||captures.length>20)throw Error('E_LIMIT_EXCEEDED: 一次最多 20 个区块');
  const capture=captures[0];
  return parseCapturePackage({
    schemaVersion: '1.0.0', artifactKind: 'capture', packageId, projectId: 'local-web-capture', revision: 1, createdAt: new Date().toISOString(),
    requiredCapabilities: ['absolute-layout', 'inline-images', ...(captures.some(c=>c.nodes.some(n=>n.layout&&n.layout.mode!=='absolute'))?['auto-layout']:[]), ...(captures.some(c=>c.nodes.some(n=>n.type==='VECTOR'))?['inline-svg']:[]), ...(captures.some(c=>c.nodes.some(n=>n.text&&(n.text.font.fallbacks||n.text.runs.some(r=>r.font.fallbacks||r.color||r.letterSpacing!==undefined||r.decoration))))?['styled-text']:[]), ...(captures.some(c=>c.nodes.some(n=>n.imageSizing))?['image-placement']:[]), ...(captures.some(c=>c.nodes.some(n=>n.style.fills?.some(f=>f.kind==='linear_gradient')))?['linear-gradients']:[])], producer: { appVersion: '0.1.0', converterVersion: 'desktop-1.0', adapterVersion: 'web-dom-2' },
    source: { kind: 'web', url: sanitizeSource(capture.url), title: capture.title.slice(0, 2048), pageEpoch, captureContext: capture.context },
    screens: captures.map((item,index)=>({id:`screen-${index+1}`,captureId:`${packageId}-capture-${index+1}`,stateKey:`captured-state-${index+1}`,name:item.nodes[0].name,rootNodeId:item.nodes[0].id,selection:item.selection,nodes:item.nodes})),
    assets, interactions: [], warnings: captures.flatMap((item,index)=>item.warnings.map(warning=>({...warning,screenId:`screen-${index+1}`})))
  });
}

