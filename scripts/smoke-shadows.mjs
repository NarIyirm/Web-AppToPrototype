import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-20/M2-shadows',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/shadows-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='',shell,target;
app.process().stderr.on('data',value=>stderr=(stderr+value).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details!==undefined?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  shell=await waitForShell(app);const info=await shell.evaluate(()=>window.w2p.info());target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-shadows'));await target.waitForSelector('#multi-shadow');
  const initial=await target.evaluate(()=>({html:document.body.innerHTML,x:scrollX,y:scrollY}));
  const result=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false)),data=result.data,nodes=data.screens[0].nodes;await writeFile(resolve(folder,'shadows-full-page.json'),JSON.stringify(data,null,2));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const plate=id=>nodes.find(n=>n.parentId===source(id)?.id&&n.style.effects?.length);
  const ancestors=n=>{const path=[];while(n?.parentId){n=nodes.find(p=>p.id===n.parentId);if(n)path.push(n);}return path;};
  check('actual-m2.9-native-capture-no-new-contract',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&data.schemaVersion==='1.0.0'&&nodes.some(n=>n.text?.characters.includes('SHADOW_PAGE_END')));
  check('all-three-shadows-keep-CSS-front-to-back-order',plate('multi-shadow')?.style.effects.length===3&&plate('multi-shadow').style.effects[0].color.r>.7&&plate('multi-shadow').style.effects[1].color.b>.5&&plate('multi-shadow').style.effects[2].color.a<.31,plate('multi-shadow')?.style);
  check('blur-negative-spread-and-rounded-background-retain-native-parameters',plate('basic-shadow')?.style.effects[0].blur===20&&plate('basic-shadow').style.effects[0].spread===-4&&plate('basic-shadow').style.radii.every(r=>r===12));
  check('hard-negative-spread-keeps-smaller-shadow',plate('negative-shadow')?.style.effects[0].spread===-8);
  check('border-box-and-border-style-remain-independent',plate('border-shadow')?.rect.width===140&&plate('border-shadow').rect.height===80&&source('border-shadow').style.border.width===5);
  check('overflowing-child-does-not-share-shadow-effect',!source('child-shadow').style.effects&&plate('child-shadow')?.type==='SHAPE'&&!!source('overflow-child')&&!source('overflow-child').style.effects);
  check('own-overflow-clips-content-without-clipping-shadow',plate('own-clip-shadow')&&ancestors(plate('own-clip-shadow')).every(n=>n.name!=='内容溢出 / 裁切')&&nodes.some(n=>n.parentId===source('own-clip-shadow').id&&n.clipsContent&&n.name==='内容溢出 / 裁切'));
  check('ancestor-overflow-retains-shadow-clip-chain',ancestors(plate('ancestor-shadow')).some(n=>n.clipsContent&&(n.name==='内容溢出 / 裁切'||n.name.startsWith('层叠裁切'))));
  check('group-opacity-is-applied-once',source('alpha-owner').style.opacity===.5&&ancestors(plate('alpha-shadow')).some(n=>n.id===source('alpha-owner').id)&&plate('alpha-shadow').style.opacity===undefined);
  const generated=nodes.find(n=>n.sourceId===source('pseudo-shadow')?.sourceId+'::before'&&n.type==='FRAME');
  check('absolute-pseudo-box-retains-editable-shadow',generated&&nodes.some(n=>n.parentId===generated.id&&n.style.effects?.[0].x===10));
  const gradient=nodes.find(n=>n.sourceId===source('gradient-shadow')?.sourceId+'::before'&&n.type==='FRAME');check('gradient-pseudo-paints-move-together-without-covering-gradient',gradient?.style.fills.length===0&&nodes.some(n=>n.parentId===gradient.id&&n.style.effects?.length&&n.style.fills.some(f=>f.kind==='linear_gradient'))&&data.requiredCapabilities.includes('linear-gradients'));
  check('context-background-shadow-plate-stays-behind-negative-child',plate('context-shadow')?.order<source('negative-child').order&&source('negative-child').parentId===source('context-shadow').id);
  check('shadow-only-visible-box-survives-pruning',plate('outside-shadow')?.style.effects[0].x===140);
  check('transparent-and-percentage-shapes-have-explicit-boundaries',['transparent-shadow','ellipse-shadow'].every(id=>data.warnings.some(w=>w.nodeId===source(id).id&&w.code==='W_SHADOW_UNSUPPORTED')&&!plate(id)));
  check('mixed-inset-keeps-outer-and-reports-omission',plate('mixed-shadow')?.style.effects.length===1&&data.warnings.some(w=>w.nodeId===source('mixed-shadow').id&&w.code==='W_SHADOW_UNSUPPORTED'));
  check('shadow-edges-explicitly-require-Figma-comparison',data.warnings.some(w=>w.code==='W_SHADOW_APPROXIMATED'&&w.nodeId===source('basic-shadow').id));
  check('text-shadow-keeps-editable-text-and-warning',nodes.some(n=>n.text?.characters==='原生文字仍可编辑')&&data.warnings.some(w=>w.code==='W_TEXT_LAYOUT_UNSUPPORTED'&&w.nodeId===source('text-shadow').id));
  check('capture-does-not-mutate-source-content-or-scroll',await target.evaluate(initial=>document.body.innerHTML===initial.html&&scrollX===initial.x&&scrollY===initial.y,initial));
  // Independent native geometry renderer for zero-blur samples only. Blurred
  // shadows have parameter checks and source PNGs, never claimed pixel parity.
  const pixels=[];
  for(const id of ['multi-stage','negative-stage','border-stage','child-stage','own-clip-stage','ancestor-stage','alpha-stage','pseudo-stage','context-stage','outside-stage']){
    const png=await target.locator('#'+id).screenshot({scale:'css'});await writeFile(resolve(folder,id+'-source.png'),png);
    const decoded=await app.evaluate(({nativeImage},base64)=>{const i=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:i.getSize(),pixels:i.toBitmap().toString('base64')};},png.toString('base64'));
    const expected=await target.evaluate(({nodes,rootId})=>{
      const root=nodes.find(n=>n.id===rootId),canvas=document.createElement('canvas');canvas.width=root.rect.width;canvas.height=root.rect.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f5f7';ctx.fillRect(0,0,canvas.width,canvas.height);const absolute=new Map();for(const n of nodes){const p=absolute.get(n.parentId);absolute.set(n.id,{x:n.rect.x+(p?.x??0),y:n.rect.y+(p?.y??0)});}const crop=absolute.get(rootId);ctx.translate(-crop.x,-crop.y);
      const children=new Map(),rgba=c=>`rgba(${c.r*255},${c.g*255},${c.b*255},${c.a})`;for(const n of nodes){const list=children.get(n.parentId)||[];list.push(n);children.set(n.parentId,list);}
      function body(n,c){
        if(n.type==='TEXT')return;const w=n.rect.width,h=n.rect.height,r=n.style.radii??[0,0,0,0];
        const path=()=>{c.beginPath();c.roundRect(0,0,w,h,r);};
        for(const e of [...n.style.effects??[]].reverse()){
          if(e.blur!==0)continue; /* Other boards include blur; these crop samples do not. */const sw=w+2*e.spread,sh=h+2*e.spread;if(sw<=0||sh<=0)continue;
          c.save();c.beginPath();c.rect(-100000,-100000,200000,200000);c.roundRect(0,0,w,h,r);c.clip('evenodd');c.fillStyle=rgba(e.color);c.beginPath();c.roundRect(e.x-e.spread,e.y-e.spread,sw,sh,r.map(v=>v===0?0:Math.max(0,v+e.spread)));c.fill();c.restore();
        }
        for(const f of n.style.fills??[]){if(f.kind==='solid')c.fillStyle=rgba(f.color);else{const a=f.angle*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a),len=Math.abs(w*dx)+Math.abs(h*dy),g=c.createLinearGradient(w/2-dx*len/2,h/2-dy*len/2,w/2+dx*len/2,h/2+dy*len/2);for(const s of f.stops)g.addColorStop(s.position,rgba(s.color));c.fillStyle=g;}path();c.fill();}
        c.save();if(n.clipsContent){path();c.clip();}for(const child of children.get(n.id)||[])render(child,c);c.restore();
        if(n.style.border){const b=n.style.border;c.lineWidth=b.width;c.strokeStyle=rgba(b.color);c.beginPath();c.roundRect(b.width/2,b.width/2,w-b.width,h-b.width,r.map(v=>Math.max(0,v-b.width/2)));c.stroke();}
      }
      function render(n,c,isRoot=false){c.save();if(!isRoot)c.translate(n.rect.x,n.rect.y);const a=n.style.opacity??1;if(a<1){const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const local=layer.getContext('2d');local.setTransform(c.getTransform());body(n,local);c.save();c.resetTransform();c.globalAlpha*=a;c.drawImage(layer,0,0);c.restore();}else body(n,c);c.restore();}
      render(nodes[0],ctx,true);return {width:canvas.width,height:canvas.height,pixels:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data),url:canvas.toDataURL()};
    },{nodes,rootId:source(id).id});await writeFile(resolve(folder,id+'-scene.png'),Buffer.from(expected.url.split(',')[1],'base64'));
    const aa=Buffer.from(decoded.pixels,'base64'),bb=expected.pixels,w=expected.width;let max=0,channels=0,shadowChannels=0;
    for(let y=6;y<expected.height-6;y+=4)for(let x=6;x<w-6;x+=4){let stable=true;for(let dy=-2;dy<=2;dy+=2)for(let dx=-2;dx<=2;dx+=2)for(let c=0;c<3;c++)if(Math.abs(bb[((y+dy)*w+x+dx)*4+c]-bb[(y*w+x)*4+c])>2||Math.abs(aa[((y+dy)*decoded.size.width+x+dx)*4+c]-aa[(y*decoded.size.width+x)*4+c])>2)stable=false;if(!stable)continue;
      for(let c=0;c<3;c++){max=Math.max(max,Math.abs(bb[(y*w+x)*4+c]-aa[(y*decoded.size.width+x)*4+2-c]));channels++;}if(bb[(y*w+x)*4]!==255||bb[(y*w+x)*4+1]!==255||bb[(y*w+x)*4+2]!==255)shadowChannels+=3;
    }
    const p={id,maxChannelError:max,comparedChannels:channels,nonWhiteChannels:shadowChannels};pixels.push(p);check(id+'-hard-shadow-stable-interior-pixels',channels>=300&&shadowChannels>=30&&max<=5,p);
  }
  await writeFile(resolve(folder,'pixel-comparison.json'),JSON.stringify(pixels,null,2));
  await target.screenshot({path:resolve(folder,'shadows-page.png'),fullPage:true,scale:'css'});
  await shell.locator('#section').click();await target.locator('#shadow-values h2').click();await shell.waitForFunction(()=>document.querySelector('#selection-list li'),null,{timeout:15000});await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const saved=resolve(folder,'shadows-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'),null,{timeout:15000});
  check('UI-save-keeps-all-native-shadow-parameters',JSON.parse(await readFile(saved,'utf8')).screens[0].nodes.some(n=>n.style.effects?.length===3));
  await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved,{timeout:15000});check('saved-package-reopens-through-contract-validation',true);
  await shell.locator('#tab-selection').click();await shell.locator('#multiple').check();await target.locator('#shadow-composition h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2,null,{timeout:15000});
  for(const mode of ['separate','merged']){const capture=await shell.evaluate(mode=>window.w2p.capture('selection',mode),mode);await writeFile(resolve(folder,'shadows-'+mode+'.json'),JSON.stringify(capture.data,null,2));check(mode+'-keeps-shadow-planes-and-composition',capture.data.screens.length===(mode==='separate'?2:1)&&capture.data.screens.flatMap(s=>s.nodes).filter(n=>n.style.effects?.length).length>=11);}
  await shell.locator('#multiple').uncheck();await shell.locator('#select').click();await target.locator('#border-shadow').click({position:{x:10,y:10}});await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "border-shadow"'),null,{timeout:15000});
  const selected=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'shadows-selected-border.json'),JSON.stringify(selected.data,null,2));const sn=selected.data.screens[0].nodes,sp=sn.find(n=>n.style.effects?.length),sb=sn.find(n=>n.name==='选区边框 / 原生绘制层'),neg=sn.find(n=>n.name.endsWith(' #selected-negative'));
  check('selected-noncontext-border-paints-after-shadow-background-and-negative-layer',neg&&sp&&sb&&neg.order<sp.order&&sp.order<sb.order&&sb.style.border.width===5);
  await target.locator('#outside-stage').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const box=await target.locator('#outside-stage').boundingBox();await target.mouse.move(box.x+45,box.y+65);await target.mouse.down();await target.mouse.move(box.x+85,box.y+95,{steps:5});await target.mouse.up();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});
  const crop=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'shadows-crop.json'),JSON.stringify(crop.data,null,2));check('strict-crop-keeps-shadow-when-original-box-is-outside',crop.data.screens[0].nodes[0].clipsContent&&crop.data.screens[0].nodes.some(n=>n.style.effects?.[0].x===140));
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-native-outer-shadow-check',figmaTested:false,blurPixelsTested:false,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){if(target)await target.screenshot({path:resolve(folder,'failure-source.png'),fullPage:true,scale:'css'}).catch(()=>{});await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}finally{await app.close();}







