import { _electron as electron } from 'playwright';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { waitForShell } from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-');
const folder=resolve('evidence/2026-10-19/M2-visual',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/visual-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000});
const checks=[];let stderr='';app.process().stderr.on('data',value=>stderr=(stderr+value).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  const shell=await waitForShell(app),info=await shell.evaluate(()=>window.w2p.info());
  let target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-visual'));
  await target.waitForSelector('#image-fit');await target.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  const capture=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false));
  const data=capture.data,nodes=data.screens[0].nodes;
  await writeFile(resolve(folder,'visual-capture.json'),JSON.stringify(data,null,2));
  check('actual-local-visual-page-native-full-frame',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&nodes[0].type==='FRAME'&&nodes[0].rect.height>1000);
  check('new-capabilities-declared-with-original-schema',data.schemaVersion==='1.0.0'&&['image-placement','linear-gradients'].every(c=>data.requiredCapabilities.includes(c)));
  check('images-deduplicated-and-no-resource-errors',data.assets.length===4&&!data.warnings.some(w=>w.code==='E_ASSET_UNAVAILABLE'));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const descendants=id=>{const ids=new Set([id]);for(const n of nodes)if(ids.has(n.parentId))ids.add(n.id);return nodes.filter(n=>ids.has(n.id));};
  const image=id=>descendants(source(id).id).find(n=>n.type==='IMAGE');
  check('cover-noncentral-crop',image('img-cover').rect.x===-229.5&&image('img-cover').rect.width===420&&image('img-cover').imageSizing==='stretch');
  check('contain-preserves-transparent-bottom-alignment',image('img-contain').rect.y===30&&image('img-contain').rect.height===120);
  check('fill-stretches-portrait-with-complete-source',image('img-fill').rect.width===240&&image('img-fill').rect.height===150);
  check('none-content-clip-excludes-padding-and-border',nodes.find(n=>n.id===image('img-none').parentId).rect.x===12&&image('img-none').rect.x===-20&&image('img-none').rect.y===-5);
  check('scale-down-does-not-enlarge-32px-source',image('img-scale-down').rect.width===32&&image('img-scale-down').rect.x===208&&image('img-scale-down').rect.y===118);
  check('background-edge-offset-from-padding-box',image('bg-offset').rect.x===124&&image('bg-offset').rect.y===88&&image('bg-offset').rect.width===100);
  check('background-content-box-clips-native-image',nodes.find(n=>n.id===image('bg-content').parentId).rect.x===17);
  check('five-native-editable-gradients',nodes.filter(n=>n.style.fills?.some(f=>f.kind==='linear_gradient')).length===5);
  check('native-text-over-background-remains-editable',descendants(source('bg-offset').id).some(n=>n.type==='TEXT'&&n.text.characters==='原生文字'));
  for(const [id,code] of [['bg-repeat','W_BACKGROUND_UNSUPPORTED'],['bg-multiple','W_BACKGROUND_UNSUPPORTED'],['gradient-radial','W_GRADIENT_UNSUPPORTED'],['gradient-repeating','W_GRADIENT_UNSUPPORTED']]){
    check(id+'-explicit-warning-and-native-remainder',data.warnings.some(w=>w.nodeId===source(id).id&&w.code===code&&w.fallback&&w.details.property)&&!descendants(source(id).id).some(n=>n.type==='IMAGE'||n.style.fills?.some(f=>f.kind==='linear_gradient'))&&descendants(source(id).id).some(n=>n.type==='TEXT'));
  }
  check('supported-samples-have-no-visual-approximation-warning',!data.warnings.some(w=>['W_IMAGE_FIT','W_BACKGROUND_APPROXIMATED','W_IMAGE_LAYOUT_UNSUPPORTED','W_GRADIENT_UNSUPPORTED','W_BACKGROUND_UNSUPPORTED'].includes(w.code)&&!['bg-repeat','bg-multiple','gradient-radial','gradient-repeating'].some(id=>source(id).id===w.nodeId)));

  // Independent raster comparison: Chromium source pixels vs a small scene renderer that
  // consumes the actual plugin paint mappings. This verifies geometry/paint data locally,
  // not the real Figma renderer. Native text and border pixels are outside sample points.
  const paints=await build({entryPoints:['apps/figma-plugin/src/paints.ts'],bundle:true,write:false,platform:'browser',format:'iife',globalName:'W2PVisualPaints'});
  await target.evaluate(paints.outputFiles[0].text);
  const pixelResults=[];
  for(const id of ['img-cover','img-contain','img-fill','img-none','img-scale-down','bg-cover','bg-contain','bg-offset','bg-content','gradient-horizontal','gradient-angle','gradient-corner','gradient-hard','gradient-pixels']){
    const png=await target.locator('#'+id).screenshot({scale:'css'});await writeFile(resolve(folder,id+'-source.png'),png);
    const decoded=await app.evaluate(({nativeImage},base64)=>{const image=nativeImage.createFromBuffer(Buffer.from(base64,'base64'));return {size:image.getSize(),pixels:image.toBitmap().toString('base64')};},png.toString('base64'));
    const expected=await target.evaluate(async ({data,rootId})=>{
      const nodes=data.screens[0].nodes,root=nodes.find(n=>n.id===rootId),canvas=document.createElement('canvas');canvas.width=root.rect.width;canvas.height=root.rect.height;const ctx=canvas.getContext('2d');
      const assets=new Map(await Promise.all(data.assets.map(async a=>{const img=new Image();img.src=`data:${a.mime};base64,${a.inlineBase64}`;await img.decode();return [a.assetId,img];})));
      const rgba=c=>`rgba(${c.r*255},${c.g*255},${c.b*255},${c.a})`;
      ctx.fillStyle='#f5f5f7';ctx.fillRect(0,0,canvas.width,canvas.height);
      function render(n,isRoot=false){ctx.save();if(!isRoot)ctx.translate(n.rect.x,n.rect.y);ctx.globalAlpha*=n.style.opacity??1;
        const w=n.rect.width,h=n.rect.height;
        const path=()=>{ctx.beginPath();ctx.roundRect(0,0,w,h,n.style.radii??[0,0,0,0]);};
        for(const fill of n.style.fills??[]){const paint=window.W2PVisualPaints.scenePaint(fill,w,h);if(paint.type==='SOLID')ctx.fillStyle=rgba({...paint.color,a:paint.opacity});else{
          const [a,b,c]=paint.gradientTransform[0],layer=document.createElement('canvas');layer.width=Math.ceil(w);layer.height=Math.ceil(h);const pixels=layer.getContext('2d').createImageData(layer.width,layer.height),stops=paint.gradientStops;
          // CSS interpolates alpha in premultiplied sRGB; CanvasGradient interpolates
          // unpremultiplied colors. Evaluate the paint projection explicitly for this check.
          for(let y=0;y<layer.height;y++)for(let x=0;x<layer.width;x++){
            const t=a*(x+.5)/w+b*(y+.5)/h+c;let left=stops[0],right=stops.at(-1);
            if(t<=left.position)right=left;else if(t>=right.position)left=right;else{for(let i=1;i<stops.length;i++)if(stops[i].position>t){left=stops[i-1];right=stops[i];break;}}
            const q=right.position===left.position?0:Math.max(0,Math.min(1,(t-left.position)/(right.position-left.position))),alpha=left.color.a*(1-q)+right.color.a*q,index=(y*layer.width+x)*4;
            for(const [j,key] of ['r','g','b'].entries())pixels.data[index+j]=alpha?255*(left.color[key]*left.color.a*(1-q)+right.color[key]*right.color.a*q)/alpha:0;
            pixels.data[index+3]=alpha*255;
          }
          layer.getContext('2d').putImageData(pixels,0,0);ctx.fillStyle=ctx.createPattern(layer,'no-repeat');
        }path();ctx.fill();}
        if(n.type==='IMAGE'){const paint=window.W2PVisualPaints.sceneImagePaint(n,'local');if(paint.scaleMode!=='CROP')throw Error('unexpected legacy paint');ctx.drawImage(assets.get(n.assetId),0,0,w,h);}
        if(n.clipsContent){path();ctx.clip();}for(const child of nodes.filter(child=>child.parentId===n.id).sort((a,b)=>a.order-b.order))render(child);ctx.restore();
      }
      render(root,true);return {width:canvas.width,height:canvas.height,pixels:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data),dataUrl:canvas.toDataURL()};
    },{data,rootId:source(id).id});
    await writeFile(resolve(folder,id+'-scene.png'),Buffer.from(expected.dataUrl.split(',')[1],'base64'));
    const actual=Buffer.from(decoded.pixels,'base64');let maxError=0,total=0,samples=0;
    // Avoid antialiased edges/hard stops and the top line of native text.
    for(const fx of [.13,.23,.47,.61,.83])for(const fy of [.27,.43,.61,.79]){
      const x=Math.floor(expected.width*fx),y=Math.floor(expected.height*fy),i=(y*expected.width+x)*4,j=(y*decoded.size.width+x)*4;
      // Texture seams, native text and screenshot rounding can shift sharp edges <1px.
      // Compare stable interiors and keep gradient points (their local slope is small).
      let stable=true;for(const dy of [-2,0,2])for(const dx of [-2,0,2])for(let c=0;c<3;c++)if(Math.abs(expected.pixels[i+(dy*expected.width+dx)*4+c]-expected.pixels[i+c])>8||Math.abs(actual[j+(dy*decoded.size.width+dx)*4+2-c]-actual[j+2-c])>8)stable=false;
      if(!stable)continue;
      const difference=[0,1,2].map(c=>Math.abs(expected.pixels[i+c]-actual[j+2-c]));maxError=Math.max(maxError,...difference);total+=difference.reduce((a,b)=>a+b,0);samples+=3;
    }
    const result={id,maxChannelError:maxError,meanChannelError:total/samples,comparedChannels:samples,sourceSize:decoded.size,sceneSize:{width:expected.width,height:expected.height}};pixelResults.push(result);
    // Chromium element screenshots round fractional layout edges outwards by up to one CSS px.
    checks.push({check:id+'-source-vs-scene-pixel-samples',ok:samples>=30&&Math.abs(decoded.size.width-expected.width)<=1&&Math.abs(decoded.size.height-expected.height)<=1&&maxError<=5,details:result});
  }
  await writeFile(resolve(folder,'pixel-comparison.json'),JSON.stringify(pixelResults,null,2));
  check('all-source-vs-scene-pixel-samples-within-tolerance',checks.every(c=>c.ok));
  await target.screenshot({path:resolve(folder,'visual-page.png'),fullPage:true,scale:'css'});

  // Exercise section selection, independent/merged outputs, and the existing save/reopen path
  // with the new payload fields. Old user acceptance is retained; this is developer regression.
  await shell.locator('#section').click();await target.locator('#linear-gradients h2').click();
  await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('linear-gradients'));
  await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const section=JSON.parse(await readFile(resolve(info.runtime,'last-capture.json'),'utf8'));check('section-mode-keeps-native-gradients',section.screens[0].nodes.filter(n=>n.style.fills?.some(f=>f.kind==='linear_gradient')).length===5);
  const saved=resolve(folder,'visual-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);
  await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'));
  const savedData=JSON.parse(await readFile(saved,'utf8'));check('saved-package-keeps-gradient-fields',savedData.requiredCapabilities.includes('linear-gradients'));
  await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved);check('new-package-reopens-through-real-validation',true);
  await shell.locator('#tab-selection').click();await shell.locator('#clear-selection').click();await shell.locator('#section').click();await target.locator('#image-fit h2').click();await shell.locator('#multiple').check();
  for(const id of ['background-image','linear-gradients','unsupported-visuals'])await target.locator('#'+id+' h2').click();
  await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===4,null,{timeout:15000});
  const separate=await shell.evaluate(()=>window.w2p.capture('selection','separate'));await writeFile(resolve(folder,'visual-separate.json'),JSON.stringify(separate.data,null,2));
  check('multi-section-native-images-and-gradients',separate.data.screens.length===4&&separate.data.assets.length===4&&separate.data.screens[2].nodes.some(n=>n.style.fills?.some(f=>f.kind==='linear_gradient')));
  const merged=await shell.evaluate(()=>window.w2p.capture('selection','merged'));await writeFile(resolve(folder,'visual-merged.json'),JSON.stringify(merged.data,null,2));
  check('merged-image-requests-retain-placement-and-resource-references',merged.data.screens.length===1&&merged.data.screens[0].nodes.filter(n=>n.type==='IMAGE').length===9&&merged.data.assets.length===4);
  check('merged-background-warning-owner-references-remapped',merged.data.warnings.filter(w=>w.code==='W_BACKGROUND_UNSUPPORTED').length===2&&merged.data.warnings.filter(w=>w.code==='W_BACKGROUND_UNSUPPORTED').every(w=>merged.data.screens[0].nodes.some(n=>n.id===w.nodeId&&n.name.includes('bg-'))));
  await target.locator('#img-cover').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();
  const cropBox=await target.locator('#img-cover').boundingBox();await target.mouse.move(cropBox.x+20,cropBox.y+25);await target.mouse.down();await target.mouse.move(cropBox.x+120,cropBox.y+150,{steps:5});await target.mouse.up();
  await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});
  const cropped=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'visual-crop.json'),JSON.stringify(cropped.data,null,2));
  check('strict-rectangle-keeps-positioned-image-and-crop-hierarchy',cropped.data.screens[0].nodes[0].clipsContent&&cropped.data.screens[0].nodes[0].rect.width===100&&cropped.data.screens[0].nodes.some(n=>n.type==='IMAGE'&&n.imageSizing==='stretch'&&n.rect.x<0));
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl);await target.waitForSelector('#orders');await shell.locator('#section').click();await target.locator('#orders h2').click();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "orders"'));
  const old=await shell.evaluate(()=>window.w2p.capture());check('original-orders-remain-native-with-single-bottom-borders',old.data.assets.length===1&&old.data.screens[0].nodes.some(n=>n.text?.characters==='打开详情')&&old.data.screens[0].nodes.filter(n=>n.name==='边框 / bottom').length===2);
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-check-not-figma-acceptance',checks,stderr},null,2));console.log(JSON.stringify({folder,checks:checks.length,passed:checks.filter(c=>c.ok).length},null,2));
}catch(error){await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}
finally{await app.close();}

