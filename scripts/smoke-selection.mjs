import {_electron as electron} from 'playwright';
import {waitForShell} from './electron-shell.mjs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const folder=resolve('evidence/2026-10-19/M2-selection',new Date().toISOString().replace(/[.:]/g,'-'));await mkdir(folder,{recursive:true});
const html=`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;height:1800px;background:#f3f5f7;font:16px/24px Arial}button{position:absolute;left:80px;top:160px;width:180px;height:60px;background:#a0204b;color:white;border:0;border-radius:8px;font:inherit}#partial-text{position:absolute;left:100px;top:340px;margin:0;width:320px;height:24px;white-space:nowrap}#fixed{position:fixed;left:0;top:0;background:white}#scroller{position:absolute;left:600px;top:80px;width:220px;height:120px;overflow:hidden}#scroller p{margin-top:400px}#below{position:absolute;left:10px;top:1600px}</style></head><body><div id="fixed">FIXED HEADER</div><button id="action">Editable action</button><p id="partial-text">Keep this full editable text</p><div id="scroller"><p>HIDDEN OUTSIDE SCROLLER</p></div><p id="below">BELOW VIEWPORT</p><script>window.clickCount=0;document.querySelector('button').onclick=()=>window.clickCount++</script></body></html>`;
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});server.listen(0,'127.0.0.1');await once(server,'listening');
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/selection-smoke')};delete env.ELECTRON_RUN_AS_NODE;
let application;const checks=[];let stderr='';
const check=(name,ok)=>{checks.push({check:name,ok:!!ok});if(!ok)throw Error(name);};
try{
  application=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000});application.process().stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-6000);});const shell=await waitForShell(application);
  await shell.waitForFunction(()=>document.querySelector('#url')?.value.includes('/fixture'));
  const initial=application.windows().find(page=>page.url().includes('/fixture'));if(initial)await initial.waitForSelector('#orders');
  await shell.evaluate(url=>window.w2p.navigate(url),`http://127.0.0.1:${server.address().port}/demo`);
  const target=application.windows().find(page=>page.url().endsWith('/demo'));if(!target)throw Error('target missing');
  await target.waitForSelector('#action');
  async function capture(kind='selection',name='capture'){
    const result=await shell.evaluate(kind=>window.w2p.capture(kind),kind);
    await writeFile(resolve(folder,`${name}.json`),JSON.stringify(result.data,null,2));
    if(result.preview)await writeFile(resolve(folder,`${name}.png`),Buffer.from(result.preview.dataUrl.split(',')[1],'base64'));
    return result;
  }
  async function drag(from,to,policy='strict'){
    await shell.getByRole('button',{name:'自由框选',exact:true}).click();
    await shell.locator('#boundary').selectOption(policy);
    await target.mouse.move(...from);await target.mouse.down();await target.mouse.move(...to,{steps:8});await target.mouse.up();
    await shell.waitForFunction(()=>document.querySelector('#output')?.textContent?.includes('"kind": "rectangle"'));
  }
  const viewport=await capture('viewport','viewport');const size=await target.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight}));
  check('viewport-has-exact-CSS-size-and-clips',viewport.data.screens[0].nodes[0].rect.width===size.width&&viewport.data.screens[0].nodes[0].rect.height===size.height&&viewport.data.screens[0].nodes[0].clipsContent);
  check('viewport-includes-native-text-excludes-hidden-content',viewport.data.screens[0].nodes.some(n=>n.text?.characters==='Editable action')&&!viewport.data.screens[0].nodes.some(n=>n.text?.characters.includes('BELOW VIEWPORT')||n.text?.characters.includes('HIDDEN OUTSIDE')));
  check('source-preview-is-separate-from-assets',!!viewport.preview&&viewport.preview.metadata.frameRect.width===size.width&&viewport.data.assets.length===0);
  await drag([180,342],[270,360]);const strict=await capture('selection','strict');const root=strict.data.screens[0].nodes[0];
  check('strict-rectangle-keeps-requested-size',root.rect.width===90&&root.rect.height===18&&strict.data.screens[0].selection.boundaryPolicy==='strict'&&strict.data.screens[0].selection.originalRect.x===180);
  check('strict-rectangle-preserves-complete-editable-text',strict.data.screens[0].nodes.some(n=>n.type==='TEXT'&&n.text.characters==='Keep this full editable text'));
  check('strict-preview-uses-the-crop',!!strict.preview&&Math.abs(strict.preview.metadata.pixelWidth-90)<=1&&Math.abs(strict.preview.metadata.pixelHeight-18)<=1);
  await drag([100,170],[120,190],'complete_elements');const complete=await capture('selection','complete');
  check('complete-elements-expands-to-the-whole-button',complete.data.screens[0].selection.originalRect.x===80&&complete.data.screens[0].selection.originalRect.y===160&&complete.data.screens[0].nodes[0].rect.width===180&&complete.data.screens[0].nodes[0].rect.height===60&&complete.preview?.metadata.requestedRect.width===20);
  check('rectangle-does-not-click-the-page',await target.evaluate(()=>window.clickCount===0));
  await drag([610,485],[630,495],'complete_elements');const clipped=await capture('selection','complete-clipped');
  check('complete-elements-respects-existing-overflow-clip',clipped.data.screens[0].nodes[0].rect.width===20&&clipped.data.screens[0].nodes[0].rect.height===10&&!clipped.data.screens[0].nodes.some(n=>n.text?.characters.includes('HIDDEN OUTSIDE')));
  await drag([250,215],[90,165]);const reverse=await capture('selection','reverse');check('reverse-drag-is-normalized',reverse.data.screens[0].nodes[0].rect.width===160&&reverse.data.screens[0].nodes[0].rect.height===50);
  await shell.getByRole('button',{name:'自由框选',exact:true}).click();await target.mouse.move(100,170);await target.mouse.down();await target.mouse.move(130,190);await target.keyboard.press('Escape');await target.mouse.up();
  await shell.waitForFunction(()=>document.querySelector('#rectangle')?.getAttribute('aria-pressed')==='false');
  const afterCancel=await shell.evaluate(()=>window.w2p.capture().then(()=>false,()=>true));check('Escape-cancels-unfinished-rectangle',afterCancel);
  await target.evaluate(()=>scrollTo(0,500));const scrolled=await capture('viewport','scrolled');check('viewport-records-scroll-and-fixed-content',scrolled.data.screens[0].selection.originalRect.y===500&&scrolled.data.screens[0].nodes.some(n=>n.text?.characters==='FIXED HEADER'));
  await target.evaluate(()=>scrollTo(0,0));
  await application.evaluate(({webContents})=>webContents.getAllWebContents().find(c=>c.getURL().endsWith('/demo')).setZoomFactor(1.25));
  await drag([100,170],[140,190]);const zoomed=await capture('selection','zoomed');
  check('zoom-preserves-CSS-geometry-and-preview-scale',zoomed.data.screens[0].nodes[0].rect.width===40&&zoomed.data.source.captureContext.zoomFactor===1.25&&Math.abs(zoomed.preview.metadata.pixelWidth-50)<=1);
  await application.evaluate(({webContents})=>webContents.getAllWebContents().find(c=>c.getURL().endsWith('/demo')).setZoomFactor(1));
  // Exercise the real UI and real serializer; replace only native file pickers.
  await shell.getByText('诊断与文件工具',{exact:true}).click();await shell.getByRole('button',{name:'转换当前视口',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('#capture-output')?.textContent?.includes('"mode": "viewport"')&&!document.querySelector('#save').disabled);
  check('preview-panel-shows-current-source',await shell.locator('#source-preview').isVisible());
  const path=resolve(folder,'saved.json');await application.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},path);
  await shell.getByRole('button',{name:'保存转换文件',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('真实网页转换包已保存'));
  const metadata=JSON.parse(await readFile(`${path}.preview.json`,'utf8'));check('preview-sidecars-saved',!!metadata.sha256&&(await readFile(`${path}.preview.png`)).length>0);
  await shell.getByRole('button',{name:'重开转换包',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('#preview-caption')?.textContent?.includes('源截图'));check('preview-restored-with-matching-package',await shell.locator('#source-preview').isVisible());
  await writeFile(`${path}.preview.json`,JSON.stringify({...metadata,packageId:'wrong-package'}));await shell.getByRole('button',{name:'重开转换包',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('#source-preview')?.hidden);
  check('mismatched-preview-is-rejected',await shell.locator('#preview-caption').textContent().then(text=>text.includes('没有匹配')));await writeFile(`${path}.preview.json`,JSON.stringify(metadata,null,2));
  await shell.getByRole('button',{name:'重开转换包',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('#source-preview')?.hidden===false);
  await shell.screenshot({path:resolve(folder,'shell.png')});
}catch(error){console.error(stderr);throw error;}finally{
  await writeFile(resolve(folder,'report.json'),JSON.stringify({at:new Date().toISOString(),evidenceKind:'actual_electron_selection',figmaTested:false,finalManualAcceptance:false,nativeFilePicker:'stubbed; real IPC and disk IO',checks},null,2));
  if(application)await application.close();await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({folder,checks},null,2));
