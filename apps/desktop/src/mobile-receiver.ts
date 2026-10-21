import {createServer,type Server} from 'node:https';
import {networkInterfaces,hostname} from 'node:os';
import {createHash,randomBytes,X509Certificate,timingSafeEqual} from 'node:crypto';
import {mkdir,open,readFile,readdir,rename,rm,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {generate} from 'selfsigned';
import {toDataURL} from 'qrcode';
import {readMobileBundle} from '../../../packages/mobile-contracts/0.1.0-alpha.1/src/core/mobile-bundle';
import {EncryptedLanServer,mobileRequest,mobileReply,type MobileRequest,type MobileReply} from './mobile-secure';

const MAX=64*1024*1024,CHUNK=256*1024,hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const same=(a:string,b:string)=>timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
export function privateIPv4(value:string){const p=value.split('.').map(Number);return p.length===4&&p.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=255&&String(n)===value.split('.')[i])&&(p[0]===10||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31);}
type Upload={sha:string;bytes:number;packageId:string;offset:number;busy:boolean;committed:boolean};
type Session={token:string;deviceId:string;deviceName:string;expires:number};
export class MobileReceiver {
 private server?:Server;private code='';private codeExpires=0;private pairing=false;private session?:Session;
 private uploads=new Map<string,Upload>();private attempts=0;private attemptWindow=0;private pin='';private addresses:string[]=[];
 private creating=false;
 private encrypted?:EncryptedLanServer;
 constructor(private folder:string,private confirm:(name:string)=>Promise<boolean>,private now=Date.now){}
 async start(testAddress?:string){
  if(this.server)throw Error('M_RECEIVER_ALREADY_OPEN');
  this.addresses=testAddress?[testAddress]:[...new Set(Object.values(networkInterfaces()).flatMap(list=>(list??[]).filter(n=>!n.internal&&n.family==='IPv4'&&privateIPv4(n.address)).map(n=>n.address)))];
  const networkName=(ip:string)=>Object.entries(networkInterfaces()).find(([,list])=>list?.some(item=>item.address===ip))?.[0]??'本地网络';
  const rank=(ip:string)=>/virtual|vmware|vbox|docker|vethernet|tailscale|wsl|vpn/i.test(networkName(ip))?3:/wi-?fi|wlan|wireless|无线/i.test(networkName(ip))?0:/ethernet|以太网|^en0$/i.test(networkName(ip))?1:2;
  this.addresses.sort((a,b)=>rank(a)-rank(b));
  if(!this.addresses.length)throw Error('未找到局域网 IPv4 地址，请连接与手机相同的网络。');
  await mkdir(this.folder,{recursive:true});
  // Orphaned partials from an earlier desktop session cannot resume without reauthorization.
  for(const name of await readdir(this.folder))if(/^[a-f0-9]{64}\.part$/.test(name))await rm(join(this.folder,name),{force:true});
  const pems=await generate([{name:'commonName',value:'WebToPrototype Desktop'}],{keyType:'ec',curve:'P-256',algorithm:'sha256',notBeforeDate:new Date(this.now()-60_000),notAfterDate:new Date(this.now()+24*60*60_000),extensions:[{name:'basicConstraints',cA:false},{name:'keyUsage',digitalSignature:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:this.addresses.map(ip=>({type:7,ip}))}]});
  this.pin=hash(new X509Certificate(pems.cert).raw);this.code=randomBytes(32).toString('hex');this.codeExpires=this.now()+120_000;
  const server=createServer({key:pems.private,cert:pems.cert,minVersion:'TLSv1.2',maxHeaderSize:8192},(req,res)=>{void this.handle(mobileRequest(req),mobileReply(res));});
  server.maxConnections=8;server.requestTimeout=20_000;server.headersTimeout=10_000;server.keepAliveTimeout=3000;
  this.server=server;
  try{await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,testAddress??'0.0.0.0',()=>{server.off('error',reject);resolve();});});}
  catch(error){this.server=undefined;throw error;}
  const address=server.address();if(!address||typeof address==='string')throw Error('M_RECEIVER_ADDRESS');
  this.encrypted=new EncryptedLanServer(randomBytes(32).toString('hex'),randomBytes(16).toString('hex'),ip=>privateIPv4(ip)||ip==='127.0.0.1',(req,res)=>this.handle(req,res));
  let encryptedPort:number;
  try{encryptedPort=await this.encrypted.start(testAddress??'0.0.0.0');}catch(error){await this.stop();throw error;}
  const offers=await Promise.all(this.addresses.map(async ip=>{
   const offer={protocol:'w2p-mobile-2',endpoint:`https://${ip}:${address.port}`,certificateSha256:this.pin,code:this.code,expiresAt:this.codeExpires,desktopName:hostname().slice(0,80),
    lan:{endpoint:`http://${ip}:${encryptedPort}`,key:this.encrypted!.key,id:this.encrypted!.id}};
   return {address:ip,label:`${networkName(ip)} · ${ip}`,payload:JSON.stringify(offer),qr:await toDataURL(JSON.stringify(offer),{width:320,margin:2,errorCorrectionLevel:'M'})};
  }));
  return {offers,expiresAt:this.codeExpires};
 }
 async stop(){const server=this.server;this.server=undefined;this.code='';this.session=undefined;this.uploads.clear();const encrypted=this.encrypted;this.encrypted=undefined;await encrypted?.stop();if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}}
 status(){const session=this.session&&this.now()<this.session.expires?this.session:undefined;return {active:!!this.server,connected:!!session,deviceName:session?.deviceName,expiresAt:session?.expires};}
 async list(){
  await mkdir(this.folder,{recursive:true});const rows=[];
  for(const name of await readdir(this.folder)){if(!/^[a-f0-9]{64}\.w2pm\.zip$/.test(name))continue;const info=await stat(join(this.folder,name));rows.push({id:name.slice(0,64),bytes:info.size,at:info.mtimeMs});}
  return rows.sort((a,b)=>b.at-a.at);
 }
 async path(id:unknown){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('M_INBOX_ID');const path=join(this.folder,`${id}.w2pm.zip`);if((await stat(path)).size>MAX)throw Error('M_LIMIT_EXCEEDED');if(await this.fileHash(path)!==id)throw Error('M_DIGEST_MISMATCH');return path;}
 async remove(id:unknown){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw Error('M_INBOX_ID');if(this.uploads.get(id)?.busy)throw Error('M_UPLOAD_BUSY');await rm(join(this.folder,`${id}.w2pm.zip`),{force:true});this.uploads.delete(id);}
 private async fileHash(path:string){const digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);return digest.digest('hex');}
 private async body(req:MobileRequest,max:number){return req.readBody(max);}
 private json(res:MobileReply,status:number,value:unknown){res.json(status,value);}
 private async handle(req:MobileRequest,res:MobileReply){
  try{
   const remote=req.remoteAddress;
   if(req.headers.origin||(!privateIPv4(remote)&&remote!=='127.0.0.1'))return this.json(res,403,{error:'M_ORIGIN'});
   if(!req.url?.startsWith('/mobile/'))return this.json(res,404,{error:'M_ROUTE'});
   if(req.method==='POST'&&req.url==='/mobile/pair'){
    if(req.headers['content-type']!=='application/json')return this.json(res,415,{error:'M_JSON_REQUIRED'});
    if(this.now()-this.attemptWindow>60_000){this.attemptWindow=this.now();this.attempts=0;}
    if(++this.attempts>8||this.pairing)return this.json(res,429,{error:'M_PAIR_RATE'});
    const value=JSON.parse((await this.body(req,4096)).toString('utf8'));
    if(!this.code||this.now()>this.codeExpires||typeof value.code!=='string'||!same(value.code,this.code))return this.json(res,401,{error:'M_PAIR_EXPIRED'});
    if(typeof value.deviceId!=='string'||!/^d-[a-z0-9-]{7,100}$/.test(value.deviceId)||typeof value.deviceName!=='string'||value.deviceName.length>80)return this.json(res,400,{error:'M_DEVICE'});
    this.pairing=true;const pairingCode=this.code;
    try{
     if(!await this.confirm(value.deviceName.replace(/[\x00-\x1f]/g,'')))return this.json(res,403,{error:'M_PAIR_REJECTED'});
     if(!this.server||this.now()>this.codeExpires||!same(this.code,pairingCode))return this.json(res,401,{error:'M_PAIR_EXPIRED'});
     this.code='';this.session={token:randomBytes(32).toString('hex'),deviceId:value.deviceId,deviceName:value.deviceName.replace(/[\x00-\x1f]/g,''),expires:this.now()+15*60_000};
     return this.json(res,200,{sessionToken:this.session.token,expiresAt:this.session.expires,chunkBytes:CHUNK});
    }finally{this.pairing=false;}
   }
   const bearer=req.headers.authorization??'';
   if(!this.session||this.now()>this.session.expires||!same(bearer,`Bearer ${this.session.token}`))return this.json(res,401,{error:'M_SESSION_REQUIRED'});
   if(req.method==='GET'&&req.url==='/mobile/session')return this.json(res,200,{connected:true,expiresAt:this.session.expires});
   if(req.method==='POST'&&req.url==='/mobile/disconnect'){this.session=undefined;return this.json(res,200,{disconnected:true});}
   if(req.method==='POST'&&req.url==='/mobile/uploads'){
    if(this.creating)return this.json(res,409,{error:'M_UPLOAD_BUSY'});
    this.creating=true;
    try{
    if(req.headers['content-type']!=='application/json')return this.json(res,415,{error:'M_JSON_REQUIRED'});
    const value=JSON.parse((await this.body(req,4096)).toString('utf8'));
    if(!/^[a-f0-9]{64}$/.test(value.sha256)||!/^b-[a-z0-9-]{7,100}$/.test(value.packageId)||!Number.isInteger(value.bytes)||value.bytes<1||value.bytes>MAX)return this.json(res,400,{error:'M_UPLOAD_META'});
    const existing=this.uploads.get(value.sha256);if(existing){if(existing.bytes!==value.bytes||existing.packageId!==value.packageId)throw Error('M_UPLOAD_CONFLICT');return this.json(res,200,this.receipt(existing));}
    if(this.uploads.size>=5||[...this.uploads.values()].reduce((sum,u)=>sum+u.bytes,0)+value.bytes>128*1024*1024)throw Error('M_UPLOAD_BUDGET');
    const stored=await this.list();if(stored.length>=20||stored.reduce((sum,u)=>sum+u.bytes,0)+value.bytes>256*1024*1024)throw Error('M_INBOX_FULL');
    let committed=false;try{await this.path(value.sha256);committed=true;}catch{/* New upload or corrupt old file must be verified anew. */}
    if(!committed)await writeFile(join(this.folder,`${value.sha256}.part`),new Uint8Array(),{flag:'wx'});
    const upload={sha:value.sha256,bytes:value.bytes,packageId:value.packageId,offset:committed?value.bytes:0,busy:false,committed};this.uploads.set(upload.sha,upload);
    return this.json(res,200,this.receipt(upload));
    }finally{this.creating=false;}
   }
   const match=req.url.match(/^\/mobile\/uploads\/([a-f0-9]{64})(?:\/(\d+|commit))?$/),upload=match?this.uploads.get(match[1]):undefined;
   if(!match||!upload)return this.json(res,404,{error:'M_UPLOAD_UNKNOWN'});
   if(req.method==='GET'&&!match[2])return this.json(res,200,this.receipt(upload));
   if(upload.busy)return this.json(res,409,{error:'M_UPLOAD_BUSY'});
   upload.busy=true;
   try{
    if(req.method==='PUT'&&match[2]&&match[2]!=='commit'){
     if(req.headers['content-type']!=='application/octet-stream')return this.json(res,415,{error:'M_BINARY_REQUIRED'});
     const offset=Number(match[2]),bytes=await this.body(req,CHUNK);
     if(!bytes.length||offset+bytes.length>upload.bytes||offset>upload.offset||upload.committed)throw Error('M_UPLOAD_OFFSET');
     const file=await open(join(this.folder,`${upload.sha}.part`),'r+');
     try{
      if(offset<upload.offset){if(offset+bytes.length>upload.offset)throw Error('M_UPLOAD_OFFSET');const saved=Buffer.alloc(bytes.length);await file.read(saved,0,saved.length,offset);if(!same(hash(saved),hash(bytes)))throw Error('M_UPLOAD_CONFLICT');}
      else{let written=0;while(written<bytes.length){const result=await file.write(bytes,written,bytes.length-written,offset+written);if(!result.bytesWritten)throw Error('M_UPLOAD_WRITE');written+=result.bytesWritten;}await file.sync();upload.offset+=bytes.length;}
     }finally{await file.close();}
     return this.json(res,200,this.receipt(upload));
    }
    if(req.method==='POST'&&match[2]==='commit'){
     if(upload.committed)return this.json(res,200,this.receipt(upload));
     if(upload.offset!==upload.bytes)throw Error('M_UPLOAD_INCOMPLETE');
     const partial=join(this.folder,`${upload.sha}.part`);
     if(await this.fileHash(partial)!==upload.sha)throw Error('M_DIGEST_MISMATCH');
     const material=await readMobileBundle(await readFile(partial),async bytes=>hash(bytes));
     if(material.meta.packageId!==upload.packageId)throw Error('M_PACKAGE_ID');
     await rename(partial,join(this.folder,`${upload.sha}.w2pm.zip`));upload.committed=true;
     return this.json(res,200,this.receipt(upload));
    }
    return this.json(res,405,{error:'M_METHOD'});
   }finally{upload.busy=false;}
  }catch(error){if(!res.headersSent)this.json(res,400,{error:error instanceof Error&&/^M_[A-Z_]+/.test(error.message)?error.message.split(':')[0]:'M_REQUEST_INVALID'});else res.destroy();}
 }
 private receipt(upload:Upload){return {uploadId:upload.sha,nextOffset:upload.offset,bytes:upload.bytes,status:upload.committed?'received':'receiving',converted:false,figmaImported:false};}
}
