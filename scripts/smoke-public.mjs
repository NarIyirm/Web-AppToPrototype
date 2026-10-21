import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const url=process.env.W2P_PUBLIC_URL??'https://example.com/';
if(new URL(url).protocol!=='https:'||new URL(url).username||new URL(url).password)throw Error('Public smoke requires HTTPS without embedded credentials');
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-public',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/public-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='';app.process().stderr.on('data',v=>stderr=(stderr+v).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details?{details}:{}});if(!ok)throw Error(name);};
try{
  const shell=await waitForShell(app);let target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),url);await target.waitForSelector('body');
  check('public-HTTPS-opens-in-existing-browser',target.url().startsWith('https://'));
  const prefs=await app.evaluate(({webContents})=>{const page=webContents.getAllWebContents().find(c=>c.getURL().startsWith('https://'));const p=page.getLastWebPreferences();return {sandbox:p.sandbox,webSecurity:p.webSecurity,nodeIntegration:p.nodeIntegration,contextIsolation:p.contextIsolation};});
  check('public-page-keeps-browser-isolation',prefs.sandbox&&prefs.webSecurity&&!prefs.nodeIntegration&&prefs.contextIsolation,prefs);
  const viewport=await shell.evaluate(()=>window.w2p.capture('viewport'));await writeFile(resolve(folder,'public-viewport.json'),JSON.stringify(viewport.data,null,2));
  check('public-viewport-converts-real-native-text',viewport.data.artifactKind==='capture'&&viewport.data.screens[0].selection.mode==='viewport'&&viewport.data.screens[0].nodes.some(n=>n.type==='TEXT'&&n.text.characters.trim()));
  const full=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false));await writeFile(resolve(folder,'public-full-page.json'),JSON.stringify(full.data,null,2));
  check('public-full-page-converts-loaded-document',full.data.source.url.startsWith('https://')&&full.data.screens[0].selection.mode==='full_page'&&full.data.screens[0].nodes.some(n=>n.type==='TEXT'));
  check('public-package-is-self-contained',full.data.assets.every(a=>!!a.inlineBase64&&!a.path));
  const heading=target.locator('h1,h2,p').first();await shell.locator('#section').click();await heading.click();await shell.waitForFunction(()=>document.querySelector('#selection-list li'),null,{timeout:15000});
  const selected=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'public-selection.json'),JSON.stringify(selected.data,null,2));check('public-element-selection-converts-native-frame',selected.data.screens[0].selection.mode==='element'&&selected.data.screens[0].nodes[0].type==='FRAME');
  let rejected=false;try{await shell.evaluate(()=>window.w2p.navigate('http://example.com/'));}catch(error){rejected=String(error).includes('HTTPS');}check('plaintext-public-HTTP-is-explicitly-rejected',rejected);
  await target.screenshot({path:resolve(folder,'public-source.png'),fullPage:true,scale:'css'});
  const safe=new URL(target.url());safe.search='';safe.hash='';
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-public-HTTPS-check',figmaTested:false,url:safe.href,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}finally{await app.close();}
