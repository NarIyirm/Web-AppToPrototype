import { app, BrowserWindow, WebContentsView, ipcMain, dialog, session,clipboard,Menu,nativeImage } from 'electron';
import { createServer, type Server } from 'node:http';
import { readFile, mkdir, writeFile, rename,stat } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import sample from '../../../examples/figma-m0-probe.json';
import { convertCaptures,mergeCaptures } from './converter';
import { resolveAssets } from './assets';
import { parseCapturePackage, type CapturePackage } from '../../../packages/contracts/src/index';
import type { DomCapture, SourcePreview } from './capture-data';
import { makePreview,savePreviews,loadPreviews } from './preview';
import {FULL_PAGE_LIMITS,prepareFullPage,withFullPageSession,referencePositions,checkPage,type PageInfo,type FullPageAdapter} from './full-page';
import { LIMITS, utf8Bytes } from '../../../packages/contracts/src/resources';
import { LocalBridge } from './bridge';
import {sameTarget} from '../../../packages/contracts/src/bridge';
import {WorkspaceStorage,atomicFile} from './storage';
import {addProjectStates,selectProjectScreens,editProject,validateProject,type ProjectDocument} from './project';
import {encodeCaptureZip,decodeCaptureZip} from '../../../packages/contracts/src/archive';
import {inflateRawSync,deflateRawSync} from 'node:zlib';
import {applyAutoLayouts} from './layouts';
import {RuntimeLog} from './logging';
import {bindMacLifecycle,macMenu,revealWindow} from './platform';
import {recognizeDesktopImage,remapOcr} from './desktop-ocr';
import {importMobileBundle,isMobileMaterial} from './mobile-import';
import {makeMobilePreviews} from './mobile-preview';
import {MobileReceiver} from './mobile-receiver';

let window: BrowserWindow;
let target: WebContentsView;
let server: Server;
let fixtureUrl = '';
let pageEpoch = 0;
let selecting = false;
let captureBusy = false;
let captureInstallation:{epoch:number;promise:Promise<void>}|undefined;
let captureControl:AbortController|undefined;
let startupNavigation:Promise<unknown>=Promise.resolve();
let lastCapture: CapturePackage | null = null;
let lastPreview: SourcePreview | undefined;
let lastPreviews:SourcePreview[]=[];
// Hidden checks use an OS-assigned port so they can run alongside the user's app.
let listenPort = process.env.W2P_SMOKE === '1' ? 0 : 43821;
const WORLD = 1001;
const ROOT = resolve(__dirname, '../../..');
const runtime = process.env.W2P_DATA_DIR ?? join(app.getPath('userData'), 'm0');
const workspace=new WorkspaceStorage(runtime);
const log=new RuntimeLog(join(runtime,'logs'));
const mobileReceiver=new MobileReceiver(join(runtime,'mobile-inbox'),async name=>{
  const result=await dialog.showMessageBox(window,{type:'question',title:'手机连接请求',message:`允许“${name}”向本机发送界面素材？`,detail:'请确认这是你刚才扫码的手机。本次授权15分钟，素材接收后仍需在收件箱转换。',buttons:['拒绝','允许连接'],defaultId:0,cancelId:0});
  return result.response===1;
});
let mobileOffers:{address:string;payload:string;qr:string}[]=[];
let viewport:{width:number;height:number}|undefined;
mkdirSync(runtime, { recursive: true });
app.setPath('userData', runtime);
const ownsInstance=process.env.W2P_SMOKE==='1'||app.requestSingleInstanceLock();if(!ownsInstance)app.quit();
app.on('second-instance',()=>{if(window)revealWindow(window);});

