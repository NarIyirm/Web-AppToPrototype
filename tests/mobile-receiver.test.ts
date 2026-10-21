import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:https';
import {connect,checkServerIdentity} from 'node:tls';
import {createHash,X509Certificate,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {MobileReceiver,privateIPv4} from '../apps/desktop/src/mobile-receiver';
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
async function trustedCertificate(endpoint:string,pin:string){
 const url=new URL(endpoint);
 return new Promise<string>((resolve,reject)=>{
  // Test bootstrap reads the public certificate before sending any HTTP data.
  const socket=connect({host:url.hostname,port:Number(url.port),rejectUnauthorized:false},()=>{
   const cert=socket.getPeerCertificate();socket.end();
   if(hash(cert.raw)!==pin)return reject(Error('M_CERT_PIN'));
   const error=checkServerIdentity(url.hostname,cert);if(error)return reject(error);
   resolve(new X509Certificate(cert.raw).toString());
  });socket.on('error',reject);
 });
}
function call(endpoint:string,ca:string,pin:string,path:string,method='GET',token='',body:Uint8Array|string='',origin?:string){
 return new Promise<{status:number;body:any}>((resolve,reject)=>{
  const req=request(endpoint+path,{method,ca,checkServerIdentity:(host,cert)=>hash(cert.raw)!==pin?Error('M_CERT_PIN'):checkServerIdentity(host,cert),headers:{...(token?{authorization:`Bearer ${token}`}:{ }),...(method==='GET'?{}:{'content-type':method==='PUT'?'application/octet-stream':'application/json'}),...origin?{origin}:{}}},res=>{
   const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
  });req.on('error',reject);req.end(body);
 });
}
test('mobile receiver: private-address classifier excludes public and ambiguous hosts',()=>{
 for(const ip of ['10.0.0.2','192.168.1.1','172.16.0.1','172.31.255.254'])assert.ok(privateIPv4(ip));
 for(const ip of ['8.8.8.8','127.0.0.1','192.168.001.1','172.32.0.1','192.168.1.999','host.local'])assert.equal(privateIPv4(ip),false);
});
test('mobile receiver: TLS pin, one-time pair, resumable chunk SHA, durable inbox and truthful receipt',async()=>{
 const folder=resolve('.runtime/mobile-receiver',randomUUID());let confirmations=0;
 const receiver=new MobileReceiver(folder,async()=>{confirmations++;return true;});
 try{
  const {offers}=await receiver.start('127.0.0.1'),offer=JSON.parse(offers[0].payload),ca=await trustedCertificate(offer.endpoint,offer.certificateSha256);
  await assert.rejects(trustedCertificate(offer.endpoint,'0'.repeat(64)),/PIN/);
  const api=(path:string,method='GET',token='',body:Uint8Array|string='',origin?:string)=>call(offer.endpoint,ca,offer.certificateSha256,path,method,token,body,origin);
  assert.equal((await api('/mobile/uploads')).status,401);
  const pairing=JSON.stringify({code:offer.code,deviceId:'d-device0001',deviceName:'测试手机'});
  assert.equal((await api('/mobile/pair','POST','',pairing,'https://example.com')).status,403);
  const session=await api('/mobile/pair','POST','',pairing);assert.equal(session.status,200);assert.equal(confirmations,1);
  assert.equal((await api('/mobile/pair','POST','',pairing)).status,401);
  const token=session.body.sessionToken,bytes=await readFile('examples/mobile-material.w2pm.zip'),sha=hash(bytes);
  const packageId='b-05492ef9-ccb7-41b9-9455-49bfcc5741ab';
  const meta=JSON.stringify({sha256:sha,bytes:bytes.length,packageId});
  assert.equal((await api('/mobile/uploads','POST',token,meta)).body.nextOffset,0);
  const half=Math.floor(bytes.length/2),path=`/mobile/uploads/${sha}`;
  assert.equal((await api(`${path}/0`,'PUT',token,bytes.subarray(0,half))).body.nextOffset,half);
  assert.equal((await api(`${path}/0`,'PUT',token,bytes.subarray(0,half))).body.nextOffset,half);
  const corrupt=Buffer.from(bytes.subarray(0,half));corrupt[0]^=1;
  assert.equal((await api(`${path}/0`,'PUT',token,corrupt)).status,400);
  assert.equal((await api(path,'GET',token)).body.nextOffset,half);
  assert.equal((await api(`${path}/commit`,'POST',token,'{}')).status,400);
  assert.equal((await api(`${path}/${half}`,'PUT',token,bytes.subarray(half))).body.nextOffset,bytes.length);
  const done=await api(`${path}/commit`,'POST',token,'{}');assert.equal(done.body.status,'received');assert.equal(done.body.converted,false);assert.equal(done.body.figmaImported,false);
  assert.equal((await api(`${path}/commit`,'POST',token,'{}')).body.status,'received');
  assert.equal((await receiver.list()).length,1);assert.deepEqual(await readFile(await receiver.path(sha)),bytes);
  await assert.rejects(receiver.path('../outside'));
  await receiver.stop();const restarted=new MobileReceiver(folder,async()=>true);
  assert.equal((await restarted.list()).length,1);assert.deepEqual(await readFile(await restarted.path(sha)),bytes);
 }finally{await receiver.stop();}
});
