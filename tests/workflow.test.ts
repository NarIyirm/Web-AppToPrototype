import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {emptyProject,addProjectStates,selectProjectScreens,editProject,validateProject} from '../apps/desktop/src/project';
import {WorkspaceStorage} from '../apps/desktop/src/storage';
import {encodeCaptureZip,decodeCaptureZip,zipFiles,unzipFiles} from '../packages/contracts/src/archive';
import {encodeUtf8,decodeUtf8,encodeBase64} from '../packages/contracts/src/encoding';
import {decodeBase64} from '../packages/contracts/src/resources';
import {parseCapturePackage,type CapturePackage} from '../packages/contracts/src/index';
import {applyAutoLayouts} from '../apps/desktop/src/layouts';
const fixture=async()=>{const data=JSON.parse(await readFile('examples/figma-m0-probe.json','utf8'));data.artifactKind='capture';data.interactions=[];data.screens=data.screens.slice(0,1);return data as CapturePackage;};
test('project: choosing a subset retains only valid internal links and referenced resources',async()=>{
 const data=await fixture(),project=addProjectStates(addProjectStates(emptyProject('project-subset'),data,[],'a'),data,[],'b').data!;
 const [a,b]=project.screens;project.interactions=[{id:'to-b',fromScreenId:a.id,triggerNodeId:a.rootNodeId,toScreenId:b.id,action:'navigate',trigger:'click',transition:'instant'}];
 const chosen=selectProjectScreens(project,[a.id]);assert.equal(chosen.screens.length,1);assert.equal(chosen.interactions.length,0);assert.equal(project.screens.length,2);
 assert.throws(()=>selectProjectScreens(project,[]));assert.throws(()=>selectProjectScreens(project,['missing']));
});
test('project: identical URLs and local node IDs remain independent immutable states with original source contexts',async()=>{
 const data=await fixture(),a=addProjectStates(emptyProject('project-unit'),data,[],'a'),b=addProjectStates(a,data,[],'b');assert.equal(a.data!.screens.length,1);assert.equal(b.data!.screens.length,2);assert.notEqual(b.data!.screens[0].stateKey,b.data!.screens[1].stateKey);assert.equal(b.data!.screens[1].sourceOverride!.url,data.source.url);assert.equal(b.data!.assets.length,data.assets.length);assert.notEqual(b.data!.packageId,data.packageId);assert.doesNotThrow(()=>validateProject(b));
});
test('project: link replacement, reorder/rename and deletion keep references coherent',async()=>{
 const data=await fixture();let p=addProjectStates(addProjectStates(emptyProject('project-unit'),data,[],'a'),data,[],'b');const [a,b]=p.data!.screens,trigger=a.nodes.at(-1)!.id;
 p=editProject(p,'link',{screenId:a.id,nodeId:trigger,action:'navigate',targetId:b.id,id:'one'});p=editProject(p,'link',{screenId:a.id,nodeId:trigger,action:'open_overlay',targetId:b.id,id:'two'});assert.equal(p.data!.interactions.length,1);assert.equal(p.data!.interactions[0].action,'open_overlay');
 p=editProject(p,'rename',{screenId:b.id,name:'详情'});p=editProject(p,'move',{screenId:b.id,direction:-1});assert.equal(p.data!.screens[0].name,'详情');assert.equal(p.data!.interactions[0].toScreenId,b.id);
 p=editProject(p,'delete',{screenId:b.id});assert.equal(p.data!.interactions.length,0);assert.equal(p.data!.screens.length,1);
});
test('project: hotspots must stay inside root, dangling targets rejected, close action needs no target',async()=>{
 let p=addProjectStates(emptyProject('project-unit'),await fixture(),[],'a');const a=p.data!.screens[0];assert.throws(()=>editProject(p,'link',{screenId:a.id,rect:{x:-1,y:0,width:10,height:10},action:'close_overlay',id:'x'}),/热点/);assert.throws(()=>editProject(p,'link',{screenId:a.id,nodeId:a.rootNodeId,action:'navigate',targetId:'missing',id:'x'}),/TARGET/);
 p=editProject(p,'link',{screenId:a.id,rect:{x:5,y:5,width:20,height:20},action:'close_overlay',id:'hot'});assert.equal(p.data!.interactions[0].toScreenId,undefined);assert.equal(p.data!.screens[0].nodes.at(-1)!.name,'交互热点');p=editProject(p,'remove-link',{id:'link-hot'});assert.equal(p.data!.interactions.length,0);assert.ok(!p.data!.screens[0].nodes.some(n=>n.id==='hotspot-hot'));
});
test('project storage: restart, serialized writes, corrupt draft preservation and history path validation',async()=>{
 const dir=resolve('.runtime/project-unit',randomUUID()),store=new WorkspaceStorage(dir);await store.init();await assert.rejects(store.update(()=>{throw Error('synthetic write failure');}),/synthetic/);assert.equal(store.read().data,null);
 const data=await fixture();await store.update(p=>addProjectStates(p,data,[],'a'));await Promise.all([store.update(p=>editProject(p,'name',{name:'A'})),store.update(p=>editProject(p,'name',{name:'B'}))]);const restored=new WorkspaceStorage(dir);await restored.init();assert.equal(restored.read().name,'B');assert.equal(restored.read().data!.screens.length,1);
 await assert.rejects(restored.load('../project.json'));await writeFile(resolve(dir,'project.json'),'broken');const corrupt=new WorkspaceStorage(dir);await corrupt.init();assert.match(corrupt.read().storageError,/STORAGE/);await assert.rejects(corrupt.update(p=>p),/STORAGE/);assert.equal(await readFile(resolve(dir,'project.json'),'utf8'),'broken');await corrupt.reset();assert.equal(corrupt.read().storageError,'');
});

