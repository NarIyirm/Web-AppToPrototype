import { nativeImage, type NativeImage } from 'electron';
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import type { DomCapture, PreviewMetadata, SourcePreview } from './capture-data';
import type { CapturePackage, Rect } from '../../../packages/contracts/src/index';
import { intersection } from './geometry';
import { inspectImage } from '../../../packages/contracts/src/resources';
import {previewPath} from './preview-path';
const MAX_BYTES=20*1024*1024;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
export function makePreview(image:NativeImage,capture:DomCapture,packageId:string,screenId='screen-1',scroll=capture.context.scroll):SourcePreview | undefined {
  const frame=capture.selection.originalRect;
  const viewport={...scroll,width:capture.context.viewport.width,height:capture.context.viewport.height};
  const visible=intersection(frame,viewport);if(!visible||image.isEmpty())return;
  // Normalize the PNG representation before measuring; never assume DPR or zoom=1.
  const bitmap=nativeImage.createFromBuffer(image.toPNG());const size=bitmap.getSize();
  const scaleX=size.width/viewport.width,scaleY=size.height/viewport.height;
  const x=Math.max(0,Math.floor((visible.x-viewport.x)*scaleX)),y=Math.max(0,Math.floor((visible.y-viewport.y)*scaleY));
  const right=Math.min(size.width,Math.ceil((visible.x+visible.width-viewport.x)*scaleX));
  const bottom=Math.min(size.height,Math.ceil((visible.y+visible.height-viewport.y)*scaleY));
  let cropped=bitmap.crop({x,y,width:right-x,height:bottom-y});
  const cropSize=cropped.getSize();
  if(Math.max(cropSize.width,cropSize.height)>2048){const ratio=2048/Math.max(cropSize.width,cropSize.height);cropped=cropped.resize({width:Math.max(1,Math.round(cropSize.width*ratio)),height:Math.max(1,Math.round(cropSize.height*ratio)),quality:'best'});}
  const bytes=cropped.toPNG();const pixels=nativeImage.createFromBuffer(bytes).getSize();
  if(bytes.length>MAX_BYTES)throw Error('预览图片超过 20 MiB');
  return {dataUrl:`data:image/png;base64,${bytes.toString('base64')}`,metadata:{packageId,revision:1,screenId,capturedAt:new Date().toISOString(),frameRect:frame,requestedRect:capture.requestedRect??frame,documentRect:visible,partial:visible.width<frame.width-.01||visible.height<frame.height-.01,pixelWidth:pixels.width,pixelHeight:pixels.height,sha256:digest(bytes)}};
}
export async function savePreview(path:string,preview:SourcePreview,data:CapturePackage):Promise<string>{
  const metadata={...preview.metadata,packageId:data.packageId,revision:data.revision};
  const bytes=Buffer.from(preview.dataUrl.split(',')[1],'base64');
  await writeFile(`${path}.preview.png`,bytes);await writeFile(`${path}.preview.json`,JSON.stringify(metadata,null,2));
  return `${path}.preview.png`;
}
export async function savePreviews(path:string,previews:SourcePreview[],data:CapturePackage){let first:string|undefined;for(const preview of previews){const saved=await savePreview(previewPath(path,preview.metadata.screenId,data.screens[0].id,preview.metadata.segmentIndex??1),preview,data);first??=saved;}return first;}
export async function loadPreviews(path:string,data:CapturePackage){const previews:SourcePreview[]=[];let bytes=0;for(const screen of data.screens){const first=await loadPreview(previewPath(path,screen.id,data.screens[0].id),data,screen.id);if(!first)continue;previews.push(first);bytes+=first.dataUrl.length;for(let i=2;i<=(first.metadata.segmentCount??1);i++){if(bytes>48*1024*1024)break;const image=await loadPreview(previewPath(path,screen.id,data.screens[0].id,i),data,screen.id,i);if(image){previews.push(image);bytes+=image.dataUrl.length;}}}return previews;}
const validRect=(input:unknown):input is Rect=>!!input&&typeof input==='object'&&['x','y','width','height'].every(key=>typeof (input as Record<string,unknown>)[key]==='number'&&Number.isFinite((input as Record<string,number>)[key]))&&(input as Rect).width>0&&(input as Rect).height>0;
export async function loadPreview(path:string,data:CapturePackage,screenId=data.screens[0].id,segment=1):Promise<SourcePreview|undefined>{
  try{
    const metadataPath=`${path}.preview.json`,imagePath=`${path}.preview.png`;
    if((await stat(metadataPath)).size>16384||(await stat(imagePath)).size>MAX_BYTES)return;
    const metadata=JSON.parse(await readFile(metadataPath,'utf8')) as PreviewMetadata;
    if((metadata.segmentIndex??1)!==segment||(metadata.segmentCount!==undefined&&(!Number.isInteger(metadata.segmentCount)||metadata.segmentCount<1||metadata.segmentCount>12||segment>metadata.segmentCount))||(metadata.referenceMode!==undefined&&!['segments','sampled'].includes(metadata.referenceMode)))return;
    const screen=data.screens.find(screen=>screen.id===screenId);if(!screen)return;
    const root=screen.nodes.find(node=>node.id===screen.rootNodeId)!;
    if(metadata.packageId!==data.packageId||metadata.revision!==data.revision||metadata.screenId!==screen.id||!validRect(metadata.frameRect)||!validRect(metadata.documentRect)||!validRect(metadata.requestedRect)||typeof metadata.partial!=='boolean'||Math.abs(metadata.frameRect.width-root.rect.width)>.01||Math.abs(metadata.frameRect.height-root.rect.height)>.01)return;
    const bytes=await readFile(imagePath);if(bytes.length>MAX_BYTES||digest(bytes)!==metadata.sha256)return;
    const header=inspectImage(bytes);if(header.mime!=='image/png'||header.width>2048||header.height>2048||header.width!==metadata.pixelWidth||header.height!==metadata.pixelHeight)return;
    const image=nativeImage.createFromBuffer(bytes);const size=image.getSize();
    if(image.isEmpty()||size.width!==metadata.pixelWidth||size.height!==metadata.pixelHeight||Math.max(size.width,size.height)>2048)return;
    return {dataUrl:`data:image/png;base64,${bytes.toString('base64')}`,metadata};
  }catch{return;}
}
