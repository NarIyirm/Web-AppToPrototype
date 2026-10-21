import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {waitForShell} from './electron-shell.mjs';
const module=await build({entryPoints:['packages/contracts/src/svg.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {svgForSize}=await import('data:text/javascript;base64,'+Buffer.from(module.outputFiles[0].text).toString('base64'));
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-svg',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/svg-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='',shell,target;
app.process().stderr.on('data',value=>stderr=(stderr+value).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details!==undefined?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  shell=await waitForShell(app);const info=await shell.evaluate(()=>window.w2p.info());target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-svg'));await target.waitForSelector('#stroke-icon');await target.waitForFunction(()=>[...document.images].every(i=>i.complete));
  const result=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false)),data=result.data,nodes=data.screens[0].nodes;
  await writeFile(resolve(folder,'svg-full-page.json'),JSON.stringify(data,null,2));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const descendants=id=>{const ids=new Set([source(id)?.id]);let previous;do{previous=ids.size;for(const n of nodes)if(ids.has(n.parentId))ids.add(n.id);}while(previous!==ids.size);return nodes.filter(n=>ids.has(n.id));};
  const vectors=id=>descendants(id).filter(n=>n.type==='VECTOR');
  check('real-m2.9-capture-declares-svg-capability',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&data.schemaVersion==='1.0.0'&&data.requiredCapabilities.includes('inline-svg'));
  check('svg-page-remains-native-and-self-contained',data.assets.length===0&&nodes.some(n=>n.text?.characters.includes('SVG_PAGE_END'))&&nodes.filter(n=>n.type==='VECTOR').length===14,nodes.filter(n=>n.type==='VECTOR').map(n=>({name:n.name,rect:n.rect})));
  for(const id of ['stroke-icon','css-icon','sprite-red','sprite-blue','viewbox-icon','group-icon','paint-icon','external-svg','background-svg','clipped-icon','data-svg','fill-svg','base64-svg','visible-svg'])check(id+'-produces-native-vector',vectors(id).length===1&&vectors(id)[0].fidelity==='native');
  check('computed-currentColor-is-frozen',/stroke="rgb\(160, 32, 75\)"/.test(vectors('stroke-icon')[0].svg));
  check('stylesheet-paint-is-frozen',/fill="rgb\(213, 159, 38\)"/.test(vectors('css-icon')[0].svg)&&/stroke="rgb\(38, 61, 121\)"/.test(vectors('css-icon')[0].svg));
  check('sprite-instances-expand-with-independent-currentColor',['sprite-red','sprite-blue'].every(id=>!/<use|<symbol/.test(vectors(id)[0].svg))&&vectors('sprite-red')[0].svg.includes('rgb(196, 48, 72)')&&vectors('sprite-blue')[0].svg.includes('rgb(45, 85, 190)'));
  check('nonzero-viewBox-and-native-size-survive',vectors('viewbox-icon')[0].svg.includes('viewBox="10 20 80 40"')&&vectors('viewbox-icon')[0].rect.width===200&&vectors('viewbox-icon')[0].rect.height===100);
  check('group-opacity-and-internal-transform-survive',/opacity="0.5"/.test(vectors('group-icon')[0].svg)&&vectors('group-icon')[0].svg.includes('matrix(1, 0, 0, 1, 10, 10)'));
  check('local-gradient-and-clipping-remain-self-contained',vectors('paint-icon')[0].svg.includes('url(#svg-ink)')&&vectors('paint-icon')[0].svg.includes('url(#svg-cut)'));
  check('external-SVG-cover-retains-native-image-clip',vectors('external-svg')[0].rect.width===178&&vectors('external-svg')[0].rect.height===89&&nodes.find(n=>n.id===vectors('external-svg')[0].parentId).clipsContent,vectors('external-svg')[0].rect);
  check('SVG-background-keeps-native-text-separate',descendants('background-svg').some(n=>n.type==='TEXT'&&n.text.characters==='此行仍为原生文字'));
  check('visible-SVG-viewport-does-not-add-implicit-clipping',vectors('visible-svg')[0].clipsContent===false&&vectors('visible-svg')[0].svg.includes('overflow="visible"'));
  check('cached-SVG-fill-negotiates-its-own-viewport-and-preserves-viewBox',vectors('fill-svg')[0].rect.width===160&&vectors('fill-svg')[0].rect.height===100&&vectors('fill-svg')[0].svg.includes('height="100"'));
  check('standalone-stylesheet-SVG-has-explicit-degradation',vectors('styled-data-svg').length===0&&data.warnings.some(w=>w.code==='W_SVG_UNSUPPORTED'&&descendants('styled-data-svg').some(n=>n.id===w.nodeId)));
  check('cached-SVG-repeat-is-checked-at-each-placement',vectors('repeated-svg').length===0&&data.warnings.some(w=>w.nodeId===source('repeated-svg').id&&w.code==='W_BACKGROUND_UNSUPPORTED'));
  for(const id of ['filtered-svg','text-svg','external-use-svg'])check(id+'-explicitly-degrades-without-rasterization',vectors(id).length===0&&data.warnings.some(w=>w.nodeId===source(id).id&&w.code==='W_SVG_UNSUPPORTED'));
  const pixelResults=[];
  const absolute=new Map();for(const n of nodes){const parent=absolute.get(n.parentId);absolute.set(n.id,{...n.rect,x:n.rect.x+(parent?.x??0),y:n.rect.y+(parent?.y??0)});}
  const color=c=>`rgba(${c.r*255},${c.g*255},${c.b*255},${c.a})`;
  const children=new Map();for(const n of nodes){const list=children.get(n.parentId)??[];list.push(n);children.set(n.parentId,list);}
  function render(n){
    if(n.type==='TEXT')return '';
    let fills='';const width=n.rect.width,height=n.rect.height,radius=n.style.radii?.[0]??0;
    for(const fill of n.style.fills??[])if(fill.kind==='solid')fills+=`<rect width="${width}" height="${height}" rx="${radius}" fill="${color(fill.color)}"/>`;
    let content=n.type==='VECTOR'?svgForSize(n.svg,width,height):(children.get(n.id)??[]).map(render).join('');
    if(n.clipsContent){const id='native-clip-'+n.id;content=`<defs><clipPath id="${id}"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath></defs><g clip-path="url(#${id})">${content}</g>`;}
    const border=n.style.border;if(border)content+=`<rect x="${border.width/2}" y="${border.width/2}" width="${Math.max(0,width-border.width)}" height="${Math.max(0,height-border.width)}" rx="${Math.max(0,radius-border.width/2)}" fill="none" stroke="${color(border.color)}" stroke-width="${border.width}"/>`;
    return `<g transform="translate(${n.rect.x} ${n.rect.y})" opacity="${n.style.opacity??1}">${fills}${content}</g>`;
  }
  const scene=render(nodes[0]);
  for(const id of ['stroke-board','css-board','sprite-board','viewbox-board','group-board','paint-board','image-board','background-svg','overflow-board','data-board','fill-board','base64-board','visible-board']){
    const board=await target.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};});
    await target.locator('#'+id).scrollIntoViewIfNeeded();
    const sourcePng=await target.locator('#'+id).screenshot({scale:'css'});await writeFile(resolve(folder,id+'-source.png'),sourcePng);
    const sourceBitmap=await app.evaluate(({nativeImage},base64)=>{const i=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:i.getSize(),pixels:i.toBitmap().toString('base64')};},sourcePng.toString('base64'));
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${sourceBitmap.size.width}" height="${sourceBitmap.size.height}" viewBox="${board.x} ${board.y} ${sourceBitmap.size.width} ${sourceBitmap.size.height}">${scene}</svg>`;
    const rendered=await target.evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return canvas.toDataURL('image/png').split(',')[1];},svg);
    const scenePng=Buffer.from(rendered,'base64');await writeFile(resolve(folder,id+'-scene.png'),scenePng);
    const sceneBitmap=await app.evaluate(({nativeImage},base64)=>{const i=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:i.getSize(),pixels:i.toBitmap().toString('base64')};},rendered);
    const a=Buffer.from(sourceBitmap.pixels,'base64'),b=Buffer.from(sceneBitmap.pixels,'base64'),w=sourceBitmap.size.width,h=sourceBitmap.size.height;let max=0,total=0,channels=0;
    const stable=(bytes,x,y)=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)for(let c=0;c<3;c++)if(Math.abs(bytes[((y+dy)*w+x+dx)*4+c]-bytes[(y*w+x)*4+c])>2)return false;return true;};
    for(let y=9;y<h-9;y+=9)for(let x=9;x<w-9;x+=9){if(id==='background-svg'&&Math.abs(y-h/2)<25)continue;if(!stable(a,x,y)||!stable(b,x,y))continue;for(let c=0;c<3;c++){const diff=Math.abs(a[(y*w+x)*4+c]-b[(y*w+x)*4+c]);max=Math.max(max,diff);total+=diff;channels++;}}
    const comparison={id,maxChannelError:max,meanChannelError:total/channels,comparedChannels:channels};pixelResults.push(comparison);checks.push({check:id+'-source-vs-serialized-vector-samples',ok:channels>=30&&max<=5,details:comparison});
  }
  await writeFile(resolve(folder,'pixel-comparison.json'),JSON.stringify(pixelResults,null,2));check('all-SVG-interior-samples-within-tolerance',checks.every(c=>c.ok));
  await target.screenshot({path:resolve(folder,'svg-page.png'),fullPage:true,scale:'css'});
  // Selecting a path should atomically select its outer SVG, not a blank path box.
  await target.locator('#stroke-icon').scrollIntoViewIfNeeded();await shell.locator('#select').click();await target.locator('#stroke-icon path').click({force:true});await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "stroke-icon"'),null,{timeout:15000});
  const selected=await shell.evaluate(()=>window.w2p.capture());check('clicking-SVG-path-selects-complete-native-icon',selected.data.screens[0].nodes.some(n=>n.type==='VECTOR'));
  await shell.locator('#section').click();await target.locator('#inline-icons h2').click();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "inline-icons"'),null,{timeout:15000});await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const saved=resolve(folder,'svg-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);
  await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'),null,{timeout:15000});await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved,{timeout:15000});check('self-contained-vectors-save-and-reopen',true);
  await shell.locator('#tab-selection').click();await shell.locator('#multiple').check();await target.locator('#svg-images h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2,null,{timeout:15000});
  for(const mode of ['separate','merged']){const multi=await shell.evaluate(mode=>window.w2p.capture('selection',mode),mode);await writeFile(resolve(folder,'svg-'+mode+'.json'),JSON.stringify(multi.data,null,2));check(mode+'-SVG-remapping-keeps-inline-and-external-vectors',multi.data.screens.length===(mode==='separate'?2:1)&&multi.data.screens.flatMap(s=>s.nodes).filter(n=>n.type==='VECTOR').length===11&&multi.data.requiredCapabilities.includes('inline-svg'));}
  await target.locator('#svg-clip').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const box=await target.locator('#svg-clip').boundingBox();await target.mouse.move(box.x+65,box.y+30);await target.mouse.down();await target.mouse.move(box.x+130,box.y+90,{steps:5});await target.mouse.up();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});
  const crop=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'svg-crop.json'),JSON.stringify(crop.data,null,2));check('strict-SVG-crop-keeps-complete-paths-under-native-clip',crop.data.screens[0].nodes[0].clipsContent&&crop.data.screens[0].nodes.some(n=>n.type==='VECTOR'&&n.svg.includes('r="35"')));
  await target.locator('#visible-svg').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const visibleBox=await target.locator('#visible-svg').boundingBox();await target.mouse.move(visibleBox.x-17,visibleBox.y+24);await target.mouse.down();await target.mouse.move(visibleBox.x-5,visibleBox.y+50,{steps:5});await target.mouse.up();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});
  const outside=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'svg-overflow-crop.json'),JSON.stringify(outside.data,null,2));check('strict-crop-outside-SVG-viewport-retains-overflow-path',outside.data.screens[0].nodes[0].rect.width===12&&outside.data.screens[0].nodes.some(n=>n.type==='VECTOR'&&n.clipsContent===false&&n.svg.includes('x="-25"')));
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-svg-check',figmaTested:false,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){if(target)await target.screenshot({path:resolve(folder,'failure-source.png'),fullPage:true,scale:'css'}).catch(()=>{});await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}
finally{await app.close();}

