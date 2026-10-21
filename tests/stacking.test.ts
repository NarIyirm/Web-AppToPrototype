import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCapturePackage} from '../packages/contracts/src/index';
import type {SceneNode} from '../packages/contracts/src/index';
import {normalizeStacking,type StackingLayer,type ContentClip} from '../apps/desktop/src/stacking';
import {pruneScene} from '../apps/desktop/src/geometry';
const frame=(id:string,parentId:string|null,x=0,y=0,width=100,height=80):SceneNode=>({id,name:id,type:'FRAME',parentId,order:0,rect:{x,y,width,height},fidelity:'native',style:{fills:[]},clipsContent:false});
const layer=(position='static',zIndex:number|null=null,context=false):StackingLayer=>({position,zIndex,context});
function fixture(nodes:SceneNode[],entries:Array<[string,StackingLayer]>){nodes.forEach((n,i)=>n.order=i);return {nodes,meta:new Map<string,StackingLayer>([['root',layer('static',null,true)],...entries])};}
const children=(nodes:SceneNode[],id='root')=>nodes.filter(n=>n.parentId===id).map(n=>n.id);
test('CSS stack phases sort negative, normal, auto/zero and positive; ties preserve paint order',()=>{
  const f=fixture([frame('root',null),...['high','normal','negative','auto','tie','low'].map(id=>frame(id,'root'))],[['high',layer('absolute',10,true)],['normal',layer()],['negative',layer('absolute',-2,true)],['auto',layer('relative')],['tie',layer('relative',0,true)],['low',layer('absolute',2,true)]]);
  const out=normalizeStacking(f.nodes,f.meta,new Map());assert.deepEqual(children(out),['negative','normal','auto','tie','low','high']);assert.equal(out[0].id,'root');assert.ok(out.every((n,i)=>n.order===i));
});
test('positioned descendants escape non-context containers without changing absolute geometry',()=>{
  const f=fixture([frame('root',null),frame('parent','root',20,30),frame('child','parent',6,8),frame('uncle','root')],[['parent',layer()],['child',layer('absolute',5,true)],['uncle',layer('relative',2,true)]]);
  const out=normalizeStacking(f.nodes,f.meta,new Map());assert.equal(out.find(n=>n.id==='child')!.parentId,'root');assert.deepEqual(out.find(n=>n.id==='child')!.rect,{x:26,y:38,width:100,height:80});assert.deepEqual(children(out),['parent','uncle','child']);assert.equal(f.nodes[2].parentId,'parent');
});
test('opacity/isolation contexts remain atomic; large child z-index cannot outrank an outer context',()=>{
  const f=fixture([frame('root',null),frame('scope','root'),frame('huge','scope'),frame('outer','root')],[['scope',layer('static',null,true)],['huge',layer('absolute',999,true)],['outer',layer('relative',1,true)]]);f.nodes[1].style.opacity=.5;
  const out=normalizeStacking(f.nodes,f.meta,new Map());assert.deepEqual(children(out),['scope','outer']);assert.equal(out.find(n=>n.id==='huge')!.parentId,'scope');assert.equal(out.find(n=>n.id==='scope')!.style.opacity,.5);
});
function clipped(containingBlock:string){
  const root=frame('root',null),owner=frame('owner','root',10,20),clip=frame('clip','owner',4,4,92,72),child=frame('child','owner',8,10,30,20);clip.clipsContent=true;clip.style.radii=[8,8,8,8];
  const f=fixture([root,owner,clip,child],[['owner',layer('relative')],['child',{...layer('absolute',5,true),containingBlock}]]);
  const clips=new Map<string,ContentClip>([['owner',{id:'clip',ownerId:'owner',rect:clip.rect}]]);return {...f,clips};
}
test('lifted layers retain the correct padding/rounded clip through native wrapper copies',()=>{
  const f=clipped('owner'),out=normalizeStacking(f.nodes,f.meta,f.clips),child=out.find(n=>n.id==='child')!,copy=out.find(n=>n.id===child.parentId)!;
  assert.equal(copy.clipsContent,true);assert.deepEqual(copy.style.radii,[8,8,8,8]);assert.deepEqual(copy.rect,{x:14,y:24,width:92,height:72});assert.equal(child.rect.x,4);assert.equal(child.rect.y,6);assert.equal(copy.parentId,'root');
});
test('absolute descendants skip overflow ancestors between themselves and their containing block',()=>{
  const f=clipped('root'),out=normalizeStacking(f.nodes,f.meta,f.clips),child=out.find(n=>n.id==='child')!;
  assert.equal(child.parentId,'root');assert.equal(child.rect.x,18);assert.equal(child.rect.y,30);assert.equal(out.length,f.nodes.length);
});
test('negative descendants under a non-context selected root stay below its native background',()=>{
  const f=fixture([frame('root',null),frame('negative','root')],[['negative',layer('absolute',-1,true)]]);f.meta.set('root',layer());f.nodes[0].style.fills=[{kind:'solid',color:{r:1,g:0,b:0,a:1}}];
  const out=normalizeStacking(f.nodes,f.meta,new Map()),list=out.filter(n=>n.parentId==='root');assert.equal(list[0].id,'negative');assert.equal(list[1].type,'SHAPE');assert.equal(out[0].style.fills!.length,0);assert.equal(f.nodes[0].style.fills!.length,1);
});
test('order-modified flex/grid item sequence retains background/border auxiliary slots',()=>{
  const f=fixture([frame('root',null),frame('background','root'),frame('late','root'),frame('early','root'),frame('border','root')],[['late',{...layer(),flowOrder:2}],['early',{...layer(),flowOrder:-1}]]);
  assert.deepEqual(children(normalizeStacking(f.nodes,f.meta,new Map())),['background','early','late','border']);
});
test('normal flow text moves into a padding clip once and its full editable content stays intact',()=>{
  const f=clipped('owner');f.nodes[3].type='TEXT';f.nodes[3].text={characters:'Complete editable text',font:{family:'Arial',style:'Regular',weight:400,size:16},lineHeight:20,letterSpacing:0,align:'left',runs:[]};f.meta.delete('child');
  const out=normalizeStacking(f.nodes,f.meta,f.clips),text=out.find(n=>n.id==='child')!;assert.equal(text.parentId,'clip');assert.equal(text.rect.x,4);assert.equal(text.text!.characters,'Complete editable text');
});
test('copied clips are pruned correctly and added layers respect the existing node/time budget',()=>{
  const f=clipped('owner');f.nodes[1].rect.x=-200;f.nodes[0].clipsContent=true;
  const out=normalizeStacking(f.nodes,f.meta,f.clips);assert.equal(pruneScene(out).some(n=>n.id==='child'),false);
  assert.throws(()=>normalizeStacking(f.nodes,f.meta,f.clips,()=>{},f.nodes.length),/E_LIMIT_EXCEEDED/);
  assert.throws(()=>normalizeStacking(f.nodes,f.meta,f.clips,()=>{throw Error('E_CAPTURE_TIMEOUT');}),/E_CAPTURE_TIMEOUT/);
});
test('context background layers and borders paint before negative descendants as native shapes',()=>{
  const f=fixture([frame('root',null),frame('background-image','root'),frame('negative','root')],[['negative',layer('absolute',-1,true)]]);
  f.nodes[0].style.border={width:4,color:{r:0,g:0,b:0,a:1}};
  const out=normalizeStacking(f.nodes,f.meta,new Map(),()=>{},5000,new Set(['background-image']));
  const list=out.filter(n=>n.parentId==='root');assert.equal(list[0].id,'background-image');assert.equal(list[1].name,'上下文边框 / 原生绘制层');assert.equal(list[2].id,'negative');assert.equal(out[0].style.border,undefined);assert.equal(f.nodes[0].style.border.width,4);
});
test('m2.6 example uses the unchanged protocol and remains explicit synthetic example data',()=>{
  const data=JSON.parse(readFileSync('examples/layers-m2.6.example.json','utf8'));assert.deepEqual(parseCapturePackage(data,true).requiredCapabilities,['absolute-layout']);assert.throws(()=>parseCapturePackage(data),/DEVELOPMENT_MODE/);
});

test('selected non-context border stays above the separate shadow background and below ordinary content',()=>{
  const root=frame('root',null),negative=frame('negative','root'),plate=frame('plate','root'),content=frame('content','root');
  root.style.border={width:4,color:{r:0,g:0,b:0,a:1}};plate.type='SHAPE';plate.style.fills=[{kind:'solid',color:{r:1,g:1,b:1,a:1}}];plate.style.effects=[{type:'drop_shadow',x:5,y:5,blur:0,spread:2,color:{r:0,g:0,b:0,a:1}}];
  const f=fixture([root,plate,negative,content],[['negative',layer('absolute',-1,true)],['content',layer()]]);f.meta.set('root',layer());
  const out=normalizeStacking(f.nodes,f.meta,new Map(),()=>{},5000,new Set(['plate'])),list=out.filter(n=>n.parentId==='root');
  assert.deepEqual(list.map(n=>n.name),['negative','plate','选区边框 / 原生绘制层','content']);assert.equal(list[2].style.border?.width,4);assert.equal(out[0].style.border,undefined);assert.equal(list[1].style.effects?.length,1);
});
