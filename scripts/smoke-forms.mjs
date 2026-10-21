import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-forms',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/forms-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='',shell,target;
app.process().stderr.on('data',v=>stderr=(stderr+v).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details!==undefined?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  shell=await waitForShell(app);const info=await shell.evaluate(()=>window.w2p.info());target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-forms'));await target.waitForSelector('#live-input');
  const initial=await target.evaluate(()=>({scroll:document.querySelector('#live-textarea').scrollTop,body:document.body.innerHTML}));
  const result=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false)),data=result.data,nodes=data.screens[0].nodes;await writeFile(resolve(folder,'forms-full-page.json'),JSON.stringify(data,null,2));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const descendants=id=>{const ids=new Set([source(id)?.id]);let old;do{old=ids.size;for(const n of nodes)if(ids.has(n.parentId))ids.add(n.id);}while(old!==ids.size);return nodes.filter(n=>ids.has(n.id));};
  const text=id=>descendants(id).filter(n=>n.text).map(n=>n.text.characters).join('');
  const pseudo=(id,kind)=>nodes.find(n=>n.sourceId===source(id)?.sourceId+kind&&n.type==='FRAME');
  check('actual-m2.9-native-capture',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&data.schemaVersion==='1.0.0'&&nodes.some(n=>n.text?.characters.includes('FORM_PAGE_END')));
  check('live-input-reads-property-instead-of-attribute',text('live-input')==='当前输入值 Alpha'&&!JSON.stringify(data).includes('旧属性值'),text('live-input'));
  const placeholder=descendants('placeholder-input').find(n=>n.text);check('placeholder-color-opacity-and-native-editability',placeholder?.text.characters==='请输入名称'&&placeholder.style.opacity===.7&&placeholder.style.fills[0].color.r>.5);
  check('password-only-exports-displayed-bullets',text('password-input')==='•'.repeat(15)&&!JSON.stringify(data).includes('FixtureSecret42'));
  check('hidden-controls-never-export-their-values',!['HiddenTypeFixtureValue','HiddenVisibilityFixtureValue','HiddenOpacityFixtureValue'].some(value=>JSON.stringify(data).includes(value)));
  const textarea=descendants('live-textarea').filter(n=>n.text);check('textarea-current-value-wraps-and-keeps-empty-line-gap',textarea.length>=5&&text('live-textarea').startsWith('第一行当前值第二行保留 两个  空格第四行')&&textarea[2].rect.y-textarea[1].rect.y>=47,textarea.map(n=>({text:n.text.characters,rect:n.rect})));
  check('textarea-current-scroll-snapshot-is-clipped',initial.scroll===24&&textarea[0].rect.y<0&&descendants('live-textarea').some(n=>n.clipsContent));
  check('selected-option-uses-current-visible-label',text('live-select')==='当前选中标签'&&!descendants('live-select').some(n=>n.text?.characters.includes('旧选项')));
  check('input-button-value-is-native-text',text('input-button')==='保存当前状态');
  check('disabled-and-readonly-values-survive',text('disabled-input')==='不可修改的显示值'&&text('readonly-input')==='只读显示值');
  check('custom-checkbox-current-style-and-generated-mark-survive',!!pseudo('custom-check','::before')&&!pseudo('custom-empty','::before'));
  check('native-checkbox-mixed-radio-states-are-native-approximations',descendants('native-checked').some(n=>n.type==='VECTOR')&&descendants('native-mixed').some(n=>n.name.includes('不确定状态'))&&descendants('native-radio').some(n=>n.name==='选中圆点')&&!descendants('native-radio-empty').some(n=>n.name==='选中圆点'));
  check('native-control-theme-limits-have-explicit-warnings',['native-checked','native-select'].every(id=>data.warnings.some(w=>w.nodeId===source(id).id&&w.code==='W_FORM_NATIVE_APPROXIMATED')));
  check('native-select-text-and-editable-arrow-survive',text('native-select')==='原生下拉显示值'&&descendants('native-select').some(n=>n.type==='VECTOR'));
  check('pseudo-badge-retains-generated-native-text',!!pseudo('badge','::before')&&nodes.some(n=>n.text?.characters==='NEW')&&text('badge').includes('原有正文'));
  const before=pseudo('stripe','::before'),after=pseudo('stripe','::after');
  check('empty-content-pseudo-boxes-preserve-border-and-rounded-fill',before?.rect.width===114&&before.rect.height===24&&before.style.border.width===2&&before.style.radii[0]===5,before);
  // Positioned generated layers can be lifted; compare absolute coordinates below.
  const absolute=new Map();for(const n of nodes){const p=absolute.get(n.parentId);absolute.set(n.id,{...n.rect,x:n.rect.x+(p?.x??0),y:n.rect.y+(p?.y??0)});}
  check('right-bottom-pseudo-position-and-z-order-survive',absolute.get(after?.id)?.x-absolute.get(source('stripe').id).x===78&&absolute.get(after.id).y-absolute.get(source('stripe').id).y===50&&before.order<after.order,{before:before?.rect,after:after?.rect});
  const attr=pseudo('attr-badge','::after');check('resolved-attr-content-is-native-text',!!attr&&nodes.some(n=>n.text?.characters==='当前标签'));
  const clipped=pseudo('pseudo-clip','::before');let ancestor=nodes.find(n=>n.id===clipped?.parentId),hasClip=false;while(ancestor){if(ancestor.clipsContent&&ancestor.name.startsWith('层叠裁切'))hasClip=true;ancestor=nodes.find(n=>n.id===ancestor.parentId);}check('positioned-pseudo-keeps-owner-overflow-clip',hasClip);
  check('pseudo-opacity-keeps-native-context',pseudo('pseudo-alpha','::before')?.style.opacity===.5);
  check('negative-pseudo-paints-below-normal-content',pseudo('negative-badge','::before')?.order<nodes.find(n=>n.parentId===source('negative-badge').id&&n.name==='span')?.order&&pseudo('negative-badge','::before')?.parentId===source('negative-badge').id);
  for(const id of ['inline-prefix','rotated-pseudo'])check(id+'-has-explicit-generated-content-boundary',data.warnings.some(w=>w.nodeId===source(id).id&&w.code==='W_PSEUDO_UNSUPPORTED'));
  check('complex-form-has-explicit-boundary',data.warnings.some(w=>w.nodeId===source('range-input').id&&w.code==='W_FORM_UNSUPPORTED'));
  check('measurement-mirrors-do-not-modify-source-content-or-scroll',await target.evaluate(initial=>document.body.innerHTML===initial.body&&document.querySelector('#live-textarea').scrollTop===initial.scroll,initial));
  await target.evaluate(()=>{document.querySelector('#live-input').value='再次编辑的当前值';document.querySelector('#live-select').value='a';document.querySelector('#custom-check').checked=false;});
  const updated=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false));await writeFile(resolve(folder,'forms-updated-state.json'),JSON.stringify(updated.data,null,2));
  const updatedNodes=updated.data.screens[0].nodes,updatedCheck=updatedNodes.find(n=>n.name==='input #custom-check');
  check('recapture-reads-new-live-values-and-checkbox-state',updatedNodes.some(n=>n.text?.characters==='再次编辑的当前值')&&updatedNodes.some(n=>n.text?.characters==='旧选项')&&!updatedNodes.some(n=>n.sourceId===updatedCheck.sourceId+'::before'));
  await target.evaluate(()=>{document.querySelector('#live-input').value='当前输入值 Alpha';document.querySelector('#live-select').value='b';document.querySelector('#custom-check').checked=true;});
  // Compare browser source with a renderer of native box geometry. Text and native
  // system widgets have structural checks, not a claim of font/widget pixel parity.
  const children=new Map();for(const n of nodes){const list=children.get(n.parentId)??[];list.push(n);children.set(n.parentId,list);}
  const color=c=>`rgba(${c.r*255},${c.g*255},${c.b*255},${c.a})`;
  function render(n){if(n.type==='TEXT'||n.type==='VECTOR')return '';const w=n.rect.width,h=n.rect.height,r=n.style.radii?.[0]??0;let fill='';for(const f of n.style.fills??[])if(f.kind==='solid')fill+=`<rect width="${w}" height="${h}" rx="${r}" fill="${color(f.color)}"/>`;let content=(children.get(n.id)??[]).map(render).join('');if(n.clipsContent){const id='clip-'+n.id;content=`<defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="${r}"/></clipPath></defs><g clip-path="url(#${id})">${content}</g>`;}const b=n.style.border;if(b)content+=`<rect x="${b.width/2}" y="${b.width/2}" width="${w-b.width}" height="${h-b.width}" rx="${Math.max(0,r-b.width/2)}" fill="none" stroke="${color(b.color)}" stroke-width="${b.width}"/>`;return `<g transform="translate(${n.rect.x} ${n.rect.y})" opacity="${n.style.opacity??1}">${fill}${content}</g>`;}
  const scene=render(nodes[0]),pixels=[];
  for(const id of ['stripe','pseudo-clip','pseudo-alpha']){
    const box=await target.locator('#'+id).evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,width:b.width,height:b.height};});
    const png=await target.locator('#'+id).screenshot({scale:'css'});await writeFile(resolve(folder,id+'-source.png'),png);
    const decode=base64=>app.evaluate(({nativeImage},base64)=>{const i=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:i.getSize(),pixels:i.toBitmap().toString('base64')};},base64);
    const a=await decode(png.toString('base64')),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${a.size.width}" height="${a.size.height}" viewBox="${box.x} ${box.y} ${a.size.width} ${a.size.height}">${scene}</svg>`;
    const output=await target.evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(svg);await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);return c.toDataURL('image/png').split(',')[1];},svg);await writeFile(resolve(folder,id+'-scene.png'),Buffer.from(output,'base64'));const b=await decode(output);
    const aa=Buffer.from(a.pixels,'base64'),bb=Buffer.from(b.pixels,'base64'),w=a.size.width;let max=0,channels=0;const stable=(bytes,x,y)=>{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)for(let c=0;c<3;c++)if(Math.abs(bytes[((y+dy)*w+x+dx)*4+c]-bytes[(y*w+x)*4+c])>2)return false;return true;};
    for(let y=7;y<a.size.height-7;y+=7)for(let x=7;x<w-7;x+=7){if(!stable(aa,x,y)||!stable(bb,x,y))continue;for(let c=0;c<3;c++){max=Math.max(max,Math.abs(aa[(y*w+x)*4+c]-bb[(y*w+x)*4+c]));channels++;}}
    pixels.push({id,maxChannelError:max,comparedChannels:channels});checks.push({check:id+'-native-pseudo-interior-pixels',ok:max<=5&&channels>=30,details:pixels.at(-1)});
  }
  await writeFile(resolve(folder,'pixel-comparison.json'),JSON.stringify(pixels,null,2));check('all-supported-pseudo-box-samples-match',checks.every(c=>c.ok));await target.screenshot({path:resolve(folder,'forms-page.png'),fullPage:true,scale:'css'});
  await shell.locator('#section').click();await target.locator('#form-values h2').click();await shell.waitForFunction(()=>document.querySelector('#selection-list li'),null,{timeout:15000});await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const saved=resolve(folder,'forms-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'),null,{timeout:15000});check('form-values-save-without-password-or-old-default',!(await readFile(saved,'utf8')).includes('FixtureSecret42'));
  await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved,{timeout:15000});check('form-package-reopens-through-contract-validation',true);
  await shell.locator('#tab-selection').click();await shell.locator('#multiple').check();await target.locator('#generated-content h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2,null,{timeout:15000});
  for(const mode of ['separate','merged']){const result=await shell.evaluate(mode=>window.w2p.capture('selection',mode),mode);await writeFile(resolve(folder,'forms-'+mode+'.json'),JSON.stringify(result.data,null,2));check(mode+'-keeps-current-values-and-generated-content',result.data.screens.length===(mode==='separate'?2:1)&&result.data.screens.flatMap(s=>s.nodes).some(n=>n.text?.characters==='当前输入值 Alpha')&&result.data.screens.flatMap(s=>s.nodes).some(n=>n.name.startsWith('::before')));}
  await target.locator('#pseudo-clip').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const box=await target.locator('#pseudo-clip').boundingBox();await target.mouse.move(box.x+90,box.y+20);await target.mouse.down();await target.mouse.move(box.x+140,box.y+70,{steps:5});await target.mouse.up();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});const crop=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'forms-crop.json'),JSON.stringify(crop.data,null,2));check('strict-crop-keeps-native-generated-content-and-clip-chain',crop.data.screens[0].nodes[0].clipsContent&&crop.data.screens[0].nodes.some(n=>n.name.startsWith('::before')));
  // Delay only the capture bundle read in this isolated test app. Navigation and
  // an immediate capture must await the same installation instead of seeing an
  // undefined probe. No source-site code or user's app is modified.
  await app.evaluate(()=>{const fs=process.getBuiltinModule('node:fs/promises');globalThis.__readBeforeReadyCheck=fs.readFile;globalThis.__delayedCaptureReads=0;fs.readFile=async function(path,...args){if(String(path).endsWith('capture.js')){globalThis.__delayedCaptureReads++;await new Promise(resolve=>setTimeout(resolve,250));}return globalThis.__readBeforeReadyCheck.call(this,path,...args);};});
  try{
    await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-tall'));
    const ready=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false));
    check('navigation-and-immediate-capture-await-delayed-installation',await app.evaluate(()=>globalThis.__delayedCaptureReads>0)&&ready.data.screens[0].nodes[0].rect.height===30000&&ready.data.screens[0].nodes.some(n=>n.text?.characters.includes('HEIGHT_INSIDE')));
  }finally{await app.evaluate(()=>{process.getBuiltinModule('node:fs/promises').readFile=globalThis.__readBeforeReadyCheck;delete globalThis.__readBeforeReadyCheck;});}
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-forms-and-generated-content-check',figmaTested:false,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){if(target)await target.screenshot({path:resolve(folder,'failure-source.png'),fullPage:true,scale:'css'}).catch(()=>{});await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}finally{await app.close();}

