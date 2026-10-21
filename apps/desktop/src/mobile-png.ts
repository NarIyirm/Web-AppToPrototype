import { deflateSync, inflateSync } from 'node:zlib';
import { crc32 } from '../../../packages/contracts/src/archive';
import { inspectImage } from '../../../packages/contracts/src/resources';

export interface Pixels { width:number; height:number; rgba:Uint8Array }
const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function decodeMobilePng(bytes:Uint8Array):Pixels|undefined{
 const info=inspectImage(bytes);if(info.mime!=='image/png')throw Error('M_ASSET_INVALID: expected PNG');
 if(info.width>4096||info.height>4096)throw Error('M_LIMIT_EXCEEDED: image dimensions');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),depth=bytes[24],color=bytes[25];
 if(depth!==8||bytes[28]!==0||![0,2,4,6].includes(color))return;
 const channels=({0:1,2:3,4:2,6:4} as Record<number,number>)[color],stride=info.width*channels;
 const compressed:Uint8Array[]=[];let position=8;
 while(position+12<=bytes.length){const size=d.getUint32(position),kind=String.fromCharCode(...bytes.subarray(position+4,position+8));if(kind==='IDAT')compressed.push(bytes.subarray(position+8,position+8+size));position+=size+12;}
 const expected=(stride+1)*info.height,raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:expected});
 if(raw.length!==expected)throw Error('M_ASSET_INVALID: PNG decoded length');
 const scan=new Uint8Array(stride*info.height),rgba=new Uint8Array(info.width*info.height*4);
 for(let y=0;y<info.height;y++){
  const filter=raw[y*(stride+1)];if(filter>4)throw Error('M_ASSET_INVALID: PNG filter');
  for(let x=0;x<stride;x++){const left=x>=channels?scan[y*stride+x-channels]:0,up=y?scan[(y-1)*stride+x]:0,corner=y&&x>=channels?scan[(y-1)*stride+x-channels]:0;
   scan[y*stride+x]=(raw[y*(stride+1)+1+x]+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,corner)))&255;}
  for(let x=0;x<info.width;x++){const from=y*stride+x*channels,to=(y*info.width+x)*4;rgba[to]=scan[from];rgba[to+1]=channels<=2?scan[from]:scan[from+1];rgba[to+2]=channels<=2?scan[from]:scan[from+2];rgba[to+3]=color===4?scan[from+1]:color===6?scan[from+3]:255;}
 }
 return {...info,rgba};
}
export function encodeMobilePng(image:Pixels):Uint8Array{
 const raw=new Uint8Array((image.width*4+1)*image.height);
 for(let y=0;y<image.height;y++)raw.set(image.rgba.subarray(y*image.width*4,(y+1)*image.width*4),y*(image.width*4+1)+1);
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,image.width);view.setUint32(4,image.height);header[8]=8;header[9]=6;
 const chunks=[Buffer.from([137,80,78,71,13,10,26,10])];
 for(const [type,data] of [['IHDR',header],['IDAT',deflateSync(raw,{level:6})],['IEND',new Uint8Array()]] as const){const name=Buffer.from(type),chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);name.copy(chunk,4);chunk.set(data,8);chunk.writeUInt32BE(crc32(chunk.subarray(4,8+data.length)),8+data.length);chunks.push(chunk);}
 return new Uint8Array(Buffer.concat(chunks));
}
export function cropMobilePixels(image:Pixels,r:{x:number;y:number;width:number;height:number}):Pixels{
 const x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y)),right=Math.min(image.width,Math.ceil(r.x+r.width)),bottom=Math.min(image.height,Math.ceil(r.y+r.height));
 if(right<=x||bottom<=y)throw Error('M_ASSET_INVALID: empty image crop');
 const width=right-x,height=bottom-y,rgba=new Uint8Array(width*height*4);
 for(let row=0;row<height;row++)rgba.set(image.rgba.subarray(((y+row)*image.width+x)*4,((y+row)*image.width+right)*4),row*width*4);
 return {width,height,rgba};
}
export function sampleTextInk(image:Pixels,bounds:{x:number;y:number;width:number;height:number}):{r:number;g:number;b:number;a:number}{
 const left=Math.max(0,Math.floor(bounds.x)),top=Math.max(0,Math.floor(bounds.y)),right=Math.min(image.width,Math.ceil(bounds.x+bounds.width)),bottom=Math.min(image.height,Math.ceil(bounds.y+bounds.height));
 const at=(Math.max(0,top-3)*image.width+Math.max(0,left-3))*4,base=image.rgba.subarray(at,at+3),groups=new Map<string,{count:number;r:number;g:number;b:number}>();
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const p=(y*image.width+x)*4,r=image.rgba[p],g=image.rgba[p+1],b=image.rgba[p+2];if(image.rgba[p+3]<250||Math.max(Math.abs(r-base[0]),Math.abs(g-base[1]),Math.abs(b-base[2]))<35)continue;
  const key=`${r>>4},${g>>4},${b>>4}`,v=groups.get(key)??{count:0,r:0,g:0,b:0};v.count++;v.r+=r;v.g+=g;v.b+=b;groups.set(key,v);}
 const ink=[...groups.values()].sort((a,b)=>b.count-a.count)[0];return ink?{r:ink.r/ink.count/255,g:ink.g/ink.count/255,b:ink.b/ink.count/255,a:1}:{r:0,g:0,b:0,a:1};
}
/** JPEG/antialiasing can perturb a flat background. Require a dominant opaque
 * ring and a mostly two-tone interior, rather than 99% exact perimeter pixels
 * and 70% empty glyph boxes (which rejects ordinary dense Chinese text). */
