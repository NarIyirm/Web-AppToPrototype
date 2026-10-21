import { createHash } from 'node:crypto';
import { readMobileBundle } from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/mobile-bundle';
import type { Capture,TextObservation } from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/project';
import { parseCapturePackage,type CapturePackage,type Color,type SceneNode,type SourcePlatform } from '../../../packages/contracts/src/index';
import { clearReliableText,cropMobilePixels,decodeMobilePng,encodeMobilePng,sampleTextInk } from './mobile-png';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function color(input:string|undefined):Color|undefined{
 const match=input?.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\s*\)$/);if(!match)return;
 const values=match.slice(1).map(Number);if(values.slice(0,3).some(v=>!Number.isFinite(v)||v<0||v>255))return;
 const a=match[4]===undefined?1:values[3];if(!Number.isFinite(a)||a<0||a>1)return;
 return {r:values[0]/255,g:values[1]/255,b:values[2]/255,a};
}
const platform=(value:string):SourcePlatform=>['ios','android','web'].includes(value)?value as SourcePlatform:'unknown';
export function isMobileMaterial(bytes:Uint8Array){
 if(bytes.length<30||bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)return false;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint16(26,true);
 return length===11&&bytes.length>=41&&Buffer.from(bytes.subarray(30,41)).toString('utf8')==='mobile.json';
}
const context=(capture:Capture)=>({viewport:{width:capture.logicalWidth,height:capture.logicalHeight},devicePixelRatio:1,zoomFactor:1,scroll:{x:0,y:0}});
export async function importMobileBundle(bytes:Uint8Array,recognize?:(bytes:Uint8Array,width:number,height:number)=>Promise<TextObservation[]>){
 const bundle=await readMobileBundle(bytes,async data=>hash(data)),assets:CapturePackage['assets']=[],warnings:CapturePackage['warnings']=[];
 const addAsset=(data:Uint8Array,width:number,height:number)=>{const sha256=hash(data),assetId=`mobile-${sha256}`;if(!assets.some(a=>a.assetId===assetId))assets.push({assetId,sha256,mime:'image/png',byteLength:data.length,width,height,inlineBase64:Buffer.from(data).toString('base64')});return assetId;};
 const materials:Capture[]=[];
 for(const original of bundle.state.captures){const capture=structuredClone(original);
  if(recognize&&capture.sourceKind!=='web'&&!capture.observations.length){try{capture.observations=await recognize(bundle.files.get(`assets/${capture.assetId}.png`)!,capture.width,capture.height);capture.warnings.push(capture.observations.length?`电脑已离线识别 ${capture.observations.length} 行文字；可靠区域转文字，其余保留图片。`:'电脑没有识别到文字，已保留画面；可继续添加手工热点。');}catch{capture.warnings.push('电脑离线文字识别不可用，已保留原画面；可使用手机识别结果或在电脑添加热点。');}}
  materials.push(capture);
 }
 const screens:CapturePackage['screens']=materials.map((capture,index)=>{
  const screenId=`mobile-screen-${index+1}`,rootId=`root-${capture.id}`,sourceBytes=bundle.files.get(`assets/${capture.assetId}.png`)!;
  const pixels=decodeMobilePng(sourceBytes),nodes:SceneNode[]=[{id:rootId,name:capture.title,type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:capture.logicalWidth,height:capture.logicalHeight},style:{fills:[]},fidelity:'approximated',clipsContent:true}];
  let editable=0;const warn=(code:string,message:string,nodeId?:string,details?:Record<string,unknown>)=>warnings.push({code,severity:'warning',message,screenId,...nodeId?{nodeId}:{},...details?{details}:{}});
  const textNode=(text:string,bounds:SceneNode['rect'],fontSize:number,id:string,provenance:string,confidence:number|null,textColor:Color={r:0,g:0,b:0,a:1}):SceneNode=>{
   warn('W_MOBILE_TEXT_APPROXIMATED','文字内容可校对，字体、颜色或排版可能为近似。',id,{provenance,confidence});
   return {id,name:`${provenance} · ${text.slice(0,50)}`,type:'TEXT',parentId:rootId,order:nodes.length,rect:bounds,fidelity:'approximated',style:{fills:[{kind:'solid',color:textColor}]},
    text:{characters:text,font:{family:'Noto Sans CJK SC',style:'Regular',weight:400,size:Math.max(1,fontSize),fallbacks:['PingFang SC','Microsoft YaHei','Inter']},lineHeight:Math.max(1,bounds.height),letterSpacing:0,align:'left',runs:[]}};
  };
  if(capture.sourceKind==='web'&&capture.webNodes.length&&pixels&&!capture.redacted){
   const corner=pixels.rgba.subarray(0,4);nodes[0].style.fills=[{kind:'solid',color:{r:corner[0]/255,g:corner[1]/255,b:corner[2]/255,a:corner[3]/255}}];
   for(const observation of capture.webNodes){if(nodes.length>=5000)break;const id=`web-${capture.id}-${nodes.length}`;
    if(observation.kind==='text'&&observation.text){const node=textNode(observation.text,observation.bounds,observation.fontSize??16,id,'dom',null,color(observation.color));
     if(node.text){node.text.font.family=observation.fontFamily?.split(',')[0].trim().replace(/^['"]|['"]$/g,'')||node.text.font.family;node.text.font.weight=observation.fontWeight??400;node.text.font.style=node.text.font.weight>=600?'Bold':'Regular';node.text.lineHeight=observation.lineHeight??Math.max(1,(observation.fontSize??16)*1.2);node.text.align=observation.textAlign??'left';}
     nodes.push(node);editable++;}
    else if(observation.kind==='shape'){const fill=color(observation.background);if(fill)nodes.push({id,name:'网页背景',type:'SHAPE',parentId:rootId,order:nodes.length,rect:observation.bounds,fidelity:'approximated',style:{fills:[{kind:'solid',color:fill}],radii:[observation.radius??0,observation.radius??0,observation.radius??0,observation.radius??0]}});}
    else if(observation.kind==='image'){const image=cropMobilePixels(pixels,{x:observation.bounds.x/capture.logicalWidth*pixels.width,y:observation.bounds.y/capture.logicalHeight*pixels.height,width:observation.bounds.width/capture.logicalWidth*pixels.width,height:observation.bounds.height/capture.logicalHeight*pixels.height});nodes.push({id,name:'网页图片区域',type:'IMAGE',parentId:rootId,order:nodes.length,rect:observation.bounds,fidelity:'rasterized',style:{fills:[]},assetId:addAsset(encodeMobilePng(image),image.width,image.height)});}
   }
   warn('W_MOBILE_WEB_SUBSET','移动网页当前转换基础文字、纯色背景和图片区域；复杂样式、层叠和字体请与参考图校对。');
  }else{
   const prepared=pixels?{...pixels,rgba:new Uint8Array(pixels.rgba)}:undefined;
   const replacements:SceneNode[]=[];
   if(prepared){for(const [i,observation] of capture.observations.entries()){
    if(i>=100)break;const overlaps=capture.observations.some((other,j)=>j!==i&&observation.bounds.x<other.bounds.x+other.bounds.width+4&&observation.bounds.x+observation.bounds.width+4>other.bounds.x&&observation.bounds.y<other.bounds.y+other.bounds.height+4&&observation.bounds.y+observation.bounds.height+4>other.bounds.y);
    const ink=sampleTextInk(prepared,observation.bounds);
    if(!observation.text.trim()||overlaps||!clearReliableText(prepared,observation.bounds)){warn('W_OCR_REGION_RETAINED','该文字区域背景不可靠或存在重叠，继续保留图片。',undefined,{provenance:observation.provenance});continue;}
    const bounds={x:observation.bounds.x/capture.width*capture.logicalWidth,y:observation.bounds.y/capture.height*capture.logicalHeight,width:observation.bounds.width/capture.width*capture.logicalWidth,height:observation.bounds.height/capture.height*capture.logicalHeight};
    replacements.push(textNode(observation.text,bounds,bounds.height*.85,`ocr-${capture.id}-${i}`,observation.provenance,observation.confidence,ink));editable++;
   }}
   const output=editable&&prepared?encodeMobilePng(prepared):sourceBytes;
   nodes.push({id:`image-${capture.id}`,name:editable?'已清除替换文字的画面':'保留图片区域',type:'IMAGE',parentId:rootId,order:1,rect:{x:0,y:0,width:capture.logicalWidth,height:capture.logicalHeight},style:{fills:[]},fidelity:'rasterized',assetId:addAsset(output,capture.width,capture.height)});
   for(const node of replacements){node.order=nodes.length;nodes.push(node);}
   warn('W_MOBILE_RASTER_RETAINED','复杂区域保留图片；只有通过背景检查并移除原文字像素的区域才生成替换文字。',undefined,{editableTextRegions:editable,sourceKind:capture.sourceKind});
  }
  for(const message of capture.warnings)warn('W_MOBILE_SOURCE',message);
  warn('W_MOBILE_GEOMETRY','坐标按素材包逻辑画布归一化，未把图片缩放比例伪称为设备 DPR。',undefined,{imageWidth:capture.width,imageHeight:capture.height,logicalWidth:capture.logicalWidth,logicalHeight:capture.logicalHeight,coordinateSpace:capture.coordinateSpace});
  return {id:screenId,captureId:capture.id,name:capture.title,stateKey:capture.id,rootNodeId:rootId,
   selection:{mode:'viewport' as const,sourceNodeIds:[],excludedSourceNodeIds:[],originalRect:{x:0,y:0,width:capture.logicalWidth,height:capture.logicalHeight},boundaryPolicy:'strict' as const,contentScope:'visible' as const},nodes,
   sourceOverride:{kind:capture.sourceKind,platform:platform(capture.platform),mobileBundleId:bundle.meta.packageId,...capture.sourceUrl?{url:capture.sourceUrl}:{},pageEpoch:capture.id,captureContext:context(capture),capturedAt:capture.createdAt}};
 });
 const first=bundle.state.captures[0];
 const data=parseCapturePackage({schemaVersion:'2.0.0',artifactKind:'capture',packageId:`mobile-${bundle.meta.packageId}`,projectId:bundle.meta.project.id,revision:bundle.meta.revision,createdAt:bundle.meta.createdAt,
  mobileSource:{formatVersion:'0.1.0-alpha.1',bundleIds:[bundle.meta.packageId]},requiredCapabilities:['absolute-layout','inline-images','styled-text','mobile-sources'],
  producer:{appVersion:'0.1.0',converterVersion:'mobile-desktop-1',adapterVersion:bundle.meta.producer.adapterVersion},
  source:{kind:first.sourceKind,platform:platform(first.platform),...first.sourceUrl?{url:first.sourceUrl}:{},title:bundle.meta.project.name,pageEpoch:first.id,captureContext:context(first)},screens,assets,interactions:[],warnings});
 return {data,bundle};
}
