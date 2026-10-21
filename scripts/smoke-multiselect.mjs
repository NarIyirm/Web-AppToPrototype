import {_electron as electron} from 'playwright';
import {waitForShell} from './electron-shell.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-multiselect',stamp);await mkdir(folder,{recursive:true});
const probe=JSON.parse(await readFile('examples/figma-m0-probe.json','utf8'));
const html=`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#202128;font:15px/1.6 Arial,"Microsoft YaHei",sans-serif}header{padding:22px 24px;background:white;border-bottom:1px solid #ddd}header span{font-size:12px;color:#555}h1{margin:5px 0;font-size:28px}main{margin:20px;padding:16px;display:flex;gap:24px;max-width:780px}section{width:320px;flex:1;background:white;border:1px solid #ddd;border-radius:10px;padding:20px}h2{font-size:21px;margin:0 0 12px}p{margin:10px 0}button{padding:9px 15px;background:#a0204b;color:white;border:0;border-radius:5px}img{display:block;margin-top:18px;width:40px;height:40px}#remove{background:#f9ecef;padding:10px}#outside{margin:20px;color:#555}</style></head><body><header><span>产品工作台</span><h1>为下一次交接做好准备</h1></header><main id="collection"><section id="alpha"><h2>订单列表</h2><p id="remove">REMOVE THIS CHILD</p><p id="keep">保留原位置 Keep position</p><button id="action">查看订单</button><img src="data:image/png;base64,${probe.assets[0].inlineBase64}"></section><section id="beta"><h2>项目进度</h2><p>Beta native text</p><img src="data:image/png;base64,${probe.assets[0].inlineBase64}"></section></main><p id="outside">UNSELECTED PAGE CONTENT</p><script>window.clicked=0;document.querySelector('button').onclick=()=>window.clicked++</script></body></html>`;
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});server.listen(0,'127.0.0.1');await once(server,'listening');
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/multiselect-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
let app,shell,target;const checks=[];let stderr='',failure;
const check=(name,value)=>{checks.push({check:name,ok:!!value});if(!value)throw Error(name);};
async function waitCount(count){await shell.waitForFunction(count=>document.querySelectorAll('#selection-list li').length===count,count,{timeout:12000});}
async function preview(output='separate'){
 await shell.locator('#tab-selection').click();if(output==='merged'||await shell.locator('#output-options').isVisible())await shell.locator('#output-mode').selectOption(output);
 const before=await shell.evaluate(()=>window.w2p.info()).then(async info=>{try{return JSON.parse(await readFile(resolve(info.runtime,'last-capture.json'),'utf8')).packageId;}catch{return '';}});
 await shell.locator('#capture').click();await shell.waitForFunction(old=>{const text=document.querySelector('#capture-output').textContent;return document.querySelector('#tab-result').getAttribute('aria-selected')==='true'&&text&&!text.includes(old||'NO_OLD_PACKAGE');},before,{timeout:30000});
 const info=await shell.evaluate(()=>window.w2p.info());return JSON.parse(await readFile(resolve(info.runtime,'last-capture.json'),'utf8'));
}
try{
 app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000});app.process().stderr.on('data',chunk=>stderr=(stderr+chunk.toString()).slice(-4000));shell=await waitForShell(app);await shell.waitForFunction(()=>document.querySelector('#url')?.value.includes('/fixture'));
 target=app.windows().find(p=>p.url().includes('/fixture'));await target.waitForSelector('#orders');
 await shell.evaluate(url=>window.w2p.navigate(url),`http://127.0.0.1:${server.address().port}/multi`);await target.waitForSelector('#alpha');await target.locator('img').first().evaluate(img=>img.decode());
 check('first-use-empty-state-and-disabled-actions',await shell.locator('#selection-empty').isVisible()&&await shell.locator('#capture').isDisabled()&&await shell.locator('#capture-send').isDisabled());
 const contrast=await shell.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});};const luminance=color=>rgb(color).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const css=getComputedStyle(document.documentElement);return [['--ink','--bg'],['--muted','--bg'],['--primary','--selected']].map(([text,bg])=>{const a=luminance(css.getPropertyValue(text)),b=luminance(css.getPropertyValue(bg));return {text,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});});
 check('body-muted-and-selected-text-meet-contrast',contrast.every(pair=>pair.ratio>=4.5));await writeFile(resolve(folder,'contrast.json'),JSON.stringify(contrast,null,2));
 await shell.locator('#help-toggle').click();check('on-demand-three-step-help',await shell.locator('#guide').isVisible()&&(await shell.locator('#guide li').count())===3);await shell.locator('#help-toggle').click();
 await shell.screenshot({path:resolve(folder,'empty-shell.png')});
 await shell.locator('#section').click();await target.locator('#alpha h2').click();await waitCount(1);
 await shell.locator('#multiple').check();await target.locator('#beta h2').click();await waitCount(2);
 check('continuous-section-selection-is-visible-in-list',await shell.locator('#multiple').isChecked()&&(await shell.locator('#selection-count').textContent())==='2');
 await shell.locator('#select').click();await target.locator('#keep').click();await waitCount(2);check('descendant-is-not-added-twice',(await shell.locator('#selection-list li').count())===2);
 await target.locator('#collection').click({position:{x:5,y:5}});await waitCount(1);check('ancestor-replaces-contained-selections',(await shell.locator('#output').textContent()).includes('collection'));
 await target.locator('#collection').click({position:{x:5,y:5}});await waitCount(0);check('repeat-click-removes-selection',true);
 await shell.locator('#section').click();await target.locator('#alpha h2').click();await target.locator('#beta h2').click();await waitCount(2);
 await shell.locator('#multiple').uncheck();await waitCount(2);check('ending-multi-select-preserves-existing-items',await shell.locator('#multiple').isChecked()===false);
 await shell.locator('#exclude').click();await target.locator('#remove').click();await shell.waitForFunction(()=>document.querySelectorAll('#excluded-list li').length===1);
 const before=await target.locator('#keep').evaluate(node=>{const box=node.getBoundingClientRect();const root=node.closest('section').getBoundingClientRect();return {x:box.x-root.x,y:box.y-root.y};});
 check('exclusion-does-not-mutate-source-page',(await target.locator('#remove').count())===1&&await target.evaluate(()=>window.clicked===0));
 const separate=await preview();await writeFile(resolve(folder,'separate.json'),JSON.stringify(separate,null,2));
 check('independent-output-has-two-real-screens',separate.artifactKind==='capture'&&separate.screens.length===2&&separate.screens.every(s=>s.nodes[0].rect.x===0&&s.nodes[0].rect.y===0));
 const text=separate.screens.flatMap(s=>s.nodes.filter(n=>n.text).map(n=>n.text.characters)).join('|');
 check('exclusion-removes-subtree-and-unselected-content',!text.includes('REMOVE THIS')&&!text.includes('UNSELECTED')&&text.split('Beta native text').length===2&&separate.screens[0].selection.excludedSourceNodeIds.length===1);
 const frame=separate.screens[0].nodes.find(n=>n.name==='p #keep');check('remaining-content-keeps-original-position',Math.abs(frame.rect.x-before.x)<.01&&Math.abs(frame.rect.y-before.y)<.01);
 check('batch-assets-are-deduplicated',separate.assets.length===1&&separate.screens.every(s=>s.nodes.some(n=>n.type==='IMAGE'&&n.assetId===separate.assets[0].assetId)));
 check('result-tab-offers-screen-selector',(await shell.locator('#result-screen option').count())===2&&await shell.locator('#result-panel').isVisible());
 await shell.locator('#tab-result').focus();await shell.keyboard.press('ArrowLeft');const left=await shell.locator('#selection-panel').isVisible();await shell.keyboard.press('ArrowRight');check('workbench-tabs-support-keyboard',left&&await shell.locator('#result-panel').isVisible());
 await shell.locator('#result-screen').selectOption('screen-2');await shell.locator('#capture-name').fill('项目进度 · 交接');await shell.locator('#capture-name').blur();await shell.waitForFunction(()=>document.querySelector('#result-screen option[value="screen-2"]').textContent==='项目进度 · 交接');
 const path=resolve(folder,'saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},path);
 await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'));
 const saved=JSON.parse(await readFile(path,'utf8'));check('screen-renaming-preserves-other-screen',saved.screens[0].name===separate.screens[0].name&&saved.screens[1].name==='项目进度 · 交接');
 const preview2=JSON.parse(await readFile(`${path}.screen-2.preview.json`,'utf8'));check('preview-sidecars-follow-each-screen',preview2.screenId==='screen-2'&&preview2.revision===saved.revision&&(await readFile(`${path}.preview.png`)).length>0);
 await shell.locator('#reopen').click();await shell.locator('#result-screen').selectOption('screen-2');check('reopened-batch-restores-second-preview',await shell.locator('#source-preview').isVisible());
 const merged=await preview('merged');await writeFile(resolve(folder,'merged.json'),JSON.stringify(merged,null,2));
 const alpha=merged.screens[0].nodes.find(n=>n.name==='section #alpha'),beta=merged.screens[0].nodes.find(n=>n.name==='section #beta');
 const sourceRects=await target.evaluate(()=>['alpha','beta'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 check('merged-output-keeps-original-gap-and-position',merged.screens.length===1&&alpha.parentId===beta.parentId&&Math.abs((beta.rect.x-alpha.rect.x)-(sourceRects[1].x-sourceRects[0].x))<.01);
 check('merged-references-and-exclusions-remain-valid',new Set(merged.screens[0].nodes.map(n=>n.id)).size===merged.screens[0].nodes.length&&!merged.screens[0].nodes.some(n=>n.text?.characters.includes('REMOVE THIS'))&&merged.screens[0].selection.sourceNodeIds.length===2);
 await shell.locator('#tab-selection').click();await shell.locator('#excluded-list button').click();await shell.waitForFunction(()=>document.querySelectorAll('#excluded-list li').length===0);
 const restored=await preview('separate');check('restoring-excluded-item-restores-native-text',restored.screens[0].nodes.some(n=>n.text?.characters==='REMOVE THIS CHILD'));
 // Save full-window chrome and source separately; shell capture excludes native WebContentsView pixels.
 await shell.locator('#tab-selection').click();await shell.locator('aside').screenshot({path:resolve(folder,'workbench-wide.png')});await target.screenshot({path:resolve(folder,'source.png')});await shell.screenshot({path:resolve(folder,'shell-wide.png')});
 for(const [width,height] of [[1320,860],[1000,650]]){
   const size=await app.evaluate(({BrowserWindow},size)=>{const win=BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().startsWith('file:'));win.setSize(...size);return win.getContentSize();},[width,height]);
   await shell.waitForFunction(size=>innerWidth===size[0]&&innerHeight===size[1],size);
   const overflow=await shell.evaluate(()=>{const selectors=['header','nav','aside','.panel-actions'];return selectors.map(selector=>{const e=document.querySelector(selector);return {selector,overflow:e.scrollWidth-e.clientWidth};});});
   check(`workbench-has-no-horizontal-overflow-at-${width}`,overflow.every(e=>e.overflow<=1));
   check(`primary-actions-visible-without-scrolling-at-${width}`,await shell.locator('#capture').isVisible()&&await shell.locator('#capture-send').isVisible()&&await shell.locator('#capture-send').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight-32;}));
   if(width===1000){await shell.locator('aside').screenshot({path:resolve(folder,'workbench-compact.png')});await shell.screenshot({path:resolve(folder,'shell-compact.png')});}
 }
 await target.evaluate(()=>document.querySelector('#beta').remove());await shell.waitForFunction(()=>document.querySelector('#selection-list').textContent.includes('已变化'));
 check('stale-selected-node-blocks-capture',await shell.locator('#capture').isDisabled()&&await shell.evaluate(()=>window.w2p.capture().then(()=>false,error=>error.message.includes('E_SELECTION_STALE'))));
 await shell.locator('#selection-list button').last().click();await waitCount(1);check('removing-stale-item-restores-capture',await shell.locator('#capture').isEnabled());
 await shell.locator('#clear-selection').click();await waitCount(0);check('clear-selection-restores-empty-state',await shell.locator('#selection-empty').isVisible()&&await shell.locator('#capture').isDisabled());
 await shell.locator('#send-kind').selectOption('viewport');await shell.locator('#capture').click();await shell.waitForFunction(()=>document.querySelector('#capture-output').textContent.includes('"mode": "viewport"'));check('viewport-still-works-without-selection',await shell.locator('#result-panel').isVisible());
}catch(error){failure=String(error);console.error(stderr);throw error;}finally{
 await writeFile(resolve(folder,'report.json'),JSON.stringify({at:new Date().toISOString(),evidenceKind:'actual_electron_multiselect_and_workbench',figmaTested:false,nativeFilePickers:'stubbed; real IPC and disk operations',failure,checks},null,2));
 if(app)await app.close();await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({folder,checks},null,2));