export function clearReliableText(image:Pixels,bounds:{x:number;y:number;width:number;height:number}):boolean{
 const left=Math.floor(bounds.x)-2,top=Math.floor(bounds.y)-2,right=Math.ceil(bounds.x+bounds.width)+2,bottom=Math.ceil(bounds.y+bounds.height)+2;
 if(left<1||top<1||right>=image.width-1||bottom>=image.height-1||right<=left||bottom<=top)return false;
 const sample=(x:number,y:number)=>Array.from(image.rgba.subarray((y*image.width+x)*4,(y*image.width+x)*4+4));
 const ring:number[][]=[];
 const check=(x:number,y:number)=>ring.push(sample(x,y));
 for(let x=left-1;x<=right;x++){check(x,top-1);check(x,bottom);}
 for(let y=top;y<bottom;y++){check(left-1,y);check(right,y);}
 const candidates=new Map<string,number[][]>();
 for(const pixel of ring){if(pixel[3]<250)continue;const key=pixel.slice(0,3).map(v=>Math.round(v/16)).join(',');const list=candidates.get(key)??[];list.push(pixel);candidates.set(key,list);}
 const common=[...candidates.values()].sort((a,b)=>b.length-a.length)[0];if(!common)return false;
 const base=[0,1,2].map(i=>Math.round(common.reduce((sum,p)=>sum+p[i],0)/common.length));base.push(255);
 const distance=(pixel:number[])=>Math.max(...pixel.slice(0,3).map((v,i)=>Math.abs(v-base[i])));
 if(ring.filter(p=>p[3]>=250&&distance(p)<=14).length/ring.length<0.9)return false;
 // A plain ring alone can surround a photo or control. Require a dominant plain
 // background inside the OCR box as well, otherwise keep the original pixels.
 let plain=0,inside=0;const ink:number[][]=[];
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const pixel=sample(x,y);if(pixel[3]<250)return false;inside++;if(distance(pixel)<=14)plain++;else ink.push(pixel);
 }
 if(plain/inside<0.3)return false;
 // Text antialiasing lies on the line between one ink color and its background.
 // Multi-coloured/photographic interiors must not be erased just because OCR
 // reported a word there. Use the most distant ink sample as the endpoint.
 const furthest=ink.reduce((best,pixel)=>Math.max(best,distance(pixel)),0),inkGroups=new Map<string,{sum:number[];count:number}>();
 for(const pixel of ink){if(distance(pixel)<furthest*.7)continue;const key=pixel.slice(0,3).map(v=>Math.round(v/16)).join(',');const value=inkGroups.get(key)??{sum:[0,0,0],count:0};value.count++;for(let i=0;i<3;i++)value.sum[i]+=pixel[i];inkGroups.set(key,value);}
 const commonInk=[...inkGroups.values()].sort((a,b)=>b.count-a.count)[0];
 const foreground=commonInk?commonInk.sum.map(v=>v/commonInk.count):undefined;
 if(foreground){const delta=foreground.slice(0,3).map((v,i)=>v-base[i]),length=delta.reduce((s,v)=>s+v*v,0);
  const textLike=ink.filter(pixel=>{const t=Math.max(0,Math.min(1,pixel.slice(0,3).reduce((s,v,i)=>s+(v-base[i])*delta[i],0)/length));return pixel.slice(0,3).every((v,i)=>Math.abs(v-(base[i]+delta[i]*t))<=30);}).length;
  if(textLike/ink.length<0.9)return false;
 }
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)image.rgba.set(base,(y*image.width+x)*4);
 return true;
}
