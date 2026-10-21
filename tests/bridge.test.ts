import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {LocalBridge} from '../apps/desktop/src/bridge';
import type {BridgeTarget,BridgeJob,ImportReport} from '../packages/contracts/src/bridge';
import type {CapturePackage} from '../packages/contracts/src/index';
const selected:BridgeTarget={bindingId:'synthetic-plugin',documentName:'Synthetic file',pageId:'0:1',pageName:'Page 1'};
async function data(){const input=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8')) as CapturePackage;input.artifactKind='capture';input.packageId=`synthetic-${randomUUID()}`;return input;}
async function setup(now?:()=>number){const path=resolve('.runtime/unit-bridge',randomUUID(),'journal.json');const bridge=new LocalBridge(path,()=>{},now);await bridge.init();const code=await bridge.pairCode();const session=await bridge.pair(code.code,selected);return {bridge,path,code,auth:`Bearer ${session.sessionToken}`};}
function syntheticReport(job:BridgeJob):ImportReport{return {reportKind:'actual_import',inputKind:'capture',importId:job.importId,packageId:job.packageId,revision:job.revision,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),status:'succeeded',targetPageId:job.target.pageId,rootNodeIds:['synthetic-root'],nodeMap:Array.from({length:job.total},(_,i)=>({screenId:'synthetic',sceneNodeId:`scene-${i}`,figmaNodeId:`synthetic-${i}`})),counts:{nodes:job.total,screens:2,images:0,interactions:2},warnings:[],errors:[],versions:{plugin:'synthetic-test',schema:'1.0.0'}};}
test('pairing is single-use, time-limited, rate-limited and bearer-authenticated',async()=>{
  let now=1000;const {bridge,code}=await setup(()=>now);
  await assert.rejects(bridge.pair(code.code,selected),/E_PAIRING_EXPIRED/);
  await assert.rejects(bridge.claim('Bearer wrong'),/E_SESSION_EXPIRED/);
  const next=await bridge.pairCode();now+=5*60_000+1;await assert.rejects(bridge.pair(next.code,selected),/E_PAIRING_EXPIRED/);
  for(let i=0;i<4;i++)await assert.rejects(bridge.pair('wrong',selected));await assert.rejects(bridge.pair('wrong',selected),/E_PAIR_RATE_LIMIT/);
});
test('target page changes suspend delivery and do not silently rebind queued jobs',async()=>{
  const {bridge,auth}=await setup();const input=await data();await bridge.enqueue(input);
  await bridge.heartbeat(auth,{...selected,pageId:'0:2'});assert.equal(bridge.snapshot().connected,false);
  await assert.rejects(bridge.claim(auth),/E_TARGET_CHANGED/);await assert.rejects(bridge.enqueue(await data()),/E_BRIDGE_UNREACHABLE/);
  await bridge.heartbeat(auth,selected);const delivery=await bridge.claim(auth);assert.equal(delivery?.job.target.pageId,'0:1');
});
test('enqueue and claim retries reuse the same immutable job and importId',async()=>{
  const {bridge,auth}=await setup();const input=await data();const first=await bridge.enqueue(input);const repeated=await bridge.enqueue(input);
  assert.equal(repeated.id,first.id);assert.equal(bridge.snapshot().jobs.length,1);
  const changed=structuredClone(input);changed.source.title='different';await assert.rejects(bridge.enqueue(changed),/E_PACKAGE_CONFLICT/);
  const a=await bridge.claim(auth),b=await bridge.claim(auth);assert.equal(a?.job.importId,b?.job.importId);
  for(let i=0;i<4;i++)await bridge.enqueue(await data());await assert.rejects(bridge.enqueue(await data()),/E_JOB_QUEUE_FULL/);assert.equal((await bridge.claim(auth))?.job.id,first.id);
});
test('progress is monotonic and result acknowledgements are idempotent',async()=>{
  const {bridge,auth}=await setup();const job=await bridge.enqueue(await data());await bridge.claim(auth);
  await bridge.progress(auth,{jobId:job.id,importId:job.importId,completed:2,total:job.total});
  await assert.rejects(bridge.progress(auth,{jobId:job.id,importId:job.importId,completed:1,total:job.total}),/E_PROGRESS_INVALID/);
  const report=syntheticReport(job);await assert.rejects(bridge.result(auth,{jobId:job.id,importId:job.importId,report:{...report,targetPageId:'wrong'}}),/E_REPORT_INVALID/);
  await bridge.result(auth,{jobId:job.id,importId:job.importId,report});assert.equal(bridge.snapshot().jobs[0].status,'succeeded');
  assert.equal((await bridge.result(auth,{jobId:job.id,importId:job.importId,report})).replayed,true);
  await assert.rejects(bridge.result(auth,{jobId:job.id,importId:job.importId,error:'different'}),/E_RESULT_CONFLICT/);
});
test('heartbeat loss interrupts without re-creation but accepts the original late receipt',async()=>{
  let now=1000;const {bridge,auth}=await setup(()=>now);const input=await data();const job=await bridge.enqueue(input);await bridge.claim(auth);
  now+=9000;await bridge.tick();assert.equal(bridge.snapshot().connected,false);assert.equal(bridge.snapshot().jobs[0].status,'interrupted');
  await bridge.heartbeat(auth,selected);assert.equal(await bridge.claim(auth),null);
  const repeated=await bridge.enqueue(input);assert.equal(repeated.id,job.id);assert.equal(repeated.status,'interrupted');
  await bridge.result(auth,{jobId:job.id,importId:job.importId,report:syntheticReport(job)});assert.equal(bridge.snapshot().jobs[0].status,'succeeded');
});
test('restarted desktop retains uncertainty and never persists the pairing code or token',async()=>{
  const {bridge,path,auth,code}=await setup();const input=await data();await bridge.enqueue(input);await bridge.claim(auth);
  const text=await readFile(path,'utf8');assert.ok(!text.includes(code.code));assert.ok(!text.includes(auth.slice(7)));
  const restarted=new LocalBridge(path);await restarted.init();assert.equal(restarted.snapshot().jobs[0].status,'interrupted');
  const pair=await restarted.pairCode();await restarted.pair(pair.code,{...selected,bindingId:'new-plugin'});
  await assert.rejects(restarted.enqueue(input),/E_IMPORT_INTERRUPTED/);
});
test('corrupt journal disables bridge pairing while preserving a readable fallback state',async()=>{
  const folder=resolve('.runtime/unit-bridge',randomUUID());await mkdir(folder,{recursive:true});const path=resolve(folder,'journal.json');await writeFile(path,'broken');
  const bridge=new LocalBridge(path);await bridge.init();assert.equal(bridge.snapshot().connected,false);await assert.rejects(bridge.pairCode(),/E_BRIDGE_JOURNAL_INVALID/);
});
test('HTTP control plane rejects arbitrary origins, non-JSON writes and unauthenticated claims',async()=>{
  const {bridge}=await setup();const server=createServer((req,res)=>void bridge.handle(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try{
    const post=(headers:Record<string,string>)=>fetch(url+'/v1/jobs/claim',{method:'POST',headers,body:'{}'});
    assert.equal((await post({'Content-Type':'application/json',Origin:'https://untrusted.example'})).status,403);
    assert.equal((await post({'Content-Type':'text/plain',Origin:'null'})).status,415);
    assert.equal((await post({'Content-Type':'application/json',Origin:'null'})).status,401);
    const preflight=await fetch(url+'/v1/jobs/claim',{method:'OPTIONS',headers:{Origin:'null','Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'null');
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('chunked transfer: authenticated bounded chunks reassemble the immutable job and stop at target changes',async()=>{
 const {bridge,auth}=await setup(),input=await data();const text=input.screens[0].nodes.find(n=>n.text)!.text!;text.characters='界'.repeat(100000);text.runs=[];const job=await bridge.enqueue(input),manifest=await bridge.manifest(auth);assert.ok(manifest);assert.equal(manifest.job.importId,job.importId);assert.ok(manifest.job.leaseExpiresAt);
 const chunks:Buffer[]=[];for(let i=0;i<manifest.transfer.chunks;i++){const p=await bridge.chunk(auth,{jobId:job.id,importId:job.importId,index:i});const bytes=Buffer.from(p.base64,'base64');chunks.push(bytes);assert.ok(bytes.length<=262144);}
 assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString('utf8')),input);await assert.rejects(bridge.chunk('Bearer wrong',{jobId:job.id,importId:job.importId,index:0}),/SESSION/);await assert.rejects(bridge.chunk(auth,{jobId:job.id,importId:job.importId,index:-1}),/CHUNK/);
 await bridge.heartbeat(auth,{...selected,pageId:'other'});await assert.rejects(bridge.chunk(auth,{jobId:job.id,importId:job.importId,index:0}),/TRANSFER/);
});


test('queue is bounded FIFO and a completed receipt releases the next immutable job',async()=>{
 const {bridge,auth}=await setup(),first=await bridge.enqueue(await data()),second=await bridge.enqueue(await data());assert.equal((await bridge.claim(auth))!.job.id,first.id);await bridge.result(auth,{jobId:first.id,importId:first.importId,report:syntheticReport(first)});assert.equal((await bridge.claim(auth))!.job.id,second.id);
});

test('receipt acknowledgement retries the atomic journal write after a real filesystem failure',async()=>{
 const {dirname,sep}=await import('node:path'),fs=await import('node:fs/promises'),{bridge,auth,path}=await setup(),job=await bridge.enqueue(await data());await bridge.claim(auth);const dir=dirname(path),moved=dir+'.moved';assert.ok(dir.startsWith(resolve('.runtime')+sep)&&moved.startsWith(resolve('.runtime')+sep));await fs.rename(dir,moved);await fs.writeFile(dir,'synthetic filesystem collision');const receipt={jobId:job.id,importId:job.importId,report:syntheticReport(job)};
 try{await assert.rejects(bridge.result(auth,receipt));assert.match(bridge.snapshot().reason,/STORAGE/);}finally{await fs.rm(dir);await fs.rename(moved,dir);}
 assert.equal((await bridge.result(auth,receipt)).replayed,true);assert.equal(JSON.parse(await fs.readFile(path,'utf8')).at(-1).status,'succeeded');assert.equal(bridge.snapshot().connected,true);
});
