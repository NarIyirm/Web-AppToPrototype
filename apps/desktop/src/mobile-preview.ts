import {nativeImage} from 'electron';
import {createHash} from 'node:crypto';
import type {importMobileBundle} from './mobile-import';
import type {SourcePreview} from './capture-data';

/** References are separate from editable output and never become extra design layers. */
export function makeMobilePreviews(imported:Awaited<ReturnType<typeof importMobileBundle>>):SourcePreview[]{
 const {data,bundle}=imported;let total=0;
 return data.screens.map((screen,index)=>{
  const capture=bundle.state.captures[index],bytes=bundle.files.get(`assets/${capture.assetId}.png`)!;
  let image=nativeImage.createFromBuffer(Buffer.from(bytes));
  if(image.isEmpty())throw Error('M_ASSET_INVALID: 无法解码手机参考图');
  const size=image.getSize(),scale=Math.min(1,2048/Math.max(size.width,size.height));
  if(scale<1)image=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'best'});
  const png=image.toPNG(),pixels=image.getSize();total+=png.length;
  if(total>32*1024*1024)throw Error('M_LIMIT_EXCEEDED: 参考图超过32MiB');
  const rect={x:0,y:0,width:capture.logicalWidth,height:capture.logicalHeight};
  return {dataUrl:`data:image/png;base64,${png.toString('base64')}`,metadata:{packageId:data.packageId,revision:data.revision,screenId:screen.id,capturedAt:capture.createdAt,frameRect:rect,requestedRect:rect,documentRect:rect,partial:false,pixelWidth:pixels.width,pixelHeight:pixels.height,sha256:createHash('sha256').update(png).digest('hex')}};
 });
}
