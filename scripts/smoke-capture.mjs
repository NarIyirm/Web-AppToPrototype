import { _electron as electron } from 'playwright';
import {waitForShell} from './electron-shell.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const stamp = new Date().toISOString().replace(/[.:]/g,'-');
const evidence = resolve('evidence/2026-10-19/M1-functional', stamp);
await mkdir(evidence,{recursive:true});
const env = {...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/capture-smoke')}; delete env.ELECTRON_RUN_AS_NODE;
const application = await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000});
const checks=[];
try {
  const shell=await waitForShell(application);
  let target=application.windows().find(page=>page.url().includes('/fixture'));
  if(!target) target=await application.waitForEvent('window',{predicate:page=>page.url().includes('/fixture')});
  await target.waitForSelector('#orders img'); await target.locator('#orders img').evaluate(img=>img.decode());
  await shell.locator('#section').click();
  await target.locator('#orders h2').click();
  await shell.waitForFunction(()=>document.querySelector('#output')?.textContent?.includes('"id": "orders"'));
  await shell.getByRole('button',{name:'预览转换',exact:true}).click();
  await shell.waitForFunction(()=>!document.querySelector('#save').disabled,{},{timeout:30000});
  const info=await shell.evaluate(()=>window.w2p.info());
  const data=JSON.parse(await readFile(resolve(info.runtime,'last-capture.json'),'utf8'));
  const nodes=data.screens[0].nodes;
  checks.push({check:'actual-section-not-example',ok:data.artifactKind==='capture'&&nodes[0].name==='section #orders'});
  const texts=nodes.filter(node=>node.type==='TEXT').map(node=>node.text.characters).join('\n');
  checks.push({check:'native-Chinese-English-text-once',ok:texts.includes('English')&&texts.includes('订单列表')&&texts.split('订单列表').length===2});
  checks.push({check:'button-text-is-native',ok:nodes.some(node=>node.type==='TEXT'&&node.text.characters==='打开详情')});
  checks.push({check:'image-is-contained-and-hashed',ok:data.assets.length===1&&data.assets[0].sha256.length===64&&nodes.some(node=>node.type==='IMAGE'&&node.assetId===data.assets[0].assetId)});
  checks.push({check:'native-frame-style',ok:nodes[0].style.radii[0]===12&&nodes[0].style.fills.length===1});
  const rows=nodes.filter(node=>node.type==='FRAME'&&node.name==='div');
  const rowBorders=rows.map(row=>({row,edges:nodes.filter(node=>node.parentId===row.id&&node.name.startsWith('边框 / '))}));
  checks.push({check:'order-rows-have-bottom-border-only',ok:rowBorders.length===2&&rowBorders.every(({row,edges})=>!row.style.border&&edges.length===1&&edges[0].name==='边框 / bottom'&&edges[0].type==='SHAPE'&&edges[0].rect.x===0&&edges[0].rect.width===row.rect.width&&edges[0].rect.height===1&&Math.abs(edges[0].rect.y-(row.rect.height-1))<.001&&edges[0].style.fills[0].color.r===236/255)&&!data.warnings.some(w=>w.code==='W_BORDER_APPROXIMATED')});
  checks.push({check:'uniform-section-border-preserved',ok:nodes[0].style.border?.width===1});
  const geometry=await target.locator('#orders').evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x+scrollX,y:r.y+scrollY}});
  const rect=data.screens[0].selection.originalRect;
  checks.push({check:'CSS-pixel-geometry',ok:['width','height','x','y'].every(key=>Math.abs(geometry[key]-rect[key])<.01)});
  // Exercise export/reopen through the real IPC handlers with deterministic save/open paths.
  // Only the native file chooser is replaced; package writing/validation and UI are unchanged.
  const exported=resolve(evidence,'capture.json');
  await application.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},exported);
  await shell.locator('#capture-name').fill('订单区块验收'); await shell.getByRole('button',{name:'保存转换文件',exact:true}).click();
  await shell.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('真实网页转换包已保存'));
  const saved=JSON.parse(await readFile(exported,'utf8'));
  checks.push({check:'file-export-and-name',ok:saved.screens[0].name==='订单区块验收'&&saved.packageId===data.packageId});
  await shell.getByRole('button',{name:'重开转换包',exact:true}).click();
  await shell.waitForFunction(()=>document.querySelector('#capture-name')?.value==='订单区块验收');
  checks.push({check:'reopen-valid-package',ok:true});
  await target.screenshot({path:resolve(evidence,'source.png')});
  // Prove an ordinary independent HTTP demo (separate origin/port) is captured, including JPEG.
  const {createServer}=await import('node:http'); const {once}=await import('node:events');
  const jpeg=await application.evaluate(({nativeImage},base64)=>nativeImage.createFromBuffer(Buffer.from(base64,'base64')).toJPEG(90).toString('base64'),data.assets[0].inlineBase64);
  const external=createServer((req,res)=>{if(req.url.startsWith('/photo')){res.setHeader('Content-Type','image/jpeg');res.end(Buffer.from(jpeg,'base64'));return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<section id="demo" style="margin:24px;padding:20px;background:#eee;border-radius:8px"><h2>Independent demo 2026</h2><p>外部本地站点</p><span style="display:contents">Contents text</span><img src="/photo.jpg" width="50" height="50"><div id="edges" style="width:120px;height:50px;border-top:2px solid #f00;border-right:3px solid #0f0;border-bottom:4px solid #00f;border-left:5px solid #222"></div><div id="no-border" style="width:20px;height:20px;border:none"></div></section>');});
  external.listen(0,'127.0.0.1');await once(external,'listening');
  try {
    const url=`http://127.0.0.1:${external.address().port}/?secret=do-not-export#test`;
    await shell.evaluate(url=>window.w2p.navigate(url),url); await target.waitForSelector('#demo img'); await target.locator('img').evaluate(img=>img.decode());
    await shell.locator('#section').click();await target.locator('h2').click();
    await shell.waitForFunction(()=>document.querySelector('#output')?.textContent?.includes('"id": "demo"'));
    const result=await shell.evaluate(()=>window.w2p.capture());
    checks.push({check:'independent-demo-with-JPEG-and-redacted-source',ok:result.data.assets[0]?.mime==='image/jpeg'&&!result.data.source.url.includes('secret')&&result.data.screens[0].nodes.some(n=>n.text?.characters==='Independent demo 2026')&&result.data.screens[0].nodes.some(n=>n.text?.characters==='Contents text')});
    const independentNodes=result.data.screens[0].nodes;
    const frame=independentNodes.find(n=>n.name==='div #edges');
    const edges=independentNodes.filter(n=>n.parentId===frame?.id);
    const expected=[['top',2,{r:1,g:0,b:0,a:1}],['right',3,{r:0,g:1,b:0,a:1}],['bottom',4,{r:0,g:0,b:1,a:1}],['left',5,{r:34/255,g:34/255,b:34/255,a:1}]];
    checks.push({check:'independent-edge-widths-and-colors',ok:!!frame&&!frame.style.border&&edges.length===4&&expected.every(([side,width,color])=>{const edge=edges.find(n=>n.name===`边框 / ${side}`);return edge&&(side==='top'||side==='bottom'?edge.rect.height:edge.rect.width)===width&&Object.keys(color).every(key=>edge.style.fills[0].color[key]===color[key]);})});
    const noBorder=independentNodes.find(n=>n.name==='div #no-border');
    checks.push({check:'no-border-does-not-create-strokes',ok:!!noBorder&&!noBorder.style.border&&!independentNodes.some(n=>n.parentId===noBorder.id&&n.name.startsWith('边框 / '))});
    await writeFile(resolve(evidence,'independent-capture.json'),JSON.stringify(result.data,null,2));
  } finally {await new Promise(resolve=>external.close(resolve));}
  await writeFile(resolve(evidence,'report.json'),JSON.stringify({evidenceKind:'actual_electron_functional',at:new Date().toISOString(),figmaTested:false,stabilityTested:false,fileDialog:'stubbed; real IPC, serializer and disk writes',checks},null,2));
  console.log(JSON.stringify({evidence,checks},null,2));if(checks.some(check=>!check.ok))throw Error('Functional checks failed');
}finally{await application.close();}
