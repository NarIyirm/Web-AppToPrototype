import {build} from 'esbuild';
import {deflateRawSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {_electron as electron} from 'playwright';
import {waitForShell} from './electron-shell.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const stamp=new Date().toISOString().replace(/[.:]/g,'-');const folder=resolve('evidence/2026-10-19/M3-bridge',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/bridge-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
let application,hostServer;let hostPage;const imports=[],fileImports=[],checks=[];let chunkRequests=0;let stderr='';
const check=(name,ok)=>{checks.push({check:name,ok:!!ok});if(!ok)throw Error(name);};
const fakeTarget={bindingId:`synthetic-host-${randomUUID()}`,documentName:'Synthetic Figma host',pageId:'0:1',pageName:'Bridge acceptance'};
let currentTarget={...fakeTarget};let ackLost=false;const receipts=new Map();
try{
  application=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000});application.process().stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);});
  const shell=await waitForShell(application);await shell.waitForFunction(()=>document.querySelector('#url')?.value.includes('/fixture'));
  const waitBridge=async(predicate,timeout=25000)=>{const until=Date.now()+timeout;while(Date.now()<until){const state=await shell.evaluate(()=>window.w2p.bridgeStatus());if(predicate(state))return state;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('bridge state timed out: '+JSON.stringify(await shell.evaluate(()=>window.w2p.bridgeStatus())));};
  const target=application.windows().find(page=>page.url().includes('/fixture'));if(!target)throw Error('target missing');await target.waitForSelector('#orders');await target.locator('#orders img').evaluate(img=>img.decode());
  const info=await shell.evaluate(()=>window.w2p.info());const endpoint=info.bridgeEndpoint;
  const ui=(await readFile('apps/figma-plugin/dist/ui.html','utf8')).replaceAll('http://localhost:43821',endpoint);
  const wrapper=`<!doctype html><html><body style="margin:0"><iframe title="Plugin UI" sandbox="allow-scripts" style="width:420px;height:760px;border:0"></iframe><script>document.querySelector('iframe').srcdoc=${JSON.stringify(ui).replaceAll('<','\\u003c')};addEventListener('message',async event=>{const msg=event.data?.pluginMessage;if(!msg)return;const replies=await window.routePlugin(msg);for(const reply of replies??[])event.source.postMessage({pluginMessage:reply},'*')});</script></body></html>`;
  hostServer=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(wrapper);});hostServer.listen(0,'127.0.0.1');await once(hostServer,'listening');
  const hostPromise=application.waitForEvent('window');const windowId=await application.evaluate(async({BrowserWindow})=>{const host=new BrowserWindow({show:false,width:460,height:850,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});await host.loadURL('about:blank');return host.id;});hostPage=await hostPromise;
  await hostPage.exposeFunction('routePlugin',async msg=>{
    if(msg.type==='import'){fileImports.push(msg.data);return [{type:'busy',data:false}];}
    if(msg.type==='bridge-context')return [{type:'bridge-context',data:currentTarget}];
    if(msg.type==='bridge-import'){
      const delivery=msg.data;const {job,data}=delivery;
      if(!receipts.has(job.importId)){
        imports.push({jobId:job.id,packageId:data.packageId,importId:job.importId,target:job.target,nodes:data.screens.reduce((sum,s)=>sum+s.nodes.length,0),images:data.assets.length});
        // This host is synthetic: only the UI/network/control plane are real.
        const report={reportKind:'actual_import',inputKind:'capture',importId:job.importId,packageId:data.packageId,revision:data.revision,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),status:'succeeded',targetPageId:job.target.pageId,rootNodeIds:['synthetic-root-'+imports.length],nodeMap:data.screens.flatMap(s=>s.nodes.map((n,i)=>({screenId:s.id,sceneNodeId:n.id,figmaNodeId:`synthetic-${imports.length}-${s.id}-${i}`}))),counts:{nodes:job.total,screens:data.screens.length,images:data.assets.length,interactions:data.interactions.length},warnings:[],errors:[],versions:{plugin:'synthetic-host-test',schema:data.schemaVersion}};
        receipts.set(job.importId,report);
        await writeFile(resolve(folder,`captured-${imports.length}.json`),JSON.stringify(data,null,2));
      }
      const report=receipts.get(job.importId);
      setTimeout(()=>void hostPage.evaluate(result=>{const frame=document.querySelector('iframe').contentWindow;for(const msg of [{type:'report',data:result.report},{type:'bridge-result',data:result},{type:'busy',data:false}])frame.postMessage({pluginMessage:msg},'*');},{jobId:job.id,importId:job.importId,report}).catch(()=>{}),2200);
      return [{type:'busy',data:true},{type:'progress',data:{completed:Math.max(1,Math.floor(job.total/2)),total:job.total}}];
    }
    return [];
  });
  await hostPage.route('**/v1/jobs/chunk',async route=>{chunkRequests++;await route.continue();});
  await hostPage.route('**/v1/jobs/result',async route=>{if(!ackLost){ackLost=true;const response=await route.fetch();if(response.status()!==200)throw Error('synthetic ack setup failed');await route.abort('failed');}else await route.continue();});
  await application.evaluate(({BrowserWindow},{id,url})=>BrowserWindow.fromId(id).loadURL(url),{id:windowId,url:`http://127.0.0.1:${hostServer.address().port}/`});
  const frame=hostPage.frameLocator('iframe');await frame.locator('#connect').waitFor();
  await shell.locator('#connection-toggle').click();await shell.getByRole('button',{name:'生成配对码',exact:true}).click();const code=await shell.locator('#pair-value').textContent();
  await frame.locator('#pair-code').fill(code);await frame.getByRole('button',{name:'连接桌面应用',exact:true}).click();
  await waitBridge(state=>state.connected);
  const state=await shell.evaluate(()=>window.w2p.bridgeStatus());if(!state.connected||state.target?.documentName!==fakeTarget.documentName)console.log(JSON.stringify({connection:state,expectedTarget:fakeTarget,pluginStatus:await frame.locator('#bridge-state').textContent()}));check('opaque-plugin-UI-pairs-over-authenticated-loopback',state.connected&&state.target.documentName===fakeTarget.documentName);
  await shell.waitForFunction(()=>document.body.dataset.connected==='true');await shell.locator('#connection-toggle').click();await shell.evaluate(()=>new Promise(resolve=>setTimeout(resolve,1300)));check('connected-settings-remain-open-during-polling',await shell.locator('#bridge-disconnect').isVisible()&&await shell.locator('#bridge-disconnect').isEnabled());await shell.locator('#connection-toggle').click();
  check('source-page-has-no-app-or-pairing-bridge',await target.evaluate(()=>typeof window.w2p==='undefined'&&typeof window.require==='undefined'));
  const denied=await fetch(endpoint+'/v1/jobs/claim',{method:'POST',headers:{'Content-Type':'application/json',Origin:'null'},body:'{}'});check('job-claim-requires-bearer-token',denied.status===401);
  await application.evaluate(({dialog})=>{globalThis.__bridgeDialogs=0;dialog.showOpenDialog=async()=>{globalThis.__bridgeDialogs++;return {canceled:true,filePaths:[]};};dialog.showSaveDialog=async()=>{globalThis.__bridgeDialogs++;return {canceled:true};};});
  await shell.locator('#send-kind').selectOption('viewport');await shell.getByRole('button',{name:'转换并发送到 Figma',exact:true}).click();
  await waitBridge(s=>s.jobs.at(-1)?.completed>0&&s.jobs.at(-1)?.completed<s.jobs.at(-1)?.total);
  check('plugin-progress-reaches-desktop',true);
  await waitBridge(s=>s.jobs.at(-1)?.status==='succeeded');
  await frame.locator('#bridge-state').filter({hasText:'结果已回传'}).waitFor({timeout:20000});
  check('lost-result-response-retries-without-reimport',ackLost&&imports.length===1);
  const first=(await shell.evaluate(()=>window.w2p.bridgeStatus())).jobs[0];
  const same=await shell.evaluate(()=>window.w2p.bridgeSend(document.querySelector('#capture-name').value));check('repeat-send-reuses-the-same-job',same.id===first.id&&imports.length===1);
  const delivered=JSON.parse(await readFile(resolve(folder,'captured-1.json'),'utf8'));const png=delivered.assets[0];
  check('captured-images-arrive-with-original-integrity',!!png&&createHash('sha256').update(Buffer.from(png.inlineBase64,'base64')).digest('hex')===png.sha256);
  await shell.locator('#section').click();await target.locator('#orders h2').click();await shell.waitForFunction(()=>document.querySelector('#output')?.textContent?.includes('"id": "orders"'));
  await shell.locator('#multiple').check();await target.locator('#notes h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2);
  await shell.locator('#send-kind').selectOption('selection');await shell.getByRole('button',{name:'转换并发送到 Figma',exact:true}).click();await waitBridge(s=>s.jobs.at(-1)?.status==='succeeded'&&s.jobs.length===2);
  check('two-captures-arrive-without-native-file-pickers',imports.length===2&&(await application.evaluate(()=>globalThis.__bridgeDialogs))===0);
  check('multi-screen-package-arrives-as-one-import-job',JSON.parse(await readFile(resolve(folder,'captured-2.json'),'utf8')).screens.length===2);
  await shell.locator('#tab-selection').click();await shell.locator('#send-kind').selectOption('full_page');await shell.locator('#capture-send').click();
  await waitBridge(s=>s.jobs.length===3&&s.jobs.at(-1)?.status==='succeeded',90000);
  const full=JSON.parse(await readFile(resolve(folder,'captured-3.json'),'utf8'));
  check('expanded-full-page-arrives-as-one-native-import-job',full.screens[0].selection.mode==='full_page'&&full.screens[0].nodes.some(node=>node.text?.characters.includes('LONG_PAGE_END'))&&imports.length===3&&(await application.evaluate(()=>globalThis.__bridgeDialogs))===0);
  await target.evaluate(async()=>{const section=document.createElement('section');section.id='large-transfer';section.style.cssText='width:700px;padding:20px;background:white';let seed=123;for(let i=0;i<5;i++){const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d'),image=ctx.createImageData(160,160);for(let p=0;p<image.data.length;p+=4){for(let j=0;j<3;j++){seed=(seed*1664525+1013904223)>>>0;image.data[p+j]=seed>>>24;}image.data[p+3]=255;}ctx.putImageData(image,0,0);const img=new Image();img.src=c.toDataURL();img.width=120;img.height=120;section.append(img);await img.decode();}document.body.append(section);});await shell.evaluate(()=>window.w2p.select(true,'element'));await target.locator('#large-transfer').click({position:{x:2,y:2}});const chunksBefore=chunkRequests;const large=await shell.evaluate(()=>window.w2p.captureSend('selection'));await waitBridge(s=>s.jobs.length===4&&s.jobs.at(-1).status==='succeeded',60000);check('large-package-arrives-through-multiple-verified-chunks',Buffer.byteLength(JSON.stringify(large.data))>262144&&chunkRequests-chunksBefore>=2&&imports.length===4);
  currentTarget={...fakeTarget,pageId:'0:2',pageName:'Other page'};await hostPage.evaluate(target=>document.querySelector('iframe').contentWindow.postMessage({pluginMessage:{type:'bridge-context',data:target}},'*'),currentTarget);
  await waitBridge(s=>!s.connected);await shell.waitForFunction(()=>document.querySelector('#capture-send').disabled);check('page-change-disables-send',await shell.locator('#capture-send').isDisabled());
  check('page-change-rejects-programmatic-send',await shell.evaluate(()=>window.w2p.bridgeSend('').then(()=>false,error=>error.message.includes('E_BRIDGE_UNREACHABLE'))));
  currentTarget={...fakeTarget};await hostPage.evaluate(target=>document.querySelector('iframe').contentWindow.postMessage({pluginMessage:{type:'bridge-context',data:target}},'*'),currentTarget);await waitBridge(s=>s.connected);
  check('returning-to-paired-page-restores-connection',true);
  const replayPair=await fetch(endpoint+'/v1/pair',{method:'POST',headers:{'Content-Type':'application/json',Origin:'null'},body:JSON.stringify({code,target:fakeTarget})});check('pairing-code-cannot-be-used-twice',replayPair.status===403);
  await frame.getByRole('button',{name:'断开连接',exact:true}).click();await waitBridge(s=>!s.paired);await shell.waitForFunction(()=>document.querySelector('#capture-send').disabled);
  check('plugin-disconnect-updates-desktop',await shell.locator('#capture-send').isDisabled());
  check('file-fallback-remains-available',await shell.locator('#save').isEnabled());await build({entryPoints:['packages/contracts/src/archive.ts'],outfile:resolve('.runtime/archive-codec.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});const {encodeCaptureZip}=createRequire(import.meta.url)(resolve('.runtime/archive-codec.cjs')),zipPath=resolve(folder,'actual-large-file.zip');await writeFile(zipPath,encodeCaptureZip(large.data,bytes=>deflateRawSync(bytes)));await frame.locator('#file').setInputFiles(zipPath);const until=Date.now()+15000;while(!fileImports.length&&Date.now()<until)await new Promise(r=>setTimeout(r,50));check('opaque-plugin-file-UI-decodes-real-ZIP-before-import',fileImports.length===1&&fileImports[0].packageId===large.data.packageId&&fileImports[0].assets.length===5);
  await shell.screenshot({path:resolve(folder,'desktop-shell.png')});await hostPage.screenshot({path:resolve(folder,'plugin-UI-synthetic-host.png')});
}catch(error){console.error(stderr);throw error;}finally{
  await writeFile(resolve(folder,'report.json'),JSON.stringify({at:new Date().toISOString(),evidenceKind:'actual_electron_bridge_control_plane',figmaTested:false,canvasHost:'synthetic; no real Figma canvas was modified',pluginUI:'real bundled UI in opaque sandbox iframe; localhost port replaced for isolated test',imports,checks},null,2));
  if(application)await application.close();if(hostServer)await new Promise(resolve=>hostServer.close(resolve));
}
console.log(JSON.stringify({folder,checks},null,2));

