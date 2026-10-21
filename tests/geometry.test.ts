import {test} from 'node:test';
import assert from 'node:assert/strict';
import {intersection,rectangle,expandedBounds,pruneScene} from '../apps/desktop/src/geometry';
import type {SceneNode} from '../packages/contracts/src/index';
const frame=(id:string,parentId:string|null,x:number,y:number,width:number,height:number,clip=false):SceneNode=>({id,parentId,name:id,type:'FRAME',order:0,rect:{x,y,width,height},style:{},fidelity:'native',clipsContent:clip});
test('rectangle works in all drag directions and uses positive-area intersections',()=>{
  assert.deepEqual(rectangle({x:70,y:90},{x:10,y:20}),{x:10,y:20,width:60,height:70});
  assert.equal(intersection({x:0,y:0,width:10,height:10},{x:10,y:0,width:10,height:10}),null);
});
test('complete-element expansion selects against the requested box without cascading',()=>{
  const result=expandedBounds({x:20,y:20,width:20,height:20},[{x:10,y:10,width:40,height:40},{x:45,y:10,width:40,height:40}],{x:0,y:0,width:100,height:100});
  assert.deepEqual(result,{x:10,y:10,width:40,height:40});
  assert.throws(()=>expandedBounds({x:20,y:20,width:20,height:20},[{x:0,y:0,width:1000,height:1000}],{x:0,y:0,width:100,height:100}),/E_SELECTION_TOO_LARGE/);
});
test('crop retains overflowing descendants and their original parent-relative positions',()=>{
  const nodes=[frame('root',null,0,0,100,100,true),frame('offscreen-parent','root',-200,0,50,50),frame('visible-child','offscreen-parent',220,10,30,20),frame('unrelated','root',300,300,10,10)];
  const result=pruneScene(nodes);
  assert.deepEqual(result.map(n=>n.id),['root','offscreen-parent','visible-child']);
  assert.equal(result[2].rect.x,220);
});
test('crop respects ancestor clipping and preserves full text data at the crop edge',()=>{
  const text:SceneNode={...frame('text','root',80,20,100,20),type:'TEXT',text:{characters:'完整可编辑文本',font:{family:'Arial',style:'Regular',weight:400,size:16},lineHeight:20,letterSpacing:0,align:'left',runs:[]}};
  const nodes=[frame('root',null,0,0,100,100,true),frame('clipped-parent','root',-200,0,50,50,true),frame('hidden-child','clipped-parent',220,10,30,20),text];
  const result=pruneScene(nodes);
  assert.deepEqual(result.map(n=>n.id),['root','text']);assert.equal(result[1].text?.characters,'完整可编辑文本');assert.equal(result[1].rect.width,100);
});
test('crop retains visible-overflow SVG paths even when their viewport misses the crop',()=>{
  const vector:SceneNode={...frame('vector','outside',0,0,30,30),type:'VECTOR',clipsContent:false,svg:'<svg width="30" height="30" overflow="visible"><rect x="100" width="30" height="30"/></svg>'};
  const root=frame('root',null,0,0,100,100,true),parent=frame('outside','root',-100,10,30,30);
  assert.deepEqual(pruneScene([root,parent,vector]).map(n=>n.id),['root','outside','vector']);
  assert.deepEqual(pruneScene([root,{...parent,clipsContent:true},vector]).map(n=>n.id),['root']);
});
test('visible form clips can retain complete editable text while wholly offscreen forms remain omitted',()=>{
  const root=frame('root',null,0,0,100,100,true),clip=frame('value-clip','root',10,10,60,40,true),last=frame('last-line','value-clip',0,150,60,20);
  assert.deepEqual(pruneScene([root,clip,last],new Set(['value-clip'])).map(n=>n.id),['root','value-clip','last-line']);
  assert.deepEqual(pruneScene([root,{...clip,rect:{...clip.rect,x:200}},last],new Set(['value-clip'])).map(n=>n.id),['root']);
});
