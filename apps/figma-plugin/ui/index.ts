import {sameTarget,type BridgeTarget,type BridgeDelivery,type BridgeResult,type ImportReport,type BridgeManifest} from '../../../packages/contracts/src/bridge';
import {decodeCaptureZip} from '../../../packages/contracts/src/archive';
import {decodeBase64,sha256,LIMITS} from '../../../packages/contracts/src/resources';
import {decodeUtf8} from '../../../packages/contracts/src/encoding';
const BASE='http://localhost:43821';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const send=(type:string,data?:unknown,allowExample?:boolean)=>parent.postMessage({pluginMessage:{type,data,allowExample}},'*');
const status=(text:string)=>{$('status').textContent=text;};
let context:BridgeTarget|undefined,session:{token:string;target:BridgeTarget}|undefined;
let busy=false,pairing=false,inFlight:BridgeDelivery|undefined,pending:BridgeResult|undefined;
let progress:{completed:number;total:number}|undefined,lastReport:ImportReport|null=null;
let timer:ReturnType<typeof setTimeout>|undefined,epoch=0;
class RequestError extends Error {constructor(public status:number,message:string){super(message);}}
async function request(path:string,data:unknown,token?:string){
  const control=new AbortController();const timeout=setTimeout(()=>control.abort(),10000);
  try{const response=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data),signal:control.signal});const result=await response.json();if(!response.ok)throw new RequestError(response.status,result.error??`HTTP ${response.status}`);return result;}
  finally{clearTimeout(timeout);}
}
function buttons(){
  $<HTMLButtonElement>('connect').disabled=!context||pairing||!!session||busy;
  $<HTMLButtonElement>('disconnect').disabled=!session;
  $<HTMLInputElement>('pair-code').disabled=pairing||!!session;
  for(const id of ['probe','file','cleanup'])$<HTMLButtonElement>(id).disabled=busy;
}
function showTarget(){const target=session?.target??context;$('bridge-target').textContent=target?`${target.documentName} / ${target.pageName}`:'正在读取当前文件与页面…';}
function stop(){epoch++;if(timer)clearTimeout(timer);session=undefined;progress=undefined;pending=undefined;inFlight=undefined;send('bridge-stop');buttons();showTarget();}
async function cycle(run:number){
  if(run!==epoch||!session||!context)return;
  const active=session;let delay=1000;
  try{
    const heartbeat=await request('/v1/heartbeat',{target:context},active.token);
    if(run!==epoch)return;
    if(!sameTarget(active.target,context)){$('bridge-state').textContent='当前页面与接收页面不同，请返回或重新配对。';if(inFlight)send('bridge-stop');}
    else $('bridge-state').textContent=pending?'正在回传导入结果…':'已连接，等待桌面发送。';
    if(pending){await request('/v1/jobs/result',pending,active.token);if(run!==epoch)return;pending=undefined;$('bridge-state').textContent='结果已回传，可继续发送下一次采集。';}
    if(progress&&inFlight){const latest=progress;progress=undefined;await request('/v1/jobs/progress',{jobId:inFlight.job.id,importId:inFlight.job.importId,...latest},active.token);}
    if(!busy&&!inFlight&&!pending&&heartbeat.connected&&sameTarget(active.target,context)){
      const {delivery:manifest}=await request('/v1/jobs/claim',{chunked:true},active.token) as {delivery:BridgeManifest|null};
      if(run!==epoch)return;
      if(manifest){const t=manifest.transfer;if(!t||!Number.isInteger(t.byteLength)||t.byteLength<1||t.byteLength>LIMITS.jsonBytes||t.chunkSize!==262144||t.chunks!==Math.ceil(t.byteLength/t.chunkSize))throw Error('传输清单无效');const bytes=new Uint8Array(t.byteLength),started=Date.now();
        for(let i=0;i<t.chunks;i++){if(run!==epoch)return;if(Date.now()-started>90000)throw Error('传输超时');const part=await request('/v1/jobs/chunk',{jobId:manifest.job.id,importId:manifest.job.importId,index:i},active.token);const decoded=decodeBase64(part.base64);if(part.index!==i||sha256(decoded)!==part.sha256||decoded.length!==Math.min(t.chunkSize,t.byteLength-i*t.chunkSize))throw Error('传输校验失败');bytes.set(decoded,i*t.chunkSize);if(i%3===0)await request('/v1/heartbeat',{target:context},active.token);if(run!==epoch)return;$('bridge-state').textContent=`接收转换包 ${i+1}/${t.chunks}…`;}
        if(sha256(bytes)!==t.sha256||t.sha256!==manifest.job.packageSha256)throw Error('转换包摘要不一致');const delivery:BridgeDelivery={job:manifest.job,data:JSON.parse(decodeUtf8(bytes))};inFlight=delivery;busy=true;buttons();$('bridge-state').textContent='正在导入桌面发送的内容…';send('bridge-import',delivery);}
    }
  }catch(error){
    if(run!==epoch)return;
    if(error instanceof RequestError&&error.status===401){stop();$('bridge-state').textContent='连接已失效，请重新配对。';return;}
    // Retain pending receipts during transient network failures; never re-import.
    $('bridge-state').textContent='本机连接暂时中断，正在重试；已完成的图层不会因此重新创建。';delay=3000;
  }
  if(run===epoch&&session)timer=setTimeout(()=>void cycle(run),delay);
}
$('connect').onclick=()=>void(async()=>{
  if(!context||pairing||session)return;pairing=true;buttons();$('bridge-state').textContent='正在配对…';
  try{const result=await request('/v1/pair',{code:$<HTMLInputElement>('pair-code').value.trim(),target:context});session={token:result.sessionToken,target:result.target};$<HTMLInputElement>('pair-code').value='';showTarget();epoch++;void cycle(epoch);}
  catch(error){$('bridge-state').textContent=error instanceof Error?error.message:'配对失败';}
  finally{pairing=false;buttons();}
})();
$('disconnect').onclick=()=>void(async()=>{const active=session;stop();$('bridge-state').textContent='已断开，可继续使用文件导入。';if(active)try{await request('/v1/disconnect',{},active.token);}catch{/* desktop will detect the expired heartbeat */}})();
$('probe').onclick=()=>{busy=true;buttons();send('probe');};
$('cancel').onclick=()=>send('cancel');$('cleanup').onclick=()=>send('cleanup');$('report').onclick=()=>send('get-report');
$('file').onchange=event=>void(async()=>{
  const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;
  if(file.size>64*1024*1024){status('文件超过64MiB');input.value='';return;}
  try{busy=true;buttons();const data=file.name.toLowerCase().endsWith('.zip')?await decodeCaptureZip(new Uint8Array(await file.arrayBuffer()),async(bytes,limit)=>{const stream=new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw')),reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw Error('ZIP解压超限');}chunks.push(part.value);}}finally{reader.releaseLock();}const result=new Uint8Array(size);let i=0;for(const c of chunks){result.set(c,i);i+=c.length;}return result;}):JSON.parse(await file.text());send('import',data,$<HTMLInputElement>('allow').checked);}catch(e){busy=false;buttons();status('文件未导入：'+String(e));}finally{input.value='';}
})();
$('health').onclick=()=>void(async()=>{try{const response=await fetch(BASE+'/v1/health',{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error();status('本机服务可达；配对后可接收桌面任务。');}catch{status('本机服务不可达，文件导入仍可使用。');}})();
$('download').onclick=()=>{if(!lastReport)return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${lastReport.importId}.report.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.onmessage=event=>{
  // Figma desktop can relay these messages; a strict WindowProxy identity check
  // rejects valid host messages in some versions. Payloads are validated by main.
  const msg=event.data?.pluginMessage;if(!msg||typeof msg.type!=='string')return;
  if(msg.type==='bridge-context'){context=msg.data;showTarget();buttons();}
  if(msg.type==='busy'){busy=!!msg.data;buttons();if(busy){lastReport=null;$<HTMLButtonElement>('download').disabled=true;$('output').textContent='';status('预检数据、图片与字体…');}}
  if(msg.type==='progress'){status(`创建图层 ${msg.data.completed} / ${msg.data.total}`);if(inFlight)progress=msg.data;}
  if(msg.type==='error')status('导入未完成：'+msg.data);
  if(msg.type==='info')status(msg.data);
  if(msg.type==='report'){lastReport=msg.data;$<HTMLButtonElement>('download').disabled=!lastReport;$('output').textContent=JSON.stringify(msg.data,null,2);status(lastReport?`导入完成：${lastReport.counts.nodes} 图层，${lastReport.warnings.length} 告警。`:'尚无导入报告。');}
  if(msg.type==='bridge-result'&&inFlight&&msg.data.jobId===inFlight.job.id&&msg.data.importId===inFlight.job.importId){pending=msg.data;inFlight=undefined;progress=undefined;}
};
send('bridge-context');buttons();
// Context may not be available until the host finishes initializing.
setInterval(()=>send('bridge-context'),3000);