async function withTarget<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
  const contents=target.webContents;if(contents.isDestroyed())throw Error('E_TARGET_CHANGED');
  if(signal?.aborted)throw Error('E_CANCELLED');
  let interrupt!:(error:Error)=>void;const interrupted=new Promise<never>((_resolve,reject)=>{interrupt=reject;});
  const navigation=(_event:unknown,_url:string,_inPlace:boolean,isMainFrame:boolean)=>{if(isMainFrame)interrupt(Error('E_TARGET_CHANGED: 页面已跳转'));};
  const destroyed=()=>interrupt(Error('E_TARGET_CHANGED: 页面已关闭'));
  const cancelled=()=>interrupt(Error('E_CANCELLED: 采集已取消'));
  const timer=setTimeout(()=>interrupt(Error('E_CAPTURE_TIMEOUT: 页面读取超过等待预算')),15000);
  contents.on('did-start-navigation',navigation);contents.once('destroyed',destroyed);signal?.addEventListener('abort',cancelled,{once:true});
  try{return await Promise.race([work(),interrupted]);}
  finally{clearTimeout(timer);contents.off('did-start-navigation',navigation);contents.off('destroyed',destroyed);signal?.removeEventListener('abort',cancelled);}
}
async function evaluate<T>(code: string,signal?:AbortSignal): Promise<T> {
  return withTarget(()=>target.webContents.executeJavaScriptInIsolatedWorld(WORLD, [{ code }]) as Promise<T>,signal);
}
function state(extra: Record<string, unknown> = {}) {
  if (window&&!window.isDestroyed()) window.webContents.send('target-state', { url: target?.webContents.getURL(), pageEpoch, selecting, ...extra });
}
function resize() {
  const [width, height] = window.getContentSize();
  const available={width:Math.max(400,width-(width<1150?304:352)),height:Math.max(200,height-140)};
  if(viewport){const scale=Math.min(1,available.width/viewport.width,available.height/viewport.height);target.setBounds({x:0,y:108,width:Math.round(viewport.width*scale),height:Math.round(viewport.height*scale)});void target.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false,scale}).catch(error=>state({error:'视口设置未完成：'+String(error)}));}
  else target.setBounds({ x: 0, y: 108, ...available });
}
async function installCapture() {
  const epoch=pageEpoch;
  if(captureInstallation?.epoch===epoch)return captureInstallation.promise;
  const promise=(async()=>{const code=await readFile(join(__dirname,'capture.js'),'utf8');if(pageEpoch!==epoch)throw Error('E_TARGET_CHANGED: 页面已跳转');await evaluate(code);})();
  captureInstallation={epoch,promise};
  try{await promise;}catch(error){if(captureInstallation?.promise===promise)captureInstallation=undefined;throw error;}
}
function validateNavigation(value: unknown) {
  if (typeof value !== 'string' || value.length > 8192) throw new Error('请输入有效网址');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('仅支持 HTTPS 或本地 HTTP demo');
  if (url.username || url.password) throw new Error('网址不能包含用户名或密码');
  return url.href;
}
function register(channel: string, fn: (...args: any[]) => unknown) {
  ipcMain.handle(channel, (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('IPC 来源不允许');
    return Promise.resolve().then(()=>fn(...args)).catch(error=>{void log.write('ipc_error',{channel,code:String(error).match(/E_[A-Z_]+/)?.[0]??'ERROR'}).catch(()=>{});throw error;});
  });
}
function serialize(data: CapturePackage) { const body = JSON.stringify(data, null, 2); if (utf8Bytes(body) > LIMITS.jsonBytes) throw new Error('E_LIMIT_EXCEEDED: serialized JSON bytes'); return body; }
async function openMobile(path:string,bytes?:Uint8Array){
  if(captureBusy)throw Error('转换进行中，请稍候');
  const controller=new AbortController();captureControl=controller;captureBusy=true;state({captureBusy:true,phase:'正在转换手机画面…'});
  try{
    const cache=new Map<string,Awaited<ReturnType<typeof recognizeDesktopImage>>>();let index=0;
    const imported=await importMobileBundle(bytes??await readFile(path),async(data,width,height)=>{
      if(controller.signal.aborted)throw Error('已取消转换。');const key=createHash('sha256').update(data).digest('hex');if(cache.has(key))return cache.get(key)!;
      state({phase:`正在离线识别 App 画面 ${++index} 的文字…`});
      const scale=Math.min(1,2000/width,2000/height),size={width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
      const image=scale<1?nativeImage.createFromBuffer(Buffer.from(data)).resize({...size,quality:'best'}).toPNG():data;
      const value=remapOcr(await recognizeDesktopImage(image,size.width,size.height,controller.signal),size,{width,height});cache.set(key,value);return value;
    }),data=imported.data,previews=makeMobilePreviews(imported);
    if(controller.signal.aborted)throw Error('已取消转换，之前的转换结果保留。');const outputPath=join(runtime,`${data.packageId}.json`);
    await atomicFile(outputPath,serialize(data));await savePreviews(outputPath,previews,data);
    return {data,path:outputPath,previews,preview:previews[0]};
  }finally{if(captureControl===controller)captureControl=undefined;captureBusy=false;state({captureBusy:false,captureProgress:null});}
}

app.whenReady().then(async () => {
  if(!ownsInstance)return;
  await mkdir(runtime, { recursive: true });
  await workspace.init();
  const bridge=new LocalBridge(join(runtime,'bridge-journal.json'));await bridge.init();
  const fixture = await readFile(join(ROOT, 'apps/desktop/fixtures/probe.html'));
  const extraFixtures=new Map<string,Buffer>(await Promise.all(['virtual','infinite','tall','visual','text','layers','svg','forms','shadows','prototype','auth'].map(async name=>[`/fixture-${name}`,await readFile(join(ROOT,`apps/desktop/fixtures/${name}.html`))] as const)));
  const svgFixture=await readFile(join(ROOT,'apps/desktop/fixtures/svg-sample.svg'));
  const visualImages=new Map<string,Buffer>(await Promise.all(['wide','portrait','alpha'].map(async name=>[`/visual-${name}.png`,await readFile(join(ROOT,`apps/desktop/fixtures/visual-${name}.png`))] as const)));
  server = createServer((request, response) => {
    if (![ `127.0.0.1:${listenPort}`, `localhost:${listenPort}` ].includes(request.headers.host ?? '')) { response.writeHead(403).end(); return; }
    if(request.url?.startsWith('/v1/')&&request.url!=='/v1/health'){void bridge.handle(request,response);return;}
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (request.url === '/v1/health') {
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.end(JSON.stringify({ service: 'WebToPrototype M0 health probe', protocol: '1.0.0', dataAccess: false, requestOrigin: request.headers.origin ?? null })); return;
    }
    if (request.url === '/fixture'||extraFixtures.has(request.url??'')) {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:");
      response.end(request.url==='/fixture'?fixture:extraFixtures.get(request.url!)); return;
    }
    if(request.url==='/fixture-protected.png'){if(!request.headers.cookie?.includes('w2p_local_auth=1')){response.writeHead(401).end();return;}response.setHeader('Content-Type','image/png');response.end(Buffer.from(sample.assets[0].inlineBase64,'base64'));return;}
    if (request.url === '/fixture-image.png') { response.setHeader('Content-Type', 'image/png'); response.end(Buffer.from(sample.assets[0].inlineBase64, 'base64')); return; }
    if(request.url==='/fixture-webp.webp'||request.url==='/fixture-gif.gif'){response.setHeader('Content-Type',request.url.endsWith('webp')?'image/webp':'image/gif');void readFile(join(ROOT,'apps/desktop/fixtures',request.url.slice(1))).then(bytes=>response.end(bytes),()=>response.writeHead(404).end());return;}
    if(request.url==='/svg-sample.svg'){response.setHeader('Content-Type','image/svg+xml');response.end(svgFixture);return;}
    if (visualImages.has(request.url??'')) { response.setHeader('Content-Type','image/png');response.end(visualImages.get(request.url!));return; }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(listenPort, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法读取本地服务端口');
  listenPort = address.port;
  fixtureUrl = `http://127.0.0.1:${listenPort}/fixture`;
  window = new BrowserWindow({ width: 1320, height: 860, minWidth: 1000, minHeight: 650, show: process.env.W2P_SMOKE !== '1', title: 'WebToPrototype · 网页转 Figma', webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  bindMacLifecycle(app,window,process.platform,process.env.W2P_SMOKE==='1');
  if(process.platform==='darwin')Menu.setApplicationMenu(Menu.buildFromTemplate(macMenu(()=>{revealWindow(window);window.webContents.focus();window.webContents.send('app-command','focus-address');})));
  const partition = session.fromPartition('persist:w2p-target');
  partition.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  partition.setPermissionCheckHandler(() => false);
  target = new WebContentsView({ webPreferences: { session: partition, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.contentView.addChildView(target); resize(); window.on('resize', resize);
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.webContents.on('will-navigate', (event, url) => { try { validateNavigation(url); } catch { event.preventDefault(); } });
  target.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => { if (isMainFrame) { pageEpoch++; selecting = false; state({ loading: !inPlace, selectionInvalidated: true }); if (inPlace) void evaluate('window.__w2pProbe?.reset()').catch(() => undefined); } });
  target.webContents.on('did-finish-load', async () => {const epoch=pageEpoch;try { await installCapture();if(pageEpoch===epoch)state({ loading: false, title: target.webContents.getTitle() }); } catch (error) {if(pageEpoch===epoch)state({ error: String(error) }); } });
  target.webContents.on('did-fail-load', (_event, code, description, _url, main) => { if (main && code !== -3) state({ loading: false, error: description }); });
  target.webContents.on('render-process-gone', () => state({ error: '目标页面进程已退出，请重新打开页面。' }));
  register('navigate', async (value: unknown) => { const url = validateNavigation(value);await startupNavigation;await target.webContents.loadURL(url);await installCapture();return url; });
  register('demo', async () => {await startupNavigation;await target.webContents.loadURL(fixtureUrl);await installCapture();return fixtureUrl; });
  register('viewport-size',async(value:unknown)=>{if(captureBusy)throw Error('请等待采集结束');if(value!==null){const v=value as {width:number;height:number};if(!v||!Number.isInteger(v.width)||!Number.isInteger(v.height)||v.width<320||v.height<240||v.width>2560||v.height>3000)throw Error('视口宽度320–2560，高度240–3000');if(!target.webContents.debugger.isAttached())target.webContents.debugger.attach('1.3');viewport={width:v.width,height:v.height};await target.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false,scale:1});}else{if(target.webContents.debugger.isAttached())await target.webContents.debugger.sendCommand('Emulation.clearDeviceMetricsOverride');viewport=undefined;}resize();await evaluate('window.__w2pProbe?.reset()');state({selectionInvalidated:true});return viewport??null;});
  register('clear-session',async()=>{if(captureBusy)throw Error('请等待采集结束');const result=await dialog.showMessageBox(window,{type:'warning',message:'清除内置浏览器的登录与缓存？',detail:'只清除本应用网页会话；已保存的转换文件和项目保留。',buttons:['取消','清除会话'],defaultId:0,cancelId:0});if(result.response!==1)return false;target.webContents.stop();await partition.clearStorageData();await partition.clearCache();await target.webContents.loadURL(fixtureUrl);await installCapture();return true;});
  register('history-list',()=>workspace.history());
  register('history-open',async(id:unknown)=>{if(captureBusy)throw Error('请等待采集结束');const loaded=await workspace.load(id);lastCapture=loaded.data;lastPreviews=loaded.previews;lastPreview=lastPreviews[0];return loaded;});
  register('project-read',()=>workspace.read());
  register('project-add',async(ids:unknown)=>{if(captureBusy||!lastCapture)throw Error('先转换内容再保存为状态');const chosen=selectProjectScreens(lastCapture,ids);return workspace.update(p=>addProjectStates(p,chosen,lastPreviews,randomUUID()));});
  register('project-edit',async(action:unknown,value:unknown)=>{if(captureBusy||typeof action!=='string'||!value||typeof value!=='object')throw Error('项目操作无效');return workspace.update(p=>editProject(p,action,{...(value as Record<string,unknown>),...action==='link'?{id:randomUUID()}:{}}));});
  register('project-reset',async()=>{const result=await dialog.showMessageBox(window,{type:'warning',message:'新建空项目？',detail:'当前项目会先备份；历史转换和导出文件保留。',buttons:['取消','备份并新建'],defaultId:0,cancelId:0});if(result.response!==1)return null;const p=workspace.read();await atomicFile(join(runtime,`project-backup-${Date.now()}.json`),JSON.stringify(p));return workspace.reset();});
  register('project-build',async()=>{if(captureBusy)throw Error('请等待采集结束');const p=workspace.read();if(!p.data)throw Error('项目还没有状态');lastCapture=parseCapturePackage(p.data);lastPreviews=p.previews;lastPreview=lastPreviews[0];return {data:lastCapture,previews:lastPreviews,path:join(runtime,'project.json')};});
  register('project-file',async(mode:unknown)=>{if(captureBusy)throw Error('请等待采集结束');if(mode==='save'){const p=workspace.read(),result=await dialog.showSaveDialog(window,{title:'备份可继续编辑的项目',defaultPath:`${p.id}.w2p-project.json`,filters:[{name:'WebToPrototype Project',extensions:['json']}]});if(result.canceled||!result.filePath)return null;await atomicFile(result.filePath,JSON.stringify(p));return result.filePath;}if(mode!=='open')throw Error('项目操作无效');const result=await dialog.showOpenDialog(window,{title:'打开项目副本',properties:['openFile'],filters:[{name:'WebToPrototype Project',extensions:['json']}]});if(result.canceled)return null;const path=result.filePaths[0];if((await stat(path)).size>128*1024*1024)throw Error('项目超过128MiB');const p=validateProject(JSON.parse(await readFile(path,'utf8')));await atomicFile(join(runtime,'project-before-open.json'),JSON.stringify(workspace.read()));p.id='project-'+randomUUID();if(p.data){p.data.packageId=p.id;p.data.projectId=p.id;p.previews=p.previews.map(v=>({...v,metadata:{...v.metadata,packageId:p.id}}));}return workspace.update(()=>p);});
  register('selection', async (enabled: unknown, mode: unknown = 'element', policy:unknown='strict',multiple:unknown=false) => { if (captureBusy) throw new Error('转换进行中，请稍候'); if (typeof enabled !== 'boolean'||typeof multiple!=='boolean' || !['element', 'section','rectangle','exclude'].includes(String(mode))||!['strict','complete_elements'].includes(String(policy))) throw new Error('无效选择状态'); await evaluate(enabled ? `window.__w2pProbe.enable(${JSON.stringify(mode)},${JSON.stringify(policy)},${multiple})` : 'window.__w2pProbe.disable()'); selecting = enabled; state({selectionMode:mode}); return enabled; });
  register('selection-edit',async(action:unknown,key:unknown)=>{if(captureBusy||!['clear','remove','restore','single'].includes(String(action))||(key!==undefined&&(typeof key!=='string'||!/^dom-\d+$/.test(key))))throw Error('无效选择操作');await evaluate(`window.__w2pProbe.edit(${JSON.stringify(action)},${JSON.stringify(key)})`);});
  register('boundary',async(policy:unknown)=>{if(captureBusy||!['strict','complete_elements'].includes(String(policy)))throw Error('无效边界策略');await evaluate(`window.__w2pProbe.boundary(${JSON.stringify(policy)})`);});
  register('select-parent', async () => { if (captureBusy) throw new Error('转换进行中，请稍候'); const selection = await evaluate('window.__w2pProbe.parent()'); state({ selection }); return selection; });
  register('capture-cancel',()=>{if(captureBusy){captureControl?.abort();state({phase:'正在取消，恢复原滚动位置…'});}return captureBusy;});
  const capturePage=async (kind:unknown='selection',outputMode:unknown='separate',prepare:unknown=true,autoLayout:unknown=false) => {
    if(!['selection','viewport','full_page'].includes(String(kind))||!['separate','merged'].includes(String(outputMode))||typeof prepare!=='boolean'||typeof autoLayout!=='boolean')throw Error('无效采集模式');
    if (captureBusy) throw new Error('转换进行中，请稍候');
    captureControl=new AbortController();const signal=captureControl.signal;captureBusy = true; state({ captureBusy: true }); const epoch = pageEpoch; const deadline = Date.now() + (kind==='full_page'?90000:45000);
    const assertCurrent = () => {if(signal.aborted)throw Error('E_CANCELLED: 已取消，之前的转换结果保留');if (pageEpoch !== epoch || target.webContents.isDestroyed()) throw new Error('E_TARGET_CHANGED: 页面已跳转，请重新选择'); if (Date.now() > deadline) throw new Error('E_CAPTURE_TIMEOUT: 转换超时，请缩小区块'); };
    const read=<T>(code:string)=>evaluate<T>(code,signal);
    const bitmap=(rect?:{x:number;y:number;width:number;height:number})=>withTarget(()=>target.webContents.capturePage(rect,{stayHidden:true,stayAwake:true}),signal);
    const throttling=target.webContents.getBackgroundThrottling();
    try {
      assertCurrent(); state({ phase: '读取区块文字与布局' });
      await installCapture();assertCurrent();
      await read('window.__w2pProbe.disable()');selecting=false;state({selecting:false});
      const paused=await read<number>('window.__w2pProbe.freezeAnimations()');
      let preparedPreviews:SourcePreview[]|undefined,preparedNotice:string|undefined,fullSnapshotChanged=false;
      const layoutMatches=(capture:DomCapture,content=true)=>read<boolean>(`window.__w2pProbe.layoutMatches(${JSON.stringify(capture.layoutStamp)},${content})`);
      const fullLayout=async(capture:DomCapture)=>{assertCurrent();if(!await layoutMatches(capture,false))throw Error('E_LAYOUT_CHANGED: 采集中窗口尺寸、缩放或选择发生变化，请保持窗口不变后重试');const matches=await layoutMatches(capture);if(!matches)fullSnapshotChanged=true;return matches;};
      const packageId=`capture-${randomUUID()}`;
      let captures:DomCapture[];
      if(kind==='full_page'){
        target.webContents.setBackgroundThrottling(false);
        const adapter:FullPageAdapter={
          begin:()=>read('window.__w2pProbe.fullBegin()'),
          scroll:async y=>{assertCurrent();await read<PageInfo>(`window.__w2pProbe.fullScroll(${y})`);
            // A real compositor frame is needed for IntersectionObserver loading
            // when the app is backgrounded, before taking the DOM snapshot.
            await bitmap({x:0,y:0,width:1,height:1});
            const info=await read<PageInfo>(`window.__w2pProbe.fullScroll(${y})`);assertCurrent();return info;},
          restore:async initial=>{state({phase:'恢复原滚动位置'});if(pageEpoch!==epoch||target.webContents.isDestroyed())return false;return evaluate<boolean>(`window.__w2pProbe.fullRestore(${initial.x},${initial.y})`);}
        };
        const result=await withFullPageSession(adapter,async()=>{
          const summary=await prepareFullPage(adapter,prepare,assertCurrent,(step,info)=>state({phase:prepare?`滚动准备 ${step}/${FULL_PAGE_LIMITS.steps} · 已到 ${Math.round(info.y+info.viewportHeight)}px / 页面 ${Math.round(info.height)}px`:'读取当前已加载页面',captureProgress:{phase:'preparing',step,total:FULL_PAGE_LIMITS.steps}}));
          await adapter.scroll(0);assertCurrent();state({phase:'读取全页文字与布局'});
          const values=await read<DomCapture[]>(`window.__w2pProbe.captureBatch('full_page',${summary.capturedHeight})`);const capture=values[0];capture.context.zoomFactor=target.webContents.getZoomFactor();
          summary.documentHeight=capture.requestedRect!.height;summary.capturedHeight=capture.selection.originalRect.height;
          if(!summary.partial&&summary.documentHeight>summary.capturedHeight+2){summary.partial=true;summary.reason='layout_growth';}
          const stable=()=>fullLayout(capture);
          await stable();
          const plan=prepare?referencePositions(summary.capturedHeight,capture.context.viewport.height):{positions:[0],sampled:summary.capturedHeight>capture.context.viewport.height};
          const previews:SourcePreview[]=[];let previewBytes=0;
          try{for(const [index,y] of plan.positions.entries()){
            state({phase:`生成分段源参考 ${index+1}/${plan.positions.length}`,captureProgress:{phase:'references',step:index+1,total:plan.positions.length}});
            const info=await adapter.scroll(y);if(prepare)checkPage(info);if(!await stable())break;
            const image=makePreview(await bitmap(),capture,packageId,'screen-1',{x:info.x,y:info.y});
            if(!await stable())break;
            if(image){previewBytes+=Math.ceil(image.dataUrl.length*.75);if(previewBytes>FULL_PAGE_LIMITS.previewBytes){preparedNotice='分段参考达到 32 MiB 上限，仅保留已生成部分。';break;}image.metadata.segmentIndex=previews.length+1;previews.push(image);}
          }}catch(error){assertCurrent();if(error instanceof Error&&/E_LAYOUT_CHANGED|E_FULL_PAGE_VIRTUALIZED|E_CANCELLED/.test(error.message))throw error;preparedNotice='部分源参考无法生成，可编辑全页仍保留。';}
          await stable();const partialReference=plan.sampled||previews.length<plan.positions.length;
          for(const image of previews){image.metadata.segmentCount=previews.length;image.metadata.referenceMode=partialReference?'sampled':'segments';}
          if(partialReference&&!preparedNotice)preparedNotice=fullSnapshotChanged?'页面在读取快照后继续更新，已停止生成后续分段参考；可编辑快照保留。':prepare?'长页源参考按位置抽样，并非连续整页截图。':'未启用滚动准备，仅提供首屏源参考。';
          capture.warnings.push({code:'I_FULL_PAGE_CAPTURE',severity:'info',message:`全页采集 ${Math.round(capture.selection.originalRect.width)} × ${Math.round(summary.capturedHeight)} CSS px（页面高 ${Math.round(summary.documentHeight)}px）；${summary.partial?'仅部分范围':prepare?'已滚动准备的加载内容':'当前已加载内容'}；源参考 ${previews.length} 段${partialReference?'（部分/抽样）':''}。`,details:{...summary,referenceCount:previews.length,referenceMode:partialReference?'sampled':'segments'}});
          if(summary.partial)capture.warnings.push({code:'W_FULL_PAGE_PARTIAL',severity:'warning',message:`${({height_limit:'达到高度上限',step_limit:'达到滚动次数上限',time_limit:'达到准备时长上限',layout_growth:'准备后页面继续增长'} as Record<string,string>)[summary.reason]??'达到全页预算'}，本次只采集 ${Math.round(summary.capturedHeight)}px，未宣称完整。`});
          if(!summary.settled)capture.warnings.push({code:'W_PAGE_UNSTABLE',severity:'warning',message:'部分滚动位置在等待预算内仍有变化；本次仅保留实际已加载内容。'});
          preparedPreviews=previews;return values;
        });
        captures=result.value;if(!result.restored)captures[0].warnings.push({code:'W_SCROLL_RESTORE',severity:'warning',message:'页面范围变化，未能精确恢复原滚动位置，请手动核对。'});
      }else captures=await read<DomCapture[]>(`window.__w2pProbe.captureBatch(${JSON.stringify(kind)})`);
      assertCurrent();
      captures.forEach(capture=>capture.context.zoomFactor=target.webContents.getZoomFactor());
      if(captures.reduce((sum,c)=>sum+c.nodes.length,0)>10000)throw Error('E_LIMIT_EXCEEDED: 整批最多 10000 图层，请减少区块');
      const assertLayout=async()=>{assertCurrent();for(const capture of captures){if(kind==='full_page')await fullLayout(capture);else if(!await layoutMatches(capture))throw Error('E_LAYOUT_CHANGED: 页面滚动、缩放或选择已变化，请重新采集');}};
      await assertLayout();if(outputMode==='merged'&&captures.length>1)captures=[mergeCaptures(captures)];
      await assertLayout();
      let preview:SourcePreview|undefined,previewNotice:string|undefined=preparedNotice;const previews:SourcePreview[]=preparedPreviews??[];
      state({phase:'生成源截图预览'});
      try{if(kind!=='full_page'){
        await read('window.__w2pProbe.hideOverlay(true)');
        const capturedBitmap=await bitmap();
        captures.forEach((capture,index)=>{const image=makePreview(capturedBitmap,capture,packageId,`screen-${index+1}`);if(image)previews.push(image);});
        preview=previews.find(p=>p.metadata.screenId==='screen-1');
        if(previews.length<captures.length)previewNotice='部分区块不在可见视口内，未生成源截图；可编辑内容仍会转换。';
      }else preview=previews[0];}catch{previewNotice='源截图暂不可用；可编辑转换仍可保存，请重新采集以获得预览。';}
      finally{if(pageEpoch===epoch&&!target.webContents.isDestroyed())await evaluate('window.__w2pProbe.hideOverlay(false)').catch(()=>undefined);}
      await assertLayout();
      state({ phase: `固化 ${captures.reduce((sum,c)=>sum+c.images.length,0)} 个图片资源` });
      const assetMap=new Map<string,Awaited<ReturnType<typeof resolveAssets>>[number]>();let assetBytes=0,pixels=0;
      for(const capture of captures)for(const asset of await resolveAssets(capture,partition,assertCurrent,signal))if(!assetMap.has(asset.assetId)){assetMap.set(asset.assetId,asset);assetBytes+=asset.byteLength;pixels+=asset.width*asset.height;if(assetBytes>LIMITS.totalAssetBytes||pixels>LIMITS.totalPixels)throw Error('E_LIMIT_EXCEEDED: 整批图片预算超限');}
      await assertLayout();if(fullSnapshotChanged)captures[0].warnings.push({code:'W_PAGE_CHANGED_AFTER_SNAPSHOT',severity:'warning',message:'网页在全页快照读取后继续更新，本次保留读取时的可编辑内容与布局。分段源参考仅保留匹配该快照的部分；如需最新页面状态，请重新采集。'});if(paused)captures[0].warnings.push({code:'I_ANIMATION_SNAPSHOT',severity:'info',message:`${paused}个运行中的网页动画按当前帧暂时冻结，采集结束后恢复。网页业务逻辑不迁移。`});if(autoLayout)captures.forEach(applyAutoLayouts);const data = convertCaptures(captures,[...assetMap.values()],String(epoch),packageId);
      const path = join(runtime, 'last-capture.json');
      await writeFile(`${path}.tmp`, serialize(data)); assertCurrent(); await rename(`${path}.tmp`, path);
      lastCapture = data;lastPreview=preview;lastPreviews=previews;
      void log.write('capture_complete',{packageId:data.packageId,screens:data.screens.length,nodes:data.screens.reduce((n,s)=>n+s.nodes.length,0)}).catch(()=>{});
      try{await savePreviews(path,previews,data);}catch{previewNotice='源截图已显示，但部分预览缓存写入失败；保存时将再次尝试。';}
      try{await workspace.remember({data,path,preview,previews,previewNotice});}catch{previewNotice=(previewNotice??'')+' 历史缓存未写入，当前结果仍可保存。';}
      return { data, path,preview,previews,previewNotice };
    } catch(error){if(signal.aborted)throw Error('E_CANCELLED: 已取消，之前的转换结果保留');if(pageEpoch!==epoch||target.webContents.isDestroyed())throw Error('E_TARGET_CHANGED: 页面已跳转，旧采集已停止');throw error;}
    finally {if(pageEpoch===epoch&&!target.webContents.isDestroyed())await evaluate('window.__w2pProbe?.restoreAnimations()').catch(()=>undefined);if(kind==='full_page'&&pageEpoch===epoch&&!target.webContents.isDestroyed())await evaluate('window.__w2pProbe?.fullCleanup()').catch(()=>state({error:'采集已停止，滚动位置恢复未确认，请手动核对。'}));if(!target.webContents.isDestroyed())target.webContents.setBackgroundThrottling(throttling);captureControl=undefined;captureBusy = false; state({ captureBusy: false,captureProgress:null }); }
  };
  register('capture',capturePage);
  const namedCapture=(name:unknown)=>{if(!lastCapture)throw Error('请先转换一个区块');if(typeof name!=='string'||name.length>120)throw Error('画面名称最多 120 字符');const data=structuredClone(lastCapture);if(name.trim()&&name.trim()!==data.screens[0].name){data.screens[0].name=data.screens[0].nodes.find(n=>n.id===data.screens[0].rootNodeId)!.name=name.trim();data.revision++;}return parseCapturePackage(data);};
  register('rename-screen',(id:unknown,name:unknown)=>{if(captureBusy||!lastCapture||typeof id!=='string'||typeof name!=='string'||!name.trim()||name.length>120)throw Error('请输入 1–120 字符的画面名称');const data=structuredClone(lastCapture);const screen=data.screens.find(screen=>screen.id===id);if(!screen)throw Error('画面不存在');if(screen.name!==name.trim()){screen.name=name.trim();screen.nodes.find(node=>node.id===screen.rootNodeId)!.name=screen.name;data.revision++;}lastCapture=parseCapturePackage(data);return lastCapture;});
  register('edit-text',async(screenId:unknown,nodeId:unknown,characters:unknown)=>{
    if(captureBusy||!lastCapture||typeof screenId!=='string'||typeof nodeId!=='string'||typeof characters!=='string'||characters.length>10000)throw Error('请填写不超过 10000 字的文字。');
    const data=structuredClone(lastCapture),node=data.screens.find(s=>s.id===screenId)?.nodes.find(n=>n.id===nodeId);
    if(!node?.text)throw Error('请先选择一个可编辑文字图层。');node.text.characters=characters;data.revision++;
    const parsed=parseCapturePackage(data),path=join(runtime,'last-capture.json'),previews=lastPreviews.map(p=>({...p,metadata:{...p.metadata,revision:data.revision}}));
    await atomicFile(path,serialize(parsed));await savePreviews(path,previews,parsed);lastCapture=parsed;lastPreviews=previews;lastPreview=previews[0];
    return {data:parsed,path,previews,preview:previews[0]};
  });
  let pairCode:string|undefined;
  register('bridge-status',()=>bridge.snapshot());
  register('bridge-pair',async()=>{const result=await bridge.pairCode();pairCode=result.code;return {...result,endpoint:`http://localhost:${listenPort}`};});
  register('bridge-copy',()=>{if(!pairCode)throw Error('请先生成配对码');clipboard.writeText(pairCode);});
  register('bridge-disconnect',async()=>{pairCode=undefined;await bridge.disconnect();return bridge.snapshot();});
  register('bridge-send',async(name:unknown)=>{if(captureBusy)throw Error('请等待采集完成');const data=namedCapture(name);const job=await bridge.enqueue(data);lastCapture=data;return job;});
  register('capture-send',async(kind:unknown,outputMode:unknown='separate',prepare:unknown=true,autoLayout:unknown=false)=>{
    const before=bridge.snapshot();if(!before.connected||!before.target)throw Error('E_BRIDGE_UNREACHABLE: 请先连接 Figma 插件');
    const result=await capturePage(kind,outputMode,prepare,autoLayout);
    try{const after=bridge.snapshot();if(!after.connected||!after.target||!sameTarget(before.target,after.target))throw Error('E_TARGET_CHANGED: 接收目标已变化，请重新确认连接');return {...result,job:await bridge.enqueue(result.data)};}
    catch(error){return {...result,sendError:error instanceof Error?error.message:String(error)};}
  });
  register('bridge-save-report',async()=>{const report=bridge.lastReport();if(!report)throw Error('尚无已确认的直连导入报告');const result=await dialog.showSaveDialog(window,{title:'保存 Figma 导入报告',defaultPath:`${report.importId}.report.json`,filters:[{name:'JSON',extensions:['json']}]});if(result.canceled||!result.filePath)return null;await writeFile(result.filePath,JSON.stringify(report,null,2));return result.filePath;});
  register('export-capture', async (name: unknown) => {
    if (captureBusy || !lastCapture) throw new Error('请先转换一个区块');
    const data = namedCapture(name);
    const result = await dialog.showSaveDialog(window, { title: '保存真实网页 Figma 转换包', defaultPath: `${data.packageId}.json`, filters: [{ name: 'WebToPrototype JSON', extensions: ['json'] },{name:'WebToPrototype ZIP',extensions:['zip']}] });
    if (result.canceled || !result.filePath) return null;
    await atomicFile(result.filePath,result.filePath.toLowerCase().endsWith('.zip')?encodeCaptureZip(data,bytes=>deflateRawSync(bytes,{level:6})):serialize(data)); lastCapture = data;
    let previewPath:string|undefined,warning:string|undefined;
    try{previewPath=await savePreviews(result.filePath,lastPreviews,data);}catch{warning='转换 JSON 已保存，部分源预览附件保存失败。';}
    return {path:result.filePath,previewPath,warning};
  });
  register('reopen-capture', async () => {
    if (captureBusy) throw new Error('转换进行中，请稍候');
    const result = await dialog.showOpenDialog(window, { title: '打开手机素材或转换包', properties: ['openFile'], filters: [{ name: 'WebToPrototype / 手机素材', extensions: ['json','zip'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const { stat } = await import('node:fs/promises');
    if ((await stat(result.filePaths[0])).size > 64 * 1024 * 1024) throw new Error('E_LIMIT_EXCEEDED: 文件超过64MiB');
    const path=result.filePaths[0],bytes=await readFile(path);
    let data:CapturePackage,previews:SourcePreview[],outputPath=path;
    if(path.toLowerCase().endsWith('.w2pm.zip')||isMobileMaterial(bytes)){
      const imported=await openMobile(path,bytes);data=imported.data;previews=imported.previews;outputPath=imported.path;
    }else{
      data=path.toLowerCase().endsWith('.zip')?await decodeCaptureZip(bytes,async(b,limit)=>new Uint8Array(inflateRawSync(b,{maxOutputLength:Math.max(1,limit)}))):parseCapturePackage(JSON.parse(bytes.toString('utf8')));
      previews=await loadPreviews(path,data);
    }
    lastCapture=data;lastPreviews=previews;
    lastPreview=lastPreviews.find(p=>p.metadata.screenId===data.screens[0].id);
    const expected=data.screens.reduce((sum,screen)=>sum+(lastPreviews.find(image=>image.metadata.screenId===screen.id)?.metadata.segmentCount??1),0);
    return { data, path: outputPath,preview:lastPreview,previews:lastPreviews,previewNotice:lastPreviews.length===expected?undefined:'部分源参考没有匹配的预览附件；仍可正常导入 Figma。' };
  });
  register('mobile-pair',async()=>{await mobileReceiver.stop();const offer=await mobileReceiver.start();mobileOffers=offer.offers;return offer;});
  register('mobile-stop',async()=>{await mobileReceiver.stop();mobileOffers=[];});
  register('mobile-copy',(index:unknown)=>{if(!Number.isInteger(index)||!mobileOffers[Number(index)])throw Error('M_OFFER');clipboard.writeText(mobileOffers[Number(index)].payload);});
  register('mobile-list',()=>mobileReceiver.list());
  register('mobile-status',()=>mobileReceiver.status());
  register('mobile-delete',async(id:unknown)=>{
    const result=await dialog.showMessageBox(window,{type:'question',message:'删除电脑收件箱中的这份手机原始素材？',detail:'已保存的项目和手机原始项目继续保留。',buttons:['保留','删除素材'],defaultId:0,cancelId:0});
    if(result.response===1)await mobileReceiver.remove(id);
  });
  register('mobile-open',async(id:unknown)=>{
    if(captureBusy)throw Error('转换进行中，请稍候');
    const result=await openMobile(await mobileReceiver.path(id));
    lastCapture=result.data;lastPreviews=result.previews;lastPreview=result.preview;
    await workspace.remember(result);return result;
  });
  register('snapshot', async () => {
    const snapshot = await evaluate('window.__w2pProbe.snapshot()');
    const record = { evidenceKind: 'actual_dom_probe', pageEpoch, capturedAt: new Date().toISOString(), viewport: target.getBounds(), snapshot };
    await writeFile(join(runtime, 'last-dom-probe.json'), JSON.stringify(record, null, 2));
    return record;
  });
  register('export-example', async () => {
    const result = await dialog.showSaveDialog(window, { title: '保存人工协议样例', defaultPath: 'figma-m0-probe.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, JSON.stringify(sample, null, 2)); return result.filePath;
  });
  register('info', () => ({ fixtureUrl,url:target.webContents.getURL()||fixtureUrl,bridgeEndpoint:`http://localhost:${listenPort}`, pluginManifest: join(ROOT, 'apps/figma-plugin/dist/manifest.json'), runtime, versions: process.versions }));
  const bridgeTimer=setInterval(()=>void bridge.tick().catch(()=>state({error:'直连任务记录暂不可用，可继续使用文件导入。'})),1000);
  let lastSelectionState='';
  const timer = setInterval(async () => {
    if (captureBusy || target.webContents.isDestroyed()) return;
    try { const selection = await evaluate<{ selected: unknown; enabled: boolean;note?:string }>('window.__w2pProbe.read()');
      const serial=JSON.stringify(selection);if(serial===lastSelectionState)return;lastSelectionState=serial;
      selecting = selection.enabled; state({ selection: selection.selected,selectionNote:selection.note,selectionState:(selection as any).selectionState,selectionMode:(selection as any).selectionState?.mode });
    } catch { selecting = false; }
  }, 300);
  window.on('closed', () => { clearInterval(timer);clearInterval(bridgeTimer);void mobileReceiver.stop(); if (!target.webContents.isDestroyed()) target.webContents.close(); server.close(); app.quit(); });
  // Start the default page before the shell can issue navigation commands.
  // A user replacing that navigation must not make startup terminate the app.
  const initialTarget=startupNavigation=target.webContents.loadURL(fixtureUrl).catch(error=>{if(error?.code!=='ERR_ABORTED')throw error;});
  await window.loadFile(join(__dirname, 'index.html'));
  await initialTarget;
  state({loading:target.webContents.isLoading()});
}).catch(error => { console.error(error);if(process.env.W2P_SMOKE!=='1')dialog.showErrorBox('WebToPrototype 未启动',error?.code==='EADDRINUSE'?'本机43821端口已被其他程序占用。关闭占用程序后重试；不会改为外网服务。':String(error)); if (server) server.close(); app.exit(1); });
app.on('window-all-closed', () => app.quit());

