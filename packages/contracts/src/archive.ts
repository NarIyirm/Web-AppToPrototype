import {parseCapturePackage,type CapturePackage} from './index';
import {decodeBase64,LIMITS} from './resources';
import {encodeUtf8,decodeUtf8,encodeBase64} from './encoding';
const MAX=64*1024*1024,encoder={encode:encodeUtf8},decoder={decode:decodeUtf8};
const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);table[i]=c>>>0;}
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const b64=encodeBase64;
export function zipFiles(files:Array<{name:string;bytes:Uint8Array}>,compress?:(bytes:Uint8Array)=>Uint8Array):Uint8Array{
  if(files.length>5001)throw Error('E_LIMIT_EXCEEDED: ZIP entries');
  const names=new Set<string>(),locals:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
  for(const file of files){if(!/^[a-zA-Z0-9_./-]+$/.test(file.name)||file.name.split('/').some(p=>p==='..'||!p)||names.has(file.name))throw Error('E_ZIP_INVALID: path');names.add(file.name);const name=encoder.encode(file.name),crc=crc32(file.bytes);
    const compressed=compress?.(file.bytes),use=compressed&&compressed.length<file.bytes.length,packed=use?compressed:file.bytes,method=use?8:0;
    const local=new Uint8Array(30+name.length+packed.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(8,method,true);l.setUint32(14,crc,true);l.setUint32(18,packed.length,true);l.setUint32(22,file.bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);local.set(packed,30+name.length);
    const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(10,method,true);d.setUint32(16,crc,true);d.setUint32(20,packed.length,true);d.setUint32(24,file.bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);locals.push(local);central.push(c);offset+=local.length;
  }
  const centralSize=central.reduce((n,c)=>n+c.length,0),out=new Uint8Array(offset+centralSize+22);if(out.length>MAX)throw Error('E_LIMIT_EXCEEDED: ZIP bytes');let i=0;for(const c of [...locals,...central]){out.set(c,i);i+=c.length;}const end=new DataView(out.buffer,i,22);end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,centralSize,true);end.setUint32(16,offset,true);return out;
}
export async function unzipFiles(bytes:Uint8Array,inflate?:(bytes:Uint8Array,limit:number)=>Promise<Uint8Array>){
  if(bytes.length>MAX||bytes.length<22)throw Error('E_ZIP_INVALID: bytes');const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(d.getUint32(i,true)===0x06054b50&&i+22+d.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0||d.getUint16(end+4,true)||d.getUint16(end+6,true)||d.getUint16(end+8,true)!==d.getUint16(end+10,true))throw Error('E_ZIP_INVALID: end');
  const count=d.getUint16(end+10,true),start=d.getUint32(end+16,true);if(count>5001||start+d.getUint32(end+12,true)!==end)throw Error('E_ZIP_INVALID: directory');const result=new Map<string,Uint8Array>();let pos=start,total=0;const ranges:Array<[number,number]>=[];
  for(let i=0;i<count;i++){
    if(pos+46>end||d.getUint32(pos,true)!==0x02014b50)throw Error('E_ZIP_INVALID: header');const flags=d.getUint16(pos+8,true),method=d.getUint16(pos+10,true),size=d.getUint32(pos+24,true),packed=d.getUint32(pos+20,true),n=d.getUint16(pos+28,true),extra=d.getUint16(pos+30,true),comment=d.getUint16(pos+32,true),local=d.getUint32(pos+42,true);total+=size;
    if(total>MAX||size>LIMITS.jsonBytes||flags&1||![0,8].includes(method)||d.getUint16(pos+34,true)||((d.getUint32(pos+38,true)>>>16)&0xf000)===0xa000||pos+46+n+extra+comment>end)throw Error('E_ZIP_INVALID: unsupported/budget');
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+n));if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.startsWith('/')||name.split('/').some(p=>p==='..'||p==='.'||!p)||result.has(name))throw Error('E_ZIP_INVALID: path');
    if(local+30>start||d.getUint32(local,true)!==0x04034b50||d.getUint16(local+8,true)!==method||d.getUint16(local+6,true)!==flags)throw Error('E_ZIP_INVALID: local header');const ln=d.getUint16(local+26,true),le=d.getUint16(local+28,true),content=local+30+ln+le,finish=content+packed;
    if(finish>start||decoder.decode(bytes.subarray(local+30,local+30+ln))!==name||ranges.some(([a,b])=>local<b&&finish>a))throw Error('E_ZIP_INVALID: overlapping entries');ranges.push([local,finish]);
    const compressed=bytes.subarray(content,finish),decoded=method===0?compressed:inflate?await inflate(compressed,size):(()=>{throw Error('E_ZIP_INVALID: deflate unavailable');})();
    if(decoded.length!==size||crc32(decoded)!==d.getUint32(pos+16,true))throw Error('E_ZIP_INVALID: checksum');result.set(name,decoded);pos+=46+n+extra+comment;
  }
  if(pos!==end)throw Error('E_ZIP_INVALID: directory length');return result;
}
export function encodeCaptureZip(input:CapturePackage,compress?:(bytes:Uint8Array)=>Uint8Array){const data=JSON.parse(JSON.stringify(parseCapturePackage(input))) as CapturePackage,files:Array<{name:string;bytes:Uint8Array}>=[],seen=new Set<string>();for(const asset of data.assets){const path=`assets/${asset.sha256}.${asset.mime==='image/png'?'png':'jpg'}`;if(!seen.has(path)){files.push({name:path,bytes:decodeBase64(asset.inlineBase64!)});seen.add(path);}asset.path=path;delete asset.inlineBase64;}files.unshift({name:'capture.json',bytes:encoder.encode(JSON.stringify(data))});return zipFiles(files,compress);}
export async function decodeCaptureZip(bytes:Uint8Array,inflate?:(bytes:Uint8Array,limit:number)=>Promise<Uint8Array>){const files=await unzipFiles(bytes,inflate),manifest=files.get('capture.json');if(!manifest)throw Error('E_ZIP_INVALID: capture.json missing');const data=JSON.parse(decoder.decode(manifest)) as CapturePackage;if(!Array.isArray(data.assets))throw Error('E_ZIP_INVALID: assets');const used=new Set(['capture.json']);for(const asset of data.assets){if(!asset.path||asset.inlineBase64||!files.has(asset.path))throw Error('E_ZIP_INVALID: resource');used.add(asset.path);asset.inlineBase64=b64(files.get(asset.path)!);delete asset.path;}if(files.size!==used.size)throw Error('E_ZIP_INVALID: unknown entry');return parseCapturePackage(data);}
