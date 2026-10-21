import {execFile} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import type {TextObservation} from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/project';
export function remapOcr(lines:TextObservation[],from:{width:number;height:number},to:{width:number;height:number}):TextObservation[]{
 return lines.map(line=>{const x=Math.max(0,Math.min(to.width,line.bounds.x*to.width/from.width)),y=Math.max(0,Math.min(to.height,line.bounds.y*to.height/from.height));
  return {...line,bounds:{x,y,width:Math.max(0,Math.min(to.width,(line.bounds.x+line.bounds.width)*to.width/from.width)-x),height:Math.max(0,Math.min(to.height,(line.bounds.y+line.bounds.height)*to.height/from.height)-y)}};
 }).filter(line=>line.bounds.width>0&&line.bounds.height>0);
}
export function parseDesktopOcr(raw:string,width:number,height:number):TextObservation[]{
 if(raw.length>2*1024*1024)throw Error('识别结果超过预算。');
 const value=JSON.parse(raw.replace(/^\uFEFF/,''));
 if(value?.width!==width||value?.height!==height||!Array.isArray(value.observations)||value.observations.length>500)throw Error('文字识别尺寸或数量不正确。');
 let units=0;
 return value.observations.map((v:unknown):TextObservation=>{const line=v as TextObservation,r=line?.bounds;
  if(typeof line?.text!=='string'||line.text.length>10000||!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>width+1||r.y+r.height>height+1||line.provenance!=='ocr'||(line.confidence!==null&&(!Number.isFinite(line.confidence)||line.confidence<0||line.confidence>1)))throw Error('文字识别坐标不正确。');
  units+=line.text.length;if(units>100000)throw Error('文字识别内容超过预算。');
  return {text:line.text,bounds:{x:r.x,y:r.y,width:r.width,height:r.height},confidence:line.confidence,provenance:'ocr'};
 });
}
/** Uses installed OS OCR only; a missing engine retains the original image. */
export async function recognizeDesktopImage(bytes:Uint8Array,width:number,height:number,signal?:AbortSignal):Promise<TextObservation[]>{
 if(!['win32','darwin'].includes(process.platform))throw Error('此电脑暂未启用离线文字识别。');
 const folder=await mkdtemp(join(tmpdir(),'w2p-ocr-'));
 try{
  const path=join(folder,'capture.png');await writeFile(path,bytes);
  const command=process.platform==='win32'?join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'):'/usr/bin/osascript';
  const args=process.platform==='win32'?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(__dirname,'ocr','windows.ps1'),'-ImagePath',path]:['-l','JavaScript',join(__dirname,'ocr','macos.js'),path];
  const raw=await new Promise<string>((resolve,reject)=>execFile(command,args,{windowsHide:true,timeout:45000,maxBuffer:2*1024*1024,encoding:'utf8',signal},(error,stdout)=>error?reject(Error('电脑离线文字识别暂不可用，画面已保留为图片。')):resolve(stdout)));
  return parseDesktopOcr(raw,width,height);
 }finally{if(dirname(folder)===resolve(tmpdir())&&basename(folder).startsWith('w2p-ocr-'))await rm(folder,{recursive:true,force:true});}
}
