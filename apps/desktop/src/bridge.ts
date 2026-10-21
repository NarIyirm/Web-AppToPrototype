import {randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {parseCapturePackage,type CapturePackage} from '../../../packages/contracts/src/index';
import {sameTarget,type BridgeTarget,type BridgeJob,type BridgeState,type BridgeDelivery,type BridgeResult,type BridgeManifest} from '../../../packages/contracts/src/bridge';
const ACTIVE=new Set(['queued','importing']);
export class BridgeError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new BridgeError(status,message);};
function target(input:unknown):BridgeTarget {
  if(!input||typeof input!=='object')return fail(400,'E_TARGET_INVALID');
  const data=input as Record<string,unknown>;
  for(const key of ['bindingId','documentName','pageId','pageName'])if(typeof data[key]!=='string'||!(data[key] as string).length||(data[key] as string).length>256)return fail(400,'E_TARGET_INVALID');
  return {bindingId:data.bindingId as string,documentName:data.documentName as string,pageId:data.pageId as string,pageName:data.pageName as string};
}
export class LocalBridge {
  private secret?:{code:string;expiresAt:number};
  private session?:{token:string;target:BridgeTarget;current:BridgeTarget;lastSeen:number};
  private jobs:BridgeJob[]=[];
  private payloads=new Map<string,CapturePackage>();
  private encoded=new Map<string,Buffer>();
  private bytes(id:string){if(this.encoded.has(id))return this.encoded.get(id)!;const data=this.payloads.get(id);if(!data)return fail(409,'E_IMPORT_INTERRUPTED');const bytes=Buffer.from(JSON.stringify(data));this.encoded.set(id,bytes);return bytes;}
  private releasePayload(id:string){this.payloads.delete(id);this.encoded.delete(id);}
  private failures:number[]=[];
  private writes=Promise.resolve();
  private storageError='';
  constructor(private journal:string,private changed:()=>void=()=>{},private now:()=>number=Date.now){}
  async init(){
    try{if((await stat(this.journal)).size>32*1024*1024)throw Error('journal budget');const saved=JSON.parse(await readFile(this.journal,'utf8'));if(!Array.isArray(saved)||saved.some((j:BridgeJob)=>!j||typeof j.id!=='string'||typeof j.packageId!=='string'||typeof j.importId!=='string'||!j.target||typeof j.target.pageId!=='string'))throw Error('invalid journal');this.jobs=saved.slice(-20).map((j:BridgeJob)=>ACTIVE.has(j.status)?{...j,status:'interrupted',message:'应用已重启，旧任务不自动重新导入。'}:j);}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')this.storageError='E_BRIDGE_JOURNAL_INVALID: 无法读取直连记录；文件转换仍可使用';}
  }
  private async persist(){
    for(const job of this.jobs.slice(0,-3))delete job.report;
    const body=JSON.stringify(this.jobs,null,2);
    const write=this.writes.catch(()=>{}).then(async()=>{await mkdir(dirname(this.journal),{recursive:true});await writeFile(`${this.journal}.tmp`,body);await rename(`${this.journal}.tmp`,this.journal);});
    this.writes=write;try{await write;if(this.storageError.startsWith('E_BRIDGE_STORAGE'))this.storageError='';}catch(error){this.storageError='E_BRIDGE_STORAGE: 任务记录未落盘，请保留文件并重试';throw error;}this.changed();
  }
  async pairCode(){if(this.storageError)return fail(503,this.storageError);await this.disconnect('已重新生成配对码，旧连接已断开。');this.secret={code:randomBytes(18).toString('base64url'),expiresAt:this.now()+5*60_000};return {...this.secret};}
  private async stopJobs(message:string){for(const job of this.jobs)if(ACTIVE.has(job.status)){job.status=job.status==='queued'?'cancelled':'interrupted';job.message=message;job.updatedAt=new Date(this.now()).toISOString();this.releasePayload(job.id);}await this.persist();}
  async disconnect(message='已主动断开；未确认任务不会自动重新导入。'){this.session=undefined;this.secret=undefined;await this.stopJobs(message);}
  async tick(){if(this.session&&this.now()-this.session.lastSeen>8000){let changed=false;for(const job of this.jobs)if(ACTIVE.has(job.status)){job.status=job.status==='queued'?'cancelled':'interrupted';job.message='插件连接中断，先核对 Figma 结果；不自动重新创建。';job.updatedAt=new Date(this.now()).toISOString();this.releasePayload(job.id);changed=true;}if(changed)await this.persist();}}
  snapshot():BridgeState{
    const session=this.session;const recent=!!session&&this.now()-session.lastSeen<=8000;const matches=!!session&&sameTarget(session.target,session.current);
    return {connected:!this.storageError&&recent&&matches,paired:!!session,target:session?.target,reason:this.storageError||(!session?'未连接，请生成配对码并在 Figma 插件中连接。':!recent?'连接已中断，请保持插件运行。':!matches?'Figma 页面已切换，请回到配对页面或重新配对。':'已连接'),jobs:this.jobs.slice(-10).map(({report,...job})=>structuredClone(job))};
  }
  lastReport(){const job=[...this.jobs].reverse().find(job=>job.report);return job?.report?structuredClone(job.report):null;}
  async pair(code:unknown,input:unknown){
    this.failures=this.failures.filter(at=>this.now()-at<60_000);if(this.failures.length>=5)return fail(429,'E_PAIR_RATE_LIMIT: 请稍后重试');
    const supplied=typeof code==='string'?Buffer.from(code):Buffer.alloc(0);const expected=Buffer.from(this.secret?.code??'');
    if(!this.secret||this.now()>this.secret.expiresAt||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)){this.failures.push(this.now());return fail(403,'E_PAIRING_EXPIRED: 配对码无效或已过期');}
    const selected=target(input);const token=randomBytes(32).toString('base64url');this.secret=undefined;
    this.session={token,target:selected,current:selected,lastSeen:this.now()};this.changed();return {sessionToken:token,target:selected,protocol:'1.0.0'};
  }
  private auth(value:string|undefined){
    const supplied=Buffer.from(value?.startsWith('Bearer ')?value.slice(7):'');const expected=Buffer.from(this.session?.token??'');
    if(!this.session||this.now()-this.session.lastSeen>30*60_000||supplied.length!==expected.length||!expected.length||!timingSafeEqual(supplied,expected))return fail(401,'E_SESSION_EXPIRED: 请重新配对');
    return this.session;
  }
  async enqueue(input:unknown):Promise<BridgeJob>{
    await this.tick();const snapshot=this.snapshot();if(!snapshot.connected||!this.session)return fail(409,'E_BRIDGE_UNREACHABLE: '+snapshot.reason);
    const data=parseCapturePackage(input);const selected=this.session.target;
    const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existing=this.jobs.find(j=>j.packageId===data.packageId&&j.revision===data.revision&&sameTarget(j.target,selected));
    if(existing){if(existing.packageSha256!==fingerprint)return fail(409,'E_PACKAGE_CONFLICT: 相同包版本的内容发生变化');return structuredClone(existing);}
    if(this.jobs.some(j=>j.packageId===data.packageId&&j.revision===data.revision&&j.status==='interrupted'))return fail(409,'E_IMPORT_INTERRUPTED: 请先核对旧任务的 Figma 结果；不会自动重新创建');
    if(this.jobs.filter(j=>ACTIVE.has(j.status)).length>=5)return fail(409,'E_JOB_QUEUE_FULL: 最多5个等待或导入任务');
    if([...this.payloads.keys()].reduce((n,id)=>n+this.bytes(id).length,0)+Buffer.byteLength(JSON.stringify(data))>100*1024*1024)return fail(413,'E_LIMIT_EXCEEDED: 待发送包合计超过100MiB');
    const at=new Date(this.now()).toISOString();const job:BridgeJob={id:randomUUID(),importId:`bridge-${randomUUID()}`,packageId:data.packageId,revision:data.revision,packageSha256:fingerprint,target:{...selected},status:'queued',createdAt:at,updatedAt:at,completed:0,total:data.screens.reduce((sum,s)=>sum+s.nodes.length,0),message:'等待插件接收'};
    this.jobs.push(job);while(this.jobs.length>20){this.releasePayload(this.jobs[0].id);this.jobs.shift();}this.payloads.set(job.id,structuredClone(data));await this.persist();return structuredClone(job);
  }
  async heartbeat(authorization:string|undefined,current:unknown){const session=this.auth(authorization);await this.tick();session.current=target(current);session.lastSeen=this.now();for(const job of this.jobs)if(job.status==='importing'&&sameTarget(job.target,session.current))job.leaseExpiresAt=new Date(this.now()+30000).toISOString();this.changed();return this.snapshot();}
  async claim(authorization:string|undefined):Promise<BridgeDelivery|null>{
    const session=this.auth(authorization);await this.tick();if(!sameTarget(session.target,session.current))return fail(409,'E_TARGET_CHANGED');session.lastSeen=this.now();
    const job=this.jobs.find(j=>ACTIVE.has(j.status)&&sameTarget(j.target,session.target));if(!job)return null;
    const data=this.payloads.get(job.id);if(!data)return fail(409,'E_IMPORT_INTERRUPTED');
    job.status='importing';job.message='插件正在导入';job.updatedAt=new Date(this.now()).toISOString();job.leaseExpiresAt=new Date(this.now()+30000).toISOString();await this.persist();return {job:structuredClone(job),data:structuredClone(data)};
  }
  async manifest(authorization:string|undefined):Promise<BridgeManifest|null>{const delivery=await this.claim(authorization);if(!delivery)return null;const bytes=this.bytes(delivery.job.id);return {job:delivery.job,transfer:{byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),chunkSize:262144,chunks:Math.ceil(bytes.length/262144)}};}
  async chunk(authorization:string|undefined,input:Record<string,unknown>){const job=this.owned(authorization,input.jobId,input.importId),session=this.auth(authorization);if(!sameTarget(session.current,job.target)||job.status!=='importing'||!job.leaseExpiresAt||Date.parse(job.leaseExpiresAt)<this.now())return fail(409,'E_TRANSFER_EXPIRED');const bytes=this.bytes(job.id),index=input.index;if(!Number.isInteger(index)||(index as number)<0||(index as number)>=Math.ceil(bytes.length/262144))return fail(400,'E_CHUNK_INVALID');const part=bytes.subarray((index as number)*262144,((index as number)+1)*262144);return {index,base64:part.toString('base64'),sha256:createHash('sha256').update(part).digest('hex')};}
  private owned(authorization:string|undefined,id:unknown,importId:unknown){const session=this.auth(authorization);const job=this.jobs.find(j=>j.id===id&&j.importId===importId&&sameTarget(j.target,session.target));if(!job)return fail(404,'E_JOB_NOT_FOUND');session.lastSeen=this.now();return job;}
  async progress(authorization:string|undefined,input:Record<string,unknown>){const job=this.owned(authorization,input.jobId,input.importId);if(job.status!=='importing')return {accepted:false};
    if(!Number.isInteger(input.completed)||!Number.isInteger(input.total)||input.total!==job.total||(input.completed as number)<job.completed||(input.completed as number)>job.total)return fail(400,'E_PROGRESS_INVALID');
    job.completed=input.completed as number;job.message=`创建图层 ${job.completed} / ${job.total}`;job.updatedAt=new Date(this.now()).toISOString();this.changed();return {accepted:true};}
  async result(authorization:string|undefined,input:BridgeResult){
    const job=this.owned(authorization,input.jobId,input.importId);
    if(['succeeded','failed','cancelled'].includes(job.status)){if((input.report&&job.report&&JSON.stringify(input.report)===JSON.stringify(job.report))||(!input.report&&!job.report&&input.error===job.message)){await this.persist();return {accepted:true,replayed:true};}return fail(409,'E_RESULT_CONFLICT');}
    if(input.report){const report=input.report;
      if(report.reportKind!=='actual_import'||report.inputKind!=='capture'||report.importId!==job.importId||report.packageId!==job.packageId||report.revision!==job.revision||report.targetPageId!==job.target.pageId||!['succeeded','succeeded_with_warnings'].includes(report.status)||!Array.isArray(report.rootNodeIds)||report.rootNodeIds.length>20||!report.rootNodeIds.every(id=>typeof id==='string')||report.counts?.nodes!==job.total||!Array.isArray(report.warnings)||!Array.isArray(report.nodeMap)||report.nodeMap.length!==job.total)return fail(400,'E_REPORT_INVALID');
      job.report=report;job.status='succeeded';job.completed=job.total;job.message=`导入完成：${job.total} 图层，${report.warnings.length} 告警`;
    }else{if(typeof input.error!=='string'||!input.error||input.error.length>1000)return fail(400,'E_REPORT_INVALID');job.status=input.error.includes('E_CANCELLED')?'cancelled':'failed';job.message=input.error;}
    job.updatedAt=new Date(this.now()).toISOString();this.releasePayload(job.id);await this.persist();return {accepted:true};
  }
  async handle(request:IncomingMessage,response:ServerResponse){
    const reply=(status:number,value:unknown)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(value));};
    try{
      if(request.headers.origin&&request.headers.origin!=='null')return fail(403,'E_ORIGIN_DENIED');
      if(request.headers.origin==='null')response.setHeader('Access-Control-Allow-Origin','null');
      response.setHeader('Vary','Origin');response.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');response.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
      if(request.headers['access-control-request-private-network']==='true')response.setHeader('Access-Control-Allow-Private-Network','true');
      if(request.method==='OPTIONS'){response.writeHead(204);response.end();return;}
      if(request.method!=='POST')return fail(405,'E_METHOD_NOT_ALLOWED');
      if(!request.headers['content-type']?.startsWith('application/json'))return fail(415,'E_JSON_REQUIRED');
      let size=0;const chunks:Buffer[]=[];for await(const chunk of request){size+=chunk.length;if(size>2*1024*1024)return fail(413,'E_LIMIT_EXCEEDED: request bytes');chunks.push(chunk);}
      let input:Record<string,unknown>;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input||Array.isArray(input)||typeof input!=='object')throw Error();}catch{return fail(400,'E_JSON_INVALID');}
      const auth=request.headers.authorization;
      switch(request.url){
        case '/v1/pair':reply(200,await this.pair(input.code,input.target));break;
        case '/v1/heartbeat':reply(200,await this.heartbeat(auth,input.target));break;
        case '/v1/jobs/claim':reply(200,{delivery:input.chunked===true?await this.manifest(auth):await this.claim(auth)});break;
        case '/v1/jobs/chunk':reply(200,await this.chunk(auth,input));break;
        case '/v1/jobs/progress':reply(200,await this.progress(auth,input));break;
        case '/v1/jobs/result':reply(200,await this.result(auth,input as unknown as BridgeResult));break;
        case '/v1/disconnect':this.auth(auth);await this.disconnect();reply(200,{ok:true});break;
        default:return fail(404,'E_NOT_FOUND');
      }
    }catch(error){if(!response.headersSent)reply(error instanceof BridgeError?error.status:503,{error:error instanceof BridgeError?error.message:'E_BRIDGE_STORAGE: 本地任务记录暂不可用'});else response.end();}
  }
}