test('archive: ZIP round-trip externalizes images and rejects CRC corruption/unknown paths',async()=>{
 const data=await fixture(),zip=encodeCaptureZip(data),round=await decodeCaptureZip(zip);assert.deepEqual(round,data);const entries=await unzipFiles(zip);assert.ok(entries.has('capture.json'));assert.ok([...entries.keys()].some(k=>k.startsWith('assets/')));
 const broken=zip.slice();broken[40]^=1;await assert.rejects(decodeCaptureZip(broken),/ZIP|JSON/);assert.throws(()=>zipFiles([{name:'../bad',bytes:new Uint8Array()}]),/path/);
 await assert.rejects(decodeCaptureZip(zipFiles([{name:'capture.json',bytes:encodeUtf8(JSON.stringify(data))},{name:'extra.txt',bytes:new Uint8Array()}])),/resource|unknown/);
});
test('encoding: Chinese/emoji, base64 bytes and invalid overlong UTF-8 are deterministic in Node and plugin sandboxes',()=>{
 const text='中文 😀\n';assert.equal(decodeUtf8(encodeUtf8(text)),text);assert.equal(Buffer.from(encodeUtf8(text)).toString('hex'),Buffer.from(text).toString('hex'));const bytes=new Uint8Array([0,1,255,32,99]);assert.deepEqual(decodeBase64(encodeBase64(bytes)),bytes);assert.throws(()=>decodeUtf8(new Uint8Array([0xc0,0x80])),/UTF8/);
});
test('layout: only equal-gap fixed single lines convert; wrapped/overlapping content remains absolute',()=>{
 const frame=(id:string,parentId:string|null,x:number,y:number,w:number,h:number):any=>({id,name:id,type:'FRAME',parentId,order:x,rect:{x,y,width:w,height:h},style:{},fidelity:'native'});
 const capture:any={nodes:[frame('root',null,0,0,240,70),frame('a','root',10,10,50,40),frame('b','root',80,10,50,40),frame('c','root',150,10,50,40)],flexCandidates:[{id:'root',axis:'horizontal'}]};applyAutoLayouts(capture);assert.deepEqual(capture.nodes[0].layout,{mode:'horizontal',gap:20,padding:[10,40,20,10]});delete capture.nodes[0].layout;capture.nodes[3].rect.y=30;applyAutoLayouts(capture);assert.equal(capture.nodes[0].layout,undefined);
});
test('layout: capability gates native Auto Layout and packages cannot silently overwrite a click action',async()=>{
 const data=await fixture(),root=data.screens[0].nodes[0];root.layout={mode:'horizontal',gap:8,padding:[0,0,0,0]};assert.throws(()=>parseCapturePackage(data),/auto-layout/);data.requiredCapabilities=[...(data.requiredCapabilities??[]),'auto-layout'];assert.doesNotThrow(()=>parseCapturePackage(data));
 const s=data.screens[0];data.interactions=[{id:'one',fromScreenId:s.id,triggerNodeId:s.rootNodeId,trigger:'click',action:'close_overlay',transition:'instant'},{id:'two',fromScreenId:s.id,triggerNodeId:s.rootNodeId,trigger:'click',action:'close_overlay',transition:'instant'}];assert.throws(()=>parseCapturePackage(data),/duplicate click/);
});

test('archive: standard Deflate is bounded and CRC validated before rehydrating native packages',async()=>{
 const {deflateRawSync,inflateRawSync}=await import('node:zlib');const data=await fixture(),zip=encodeCaptureZip(data,bytes=>deflateRawSync(bytes));assert.deepEqual(await decodeCaptureZip(zip,async(b,limit)=>inflateRawSync(b,{maxOutputLength:Math.max(1,limit)})),data);await assert.rejects(decodeCaptureZip(zip),/deflate unavailable/);
});


test('quality counts exclude empty containers but include inaccessible frames as missing content',async()=>{
 const {fidelityCounts}=await import('../packages/contracts/src/quality');const data=await fixture(),root=data.screens[0].nodes[0];data.screens[0].nodes=[root,{...root,id:'closed',parentId:root.id,order:1,fidelity:'missing'}];assert.deepEqual(fidelityCounts(data),{native:0,approximated:0,rasterized:0,missing:1});
});
test('runtime logs rotate under a fixed local size budget',async()=>{
 const {RuntimeLog}=await import('../apps/desktop/src/logging');const dir=resolve('.runtime/log-unit',randomUUID());await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'runtime.log'),'x'.repeat(1024*1024+1));await new RuntimeLog(dir).write('capture_complete',{nodes:10});assert.equal((await readFile(resolve(dir,'runtime.log.1'),'utf8')).length,1024*1024+1);assert.equal(JSON.parse(await readFile(resolve(dir,'runtime.log'),'utf8')).nodes,10);
});
