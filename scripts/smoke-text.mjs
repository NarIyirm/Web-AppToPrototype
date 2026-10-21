import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-19/M2-text',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/text-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];let stderr='',target,shell;
app.process().stderr.on('data',value=>stderr=(stderr+value).slice(-4000));
const check=(name,ok,details)=>{checks.push({check:name,ok:!!ok,...details?{details}:{}});if(!ok)throw Error(name+' failed');};
try{
  shell=await waitForShell(app);const info=await shell.evaluate(()=>window.w2p.info());
  target=app.windows().find(p=>p.url().includes('/fixture'));if(!target)target=await app.waitForEvent('window',{predicate:p=>p.url().includes('/fixture')});
  await shell.evaluate(url=>window.w2p.navigate(url),info.fixtureUrl.replace('/fixture','/fixture-text'));await target.waitForSelector('#rich-line');
  const result=await shell.evaluate(()=>window.w2p.capture('full_page','separate',false)),data=result.data,nodes=data.screens[0].nodes;
  await writeFile(resolve(folder,'text-full-page.json'),JSON.stringify(data,null,2));
  const source=id=>nodes.find(n=>n.name.endsWith(' #'+id));
  const below=id=>{const ids=new Set([source(id).id]);for(const n of nodes)if(ids.has(n.parentId))ids.add(n.id);return nodes.filter(n=>ids.has(n.id));};
  const texts=id=>below(id).filter(n=>n.type==='TEXT'),chars=id=>texts(id).map(n=>n.text.characters).join('');
  check('real-m2.5-full-page-and-styled-text-capability',data.artifactKind==='capture'&&data.producer.converterVersion==='desktop-1.0'&&data.schemaVersion==='1.0.0'&&data.requiredCapabilities.includes('styled-text')&&nodes.some(n=>n.text?.characters.includes('TEXT_PAGE_END')));
  check('single-native-rich-line-merges-inline-fragments',texts('rich-line').length===1&&chars('rich-line')===await target.locator('#rich-line').innerText(),texts('rich-line').map(n=>n.text));
  const rich=texts('rich-line')[0].text;
  check('rich-run-font-weight-italic-and-color',rich.runs.some(r=>r.font.weight===700)&&rich.runs.some(r=>r.font.style.includes('Italic'))&&rich.runs.some(r=>r.color.r>.5&&r.color.g<.2));
  const decorations=texts('decoration-line').flatMap(n=>n.text.runs);
  check('native-underline-and-strikethrough',decorations.some(r=>r.decoration==='underline')&&decorations.some(r=>r.decoration==='line-through'));
  const wrapped=texts('wrapped-rich');check('wrapped-text-keeps-multiple-editable-visual-lines',wrapped.length>=3&&wrapped.some(n=>n.text.runs.length>1)&&new Set(wrapped.map(n=>n.rect.y.toFixed(1))).size===wrapped.length,wrapped.map(n=>n.text.characters));
  check('wrapped-text-content-has-no-duplicate-or-loss',chars('wrapped-rich').replace(/\s/g,'')===(await target.locator('#wrapped-rich').innerText()).replace(/\s/g,''));
  for(const id of ['center-text','right-text']){
    const actual=texts(id),expected=await target.locator('#'+id).evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const rect=range.getBoundingClientRect(),box=element.getBoundingClientRect();return {x:rect.x-box.x,width:rect.width};});
    check(id+'-preserves-rendered-alignment-with-native-line',actual.length===1&&Math.abs(actual[0].rect.x-expected.x)<1&&Math.abs(actual[0].rect.width-expected.width)<1,{actual:actual[0]?.rect,expected});
  }
  check('br-preserves-distinct-lines-and-editable-text',texts('break-text').length===2&&chars('break-text')==='第一行第二行 换行后粗体');
  check('emoji-and-combining-text-kept-once',chars('emoji-text')===await target.locator('#emoji-text').innerText(),chars('emoji-text'));
  check('emoji-glyph-coverage-is-explicitly-unverified',data.warnings.some(w=>w.code==='I_TEXT_GLYPH_COVERAGE_UNVERIFIED'));
  check('unicode-spaces-retain-their-codepoints',chars('nbsp-text')==='A\u00a0\u00a0B\u3000C\u2003D',chars('nbsp-text'));
  check('ordinary-whitespace-collapses-across-inline-boundaries',chars('collapsed-text')==='Collapsed spaces across nodes.',chars('collapsed-text'));
  check('preformatted-spaces-and-empty-line-offsets-preserved',texts('pre-text').map(n=>n.text.characters).join('|')==='第一行  保留两个空格|第二行   three spaces|第四行'&&texts('pre-text')[2].rect.y-texts('pre-text')[1].rect.y>=55);
  for(const [id,expected] of [['uppercase-text','STRASSE ALPHA BOLD'],['lowercase-text','lower case'],['turkish-text','İSTANBUL']])check(id+'-matches-displayed-case',chars(id)===expected,chars(id));
  check('tracking-preserved-in-native-runs',texts('tracked-text').every(n=>n.text.letterSpacing===2&&n.text.runs.every(r=>r.letterSpacing===2)));
  check('font-stack-order-preserved',texts('missing-font')[0].text.font.family==='W2P Missing Font'&&texts('missing-font')[0].text.font.fallbacks[0]==='Arial');
  check('mixed-size-stays-fragmented-with-explanation',texts('mixed-size').length>=3&&data.warnings.some(w=>w.code==='W_TEXT_FRAGMENTED'&&w.nodeId===source('mixed-size').id));
  // A CSS opacity context can be lifted out of a non-context paragraph. Check the
  // actual native compositing parent, rather than requiring the old DOM ancestry.
  check('background-and-opacity-boundaries-retain-native-ancestry',texts('badge-text').some(n=>n.parentId!==source('badge-text').id)&&nodes.some(n=>n.type==='FRAME'&&n.style.opacity===.4&&nodes.some(t=>t.parentId===n.id&&t.type==='TEXT'&&t.text.characters==='半透明片段')));
  check('complex-decoration-and-layout-have-explicit-warnings',data.warnings.some(w=>w.code==='W_TEXT_DECORATION_APPROXIMATED'&&w.nodeId===source('custom-decoration').id)&&['rtl-text','capitalize-text'].every(id=>data.warnings.some(w=>w.code==='W_TEXT_LAYOUT_UNSUPPORTED'&&w.nodeId===source(id).id)));
  check('all-new-run-ranges-respect-surrogate-pairs',nodes.filter(n=>n.text).every(n=>n.text.runs.every(r=>r.start>=0&&r.end<=n.text.characters.length&&!(r.start>0&&/[\uD800-\uDBFF]/.test(n.text.characters[r.start-1]))&&!(r.end<n.text.characters.length&&/[\uDC00-\uDFFF]/.test(n.text.characters[r.end])))));
  await target.screenshot({path:resolve(folder,'text-page.png'),fullPage:true,scale:'css'});
  await shell.locator('#section').click();await target.locator('#rich-text h2').click();await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"id": "rich-text"'),null,{timeout:15000});
  await shell.locator('#capture').click();await shell.waitForFunction(()=>!document.querySelector('#save').disabled,null,{timeout:30000});
  const saved=resolve(folder,'text-saved.json');await app.evaluate(({dialog},path)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:path});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});},saved);
  await shell.locator('#save').click();await shell.waitForFunction(()=>document.querySelector('#status').textContent.includes('真实网页转换包已保存'),null,{timeout:15000});
  const savedData=JSON.parse(await readFile(saved,'utf8'));check('saved-rich-text-keeps-ranges-and-styles',savedData.screens[0].nodes.some(n=>n.text?.runs.some(r=>r.color&&r.decoration)));
  await shell.locator('#reopen').click();await shell.waitForFunction(path=>{try{return JSON.parse(document.querySelector('#capture-output').textContent).cachedAt===path;}catch{return false;}},saved,{timeout:15000});check('styled-package-reopens-through-contract-validation',true);
  await shell.locator('#tab-selection').click();await shell.locator('#multiple').check();await target.locator('#unicode-text h2').click();await shell.waitForFunction(()=>document.querySelectorAll('#selection-list li').length===2,null,{timeout:15000});
  for(const mode of ['separate','merged']){const multi=await shell.evaluate(mode=>window.w2p.capture('selection',mode),mode);await writeFile(resolve(folder,'text-'+mode+'.json'),JSON.stringify(multi.data,null,2));check(mode+'-rich-text-and-emoji-survive-selection-remapping',multi.data.screens.length===(mode==='separate'?2:1)&&multi.data.screens.flatMap(s=>s.nodes).some(n=>n.text?.characters.includes('👨‍👩‍👧‍👦'))&&multi.data.screens.flatMap(s=>s.nodes).some(n=>n.text?.runs.some(r=>r.font.weight===700)));}
  await target.locator('#rich-line').scrollIntoViewIfNeeded();await shell.locator('#rectangle').click();const box=await target.locator('#rich-line').boundingBox();
  await target.mouse.move(box.x+16,box.y+16);await target.mouse.down();await target.mouse.move(box.x+140,box.y+48,{steps:5});await target.mouse.up();
  await shell.waitForFunction(()=>document.querySelector('#output').textContent.includes('"kind": "rectangle"'),null,{timeout:15000});const crop=await shell.evaluate(()=>window.w2p.capture());await writeFile(resolve(folder,'text-crop.json'),JSON.stringify(crop.data,null,2));
  check('strict-text-crop-retains-complete-native-line-and-runs',crop.data.screens[0].nodes[0].clipsContent&&crop.data.screens[0].nodes.some(n=>n.text?.characters===rich.characters&&n.text.runs.length>1));
  await writeFile(resolve(folder,'report.json'),JSON.stringify({kind:'developer-text-check',figmaTested:false,checks,stderr},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){if(target)await target.screenshot({path:resolve(folder,'failure-source.png'),fullPage:true,scale:'css'}).catch(()=>{});await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks,stderr},null,2));throw error;}
finally{await app.close();}

