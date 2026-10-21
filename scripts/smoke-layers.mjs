import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-layers',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/layers-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='',shell,target;
app.process().stderr.on('data',value=>stderr=(stderr+value).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  shell=await waitForShell(app);const info=await shell.evaluate(()=>window.w2p.info());target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await target.waitForLoadState('load');await target.waitForSelector('#long-page-end');
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-layers'));await target.waitForSelector('#z-siblings');
  const result=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false)),data=result.data,nodes=data.screens[0].nodes;
  await writeFile(resolve(folder,'layers-full-page.json'),JSON.stringify(data,null,2));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const before=(a,b)=>source(a).order<source(b).order;
  const ancestors=id=>{const path=[];let n=source(id);while(n?.parentId){n=nodes.find(p=>p.id===n.parentId);if(n)path.push(n);}return path;};
  check('actual-m2.9-native-page-and-no-new-protocol-fields',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&data.schemaVersion==='1.0.0'&&nodes[0].type==='FRAME'&&nodes.some(n=>n.text?.characters.includes('LAYER_PAGE_END')));
  check('numeric-z-order-and-stable-ties',before('z-low','z-high')&&before('equal-first','equal-last'));
  check('positioned-descendant-escapes-ordinary-parent',source('escaped-high').parentId===source('escape-ancestor').id&&before('escape-low','escaped-high'));
  check('opacity-context-remains-atomic',ancestors('opacity-high').some(n=>n.id===source('opacity-scope').id)&&before('opacity-scope','opacity-outer')&&source('opacity-scope').style.opacity===.5);
  check('isolation-context-retains-high-descendant',ancestors('isolation-high').some(n=>n.id===source('isolation-scope').id)&&before('isolation-scope','isolation-outer'));
  check('grid-order-and-static-item-z-index',before('ordered-first','ordered-last')&&before('grid-low','grid-high'));
  check('negative-context-is-behind-normal-content',before('negative-in-context','normal-flow')&&source('negative-in-context').parentId===source('negative-context').id);
  check('context-border-is-a-native-background-layer-below-negative-content',!source('negative-context').style.border&&nodes.some(n=>n.parentId===source('negative-context').id&&n.name==='上下文边框 / 原生绘制层'&&n.order<source('negative-in-context').order));
  const rounded=ancestors('clip-paint').filter(n=>n.clipsContent&&n.name.startsWith('层叠裁切'));
  check('positioned-child-retains-padding-rounded-clip',rounded.length===1&&rounded[0].rect.width===204&&rounded[0].rect.height===119&&rounded[0].style.radii.every(r=>r===16));
  check('nested-overflow-clips-remain-native-intersection',ancestors('nested-paint').filter(n=>n.clipsContent&&n.name.startsWith('层叠裁切')).length===2);
  check('absolute-containing-block-skips-intermediate-overflow',source('unclipped-absolute').parentId===source('clip-escape').id&&!ancestors('unclipped-absolute').some(n=>n.name.includes('溢出')));
  check('scroll-container-keeps-current-offset',await target.locator('#scroll-window').evaluate(n=>n.scrollTop===75)&&nodes.some(n=>n.name==='内容溢出 / 裁切'));
  check('unsupported-axis-and-transform-remain-explicit',data.warnings.some(w=>w.code==='W_CLIP_UNSUPPORTED'&&w.nodeId===source('axis-clip').id)&&data.warnings.some(w=>w.code==='W_EFFECT_UNSUPPORTED'&&w.nodeId===source('transformed-layer').id));
  check('implicit-paint-containment-is-explicitly-approximated',source('paint-containment').fidelity==='approximated'&&data.warnings.some(w=>w.code==='W_CLIP_UNSUPPORTED'&&w.nodeId===source('paint-containment').id));
  check('simple-positioning-no-longer-emits-blanket-DOM-order-warning',!data.warnings.some(w=>w.code==='W_STACKING_APPROXIMATED'));
  const pixelResults=[];
  for(const id of ['z-siblings','negative-context','escape-ancestor','equal-z','grid-order','grid-z','opacity-context','isolated-context','negative-selection','rounded-clip','nested-clips','scroll-snapshot','clip-escape']){
    const png=await target.locator('#'+id).screenshot({scale:'css'});await writeFile(resolve(folder,id+'-source.png'),png);
    const decoded=await app.evaluate(({nativeImage},base64)=>{const image=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:image.getSize(),pixels:image.toBitmap().toString('base64')};},png.toString('base64'));
    const expected=await target.evaluate(({data,rootId})=>{
      const nodes=data.screens[0].nodes,root=nodes.find(n=>n.id===rootId),canvas=document.createElement('canvas');canvas.width=root.rect.width;canvas.height=root.rect.height;
      const ctx=canvas.getContext('2d'),rgba=c=>`rgba(${c.r*255},${c.g*255},${c.b*255},${c.a})`;ctx.fillStyle='#f5f5f7';ctx.fillRect(0,0,canvas.width,canvas.height);
      const children=new Map();for(const n of nodes){const list=children.get(n.parentId)||[];list.push(n);children.set(n.parentId,list);}
      function body(n,context){
        if(n.type==='TEXT')return;
        const w=n.rect.width,h=n.rect.height,path=()=>{context.beginPath();context.roundRect(0,0,w,h,n.style.radii??[0,0,0,0]);};
        for(const f of n.style.fills??[]){if(f.kind!=='solid')throw Error('fixture should contain only solid fills');context.fillStyle=rgba(f.color);path();context.fill();}
        context.save();if(n.clipsContent){path();context.clip();}for(const child of (children.get(n.id)||[]).sort((a,b)=>a.order-b.order))render(child,context);context.restore();
        if(n.style.border){const b=n.style.border;context.strokeStyle=rgba(b.color);context.lineWidth=b.width;context.beginPath();context.roundRect(b.width/2,b.width/2,Math.max(0,w-b.width),Math.max(0,h-b.width),(n.style.radii??[0,0,0,0]).map(r=>Math.max(0,r-b.width/2)));context.stroke();}
      }
      function render(n,context,isRoot=false){context.save();if(!isRoot)context.translate(n.rect.x,n.rect.y);
        const alpha=n.style.opacity??1;if(alpha<1){
          // Group alpha, not a separate globalAlpha on every overlapping child.
          const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const local=layer.getContext('2d');local.setTransform(context.getTransform());body(n,local);
          context.save();context.setTransform(1,0,0,1,0,0);context.globalAlpha*=alpha;context.drawImage(layer,0,0);context.restore();
        }else body(n,context);context.restore();
      }
      render(root,ctx,true);return {width:canvas.width,height:canvas.height,pixels:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data),dataUrl:canvas.toDataURL()};
    },{data,rootId:source(id).id});
    await writeFile(resolve(folder,id+'-scene.png'),Buffer.from(expected.dataUrl.split(',')[1],'base64'));
    const actual=Buffer.from(decoded.pixels,'base64');let maxError=0,total=0,channels=0;
    for(const fx of [.012,.12,.28,.43,.61,.78,.9])for(const fy of [.26,.43,.61,.79,.9]){
      const x=Math.floor(expected.width*fx),y=Math.floor(expected.height*fy),i=(y*expected.width+x)*4,j=(y*decoded.size.width+x)*4;
      let stable=true;for(const dy of [-2,0,2])for(const dx of [-2,0,2])for(let c=0;c<3;c++)if(Math.abs(expected.pixels[i+(dy*expected.width+dx)*4+c]-expected.pixels[i+c])>8||Math.abs(actual[j+(dy*decoded.size.width+dx)*4+2-c]-actual[j+2-c])>8)stable=false;
      if(!stable)continue;for(let c=0;c<3;c++){const diff=Math.abs(expected.pixels[i+c]-actual[j+2-c]);maxError=Math.max(maxError,diff);total+=diff;channels++;}
    }
    const comparison={id,maxChannelError:maxError,meanChannelError:total/channels,comparedChannels:channels};pixelResults.push(comparison);
    checks.push({check:id+'-source-vs-native-scene-samples',ok:channels>=30&&maxError<=5&&Math.abs(decoded.size.width-expected.width)<=1&&Math.abs(decoded.size.height-expected.height)<=1,details:comparison});
  }
  await writeFile(resolve(folder,'pixel-comparison.json'),JSON.stringify(pixelResults,null,2));check('all-layer-and-clip-interior-samples-within-tolerance',checks.every(c=>c.ok));
  await target.screenshot({path:resolve(folder,'layers-page.png'),fullPage:true,scale:'css'});
  // A non-context selected root must still paint its background above negative children.
  await shell.locator('#select').click();await target.locator('#negative-selection').click({position:{x:5,y:5}});await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "negative-selection"'),null,{timeout:15000});
  const selected=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'negative-selected.json'),JSON.stringify(selected.data,null,2));
  const selectedNodes=selected.data.screens[0].nodes;check('selected-noncontext-keeps-background-above-negative-layer',selectedNodes[0].style.fills.length===0&&selectedNodes.findIndex(n=>n.name==='div #negative-selected-child')<selectedNodes.findIndex(n=>n.name==='选区背景 / 原生绘制层'));
  await shell.locator('#section').click();await target.locator('#overflow-clipping h2').click();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "overflow-clipping"'),null,{timeout:15000});await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const saved=resolve(folder,'layers-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);
  await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'),null,{timeout:15000});await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved,{timeout:15000});check('native-clip-tree-saves-and-reopens',true);
  await shell.locator('#tab-selection').click();await shell.locator('#multiple').check();await target.locator('#stacking-order h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2,null,{timeout:15000});
  for(const mode of ['separate','merged']){const multi=await shell.evaluate(mode=>window.w2p.capture('selection',mode),mode);await writeFile(resolve(folder,'layers-'+mode+'.json'),JSON.stringify(multi.data,null,2));check(mode+'-keeps-order-and-native-clip-trees',multi.data.screens.length===(mode==='separate'?2:1)&&multi.data.screens.flatMap(s=>s.nodes).some(n=>n.name.startsWith('层叠裁切')&&n.clipsContent));}
  await target.locator('#rounded-clip').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const box=await target.locator('#rounded-clip').boundingBox();await target.mouse.move(box.x+40,box.y+35);await target.mouse.down();await target.mouse.move(box.x+180,box.y+125,{steps:5});await target.mouse.up();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});
  const cropped=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'layers-crop.json'),JSON.stringify(cropped.data,null,2));check('strict-crop-retains-nested-native-clip-hierarchy',cropped.data.screens[0].nodes[0].clipsContent&&cropped.data.screens[0].nodes[0].rect.width===140&&cropped.data.screens[0].nodes.some(n=>n.clipsContent&&n.name.startsWith('层叠裁切')));
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-layer-check',figmaTested:false,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}
finally{await app.close();}


