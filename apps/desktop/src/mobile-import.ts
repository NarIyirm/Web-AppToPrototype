import { createHash } from 'node:crypto';
import { readMobileBundle } from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/mobile-bundle';
import type { Capture,TextObservation } from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/project';
import { parseCapturePackage,type CapturePackage,type Color,type SceneNode,type SourcePlatform } from '../../../packages/contracts/src/index';
import { clearReliableText,cropMobilePixels,decodeMobilePng,encodeMobilePng,sampleTextInk } from './mobile-png';
import {reconstructMobileImage} from './mobile-reconstruct';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function color(input:string|undefined):Color|undefined{
 const match=input?.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\s*\)$/);if(!match)return;
 const values=match.slice(1).map(Number);if(values.slice(0,3).some(v=>!Number.isFinite(v)||v<0||v>255))return;
 const a=match[4]===undefined?1:values[3];if(!Number.isFinite(a)||a<0||a>1)return;
 return {r:values[0]/255,g:values[1]/255,b:values[2]/255,a};
}
const platform=(value:string):SourcePlatform=>['ios','android','web'].includes(value)?value as SourcePlatform:'unknown';
function ocrText(value:string){return value.replace(/(?<=\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu,'')
 .replace(/[ \t]+([，。！？、：；）】》”’])/gu,'$1').replace(/([（【《“‘，。！？、：；])[ \t]+/gu,'$1')
 .replace(/(?<=\d)[ \t]*：[ \t]*(?=\d)/gu,':');}
function ocrFontSize(text:string,bounds:SceneNode['rect']){
 const units=Array.from(text).reduce((sum,char)=>sum+(/\p{Script=Han}|[\u3000-\u303f\uff00-\uffef]/u.test(char)?1:/\s/u.test(char)?.3:/[A-Z]/.test(char)?.72:/[a-z0-9]/.test(char)?.62:/[.,:;!|'·]/.test(char)?.35:.75),0);
 return Math.max(1,Math.min(bounds.height*(/\p{Script=Han}/u.test(text)?1.12:1.3),bounds.width/Math.max(1,units)*.95));
}
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
   const replacements:SceneNode[]=[],clearedRegions:SceneNode['rect'][]=[];
   if(prepared){for(const [i,observation] of capture.observations.entries()){
    if(i>=500)break;const overlaps=capture.observations.some((other,j)=>j!==i&&Math.min(observation.bounds.x+observation.bounds.width,other.bounds.x+other.bounds.width)-Math.max(observation.bounds.x,other.bounds.x)>1&&Math.min(observation.bounds.y+observation.bounds.height,other.bounds.y+other.bounds.height)-Math.max(observation.bounds.y,other.bounds.y)>1);
    const ink=sampleTextInk(prepared,observation.bounds);
    if(!observation.text.trim()||observation.confidence!==null&&observation.confidence<0.45||overlaps||!clearReliableText(prepared,observation.bounds)){warn('W_OCR_REGION_RETAINED','该文字区域背景不可靠、识别置信度低或存在重叠，继续保留局部图片。',undefined,{provenance:observation.provenance});continue;}
    const bounds={x:observation.bounds.x/capture.width*capture.logicalWidth,y:observation.bounds.y/capture.height*capture.logicalHeight,width:observation.bounds.width/capture.width*capture.logicalWidth,height:observation.bounds.height/capture.height*capture.logicalHeight};
    const content=observation.provenance==='ocr'?ocrText(observation.text):observation.text;
    const fontSize=ocrFontSize(content,bounds),inset=fontSize*.12;
    clearedRegions.push(observation.bounds);
    replacements.push(textNode(content,{...bounds,y:Math.max(0,bounds.y-inset),height:bounds.height+inset*2},fontSize,`ocr-${capture.id}-${i}`,observation.provenance,observation.confidence,ink));editable++;
   }}
   let shapeCount=0,imageCount=0;
   if(prepared){
    const reconstruction=reconstructMobileImage(prepared,clearedRegions),scaleX=capture.logicalWidth/capture.width,scaleY=capture.logicalHeight/capture.height;
    const logical=(rect:SceneNode['rect'])=>({x:rect.x*scaleX,y:rect.y*scaleY,width:rect.width*scaleX,height:rect.height*scaleY});
    nodes[0].style.fills=[{kind:'solid',color:reconstruction.background}];
    for(const [i,shape] of reconstruction.shapes.entries())nodes.push({id:`shape-${capture.id}-${i}`,name:'可编辑背景 / 控件',type:'SHAPE',parentId:rootId,order:nodes.length,
     rect:logical(shape.rect),fidelity:'approximated',style:{fills:[{kind:'solid',color:shape.color}],radii:Array(4).fill(shape.radius*Math.min(scaleX,scaleY))}});
    for(const [i,part] of reconstruction.images.entries())nodes.push({id:`image-${capture.id}-${i}`,name:`图标 / 复杂图案 ${i+1}`,type:'IMAGE',parentId:rootId,order:nodes.length,
     rect:logical(part.rect),style:{fills:[]},fidelity:'rasterized',assetId:addAsset(encodeMobilePng(part.image),part.image.width,part.image.height)});
    shapeCount=reconstruction.shapes.length;imageCount=reconstruction.images.length;
   }else{nodes.push({id:`image-${capture.id}`,name:'未支持编码的原始画面',type:'IMAGE',parentId:rootId,order:1,rect:{x:0,y:0,width:capture.logicalWidth,height:capture.logicalHeight},style:{fills:[]},fidelity:'rasterized',assetId:addAsset(sourceBytes,capture.width,capture.height)});imageCount=1;}
   for(const node of replacements){node.order=nodes.length;nodes.push(node);}
   warn('W_MOBILE_RECONSTRUCTED',`已拆分 ${editable} 个文字图层、${shapeCount} 个背景/控件和 ${imageCount} 个局部图像；背景、字体及组件结构由像素近似，请校对。`,undefined,{editableTextRegions:editable,editableShapes:shapeCount,imageRegions:imageCount,sourceKind:capture.sourceKind});
   if(imageCount)warn('W_MOBILE_RASTER_RETAINED','照片、复杂图案和未可靠识别的文字保留为局部图像；不是原 App 组件树。',undefined,{editableTextRegions:editable,sourceKind:capture.sourceKind});
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
  producer:{appVersion:'0.1.0',converterVersion:'mobile-desktop-2',adapterVersion:bundle.meta.producer.adapterVersion},
  source:{kind:first.sourceKind,platform:platform(first.platform),...first.sourceUrl?{url:first.sourceUrl}:{},title:bundle.meta.project.name,pageEpoch:first.id,captureContext:context(first)},screens,assets,interactions:[],warnings});
 return {data,bundle};
}
