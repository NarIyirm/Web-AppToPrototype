import {BrowserWindow} from 'electron';
import {LIMITS} from '../../../packages/contracts/src/resources';
/** Preflight dimensions before asking a sandboxed Chromium decoder to handle
 * WebP/GIF. Normalized output stays PNG, so old Figma packages remain readable. */
export function extraRasterHeader(bytes:Uint8Array):{mime:string;width:number;height:number;animated:boolean}|null{
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(a:number,b:number)=>String.fromCharCode(...bytes.subarray(a,b));let width=0,height=0,animated=false,mime='';
 if(bytes.length>=10&&/^GIF8[79]a$/.test(ascii(0,6))){mime='image/gif';width=d.getUint16(6,true);height=d.getUint16(8,true);animated=true;}
 else if(bytes.length>=30&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){
   mime='image/webp';const type=ascii(12,16);if(d.getUint32(4,true)+8!==bytes.length)throw Error('WebP length');
   if(type==='VP8X'){width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;animated=!!(bytes[20]&2);}
   else if(type==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=d.getUint16(26,true)&0x3fff;height=d.getUint16(28,true)&0x3fff;}
   else if(type==='VP8L'&&bytes[20]===0x2f){const bits=d.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}else throw Error('WebP header');
 }else return null;
 if(!width||!height||width>LIMITS.dimension||height>LIMITS.dimension)throw Error('图片尺寸超过4096px');return {mime,width,height,animated};
}
export async function normalizeExtraRaster(bytes:Uint8Array,signal?:AbortSignal):Promise<{bytes:Uint8Array;animated:boolean}|null>{
 const meta=extraRasterHeader(bytes);if(!meta)return null;if(signal?.aborted)throw Error('E_CANCELLED');
 const view=new BrowserWindow({show:false,width:10,height:10,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});view.webContents.setWindowOpenHandler(()=>({action:'deny'}));view.webContents.on('will-navigate',e=>e.preventDefault());const close=()=>{if(!view.isDestroyed())view.destroy();};signal?.addEventListener('abort',close,{once:true});const timeout=setTimeout(close,8000);
 try{await view.loadURL('data:text/html,'+encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:">'));
   const dataUrl=`data:${meta.mime};base64,${Buffer.from(bytes).toString('base64')}`;
   const result=await view.webContents.executeJavaScriptInIsolatedWorld(1001,[{code:`(async()=>{const image=new Image();image.src=${JSON.stringify(dataUrl)};await image.decode();if(image.naturalWidth!==${meta.width}||image.naturalHeight!==${meta.height})throw Error('decoded dimensions');const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);return c.toDataURL('image/png').slice(22);})()`}]);const output=Buffer.from(result,'base64');if(output.length>LIMITS.assetBytes)throw Error('PNG输出超限');return {bytes:output,animated:meta.animated};
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',close);close();}
}
