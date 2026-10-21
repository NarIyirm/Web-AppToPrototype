import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boxShadows,shadowBounds} from '../apps/desktop/src/shadows';
import {pruneScene} from '../apps/desktop/src/geometry';
import type {SceneNode} from '../packages/contracts/src/index';
const color={r:0,g:0,b:0,a:.5};
const parse=(value:string)=>boxShadows(value,()=>color,s=>/^(?:rgba?\(|#[\da-f]+$)/.test(s));
test('shadows: computed comma lists preserve front-to-back parameters including negative spread',()=>{
  const result=parse('rgba(0, 0, 0, 0.5) -2px 4px 12px -3px, rgb(0, 0, 0) 0px 0px 0px 2px');
  assert.deepEqual(result.effects.map(e=>[e.x,e.y,e.blur,e.spread]),[[-2,4,12,-3],[0,0,0,2]]);assert.equal(result.omitted,0);
});
test('shadows: inset does not erase supported outer layers, none and transparent colors are valid',()=>{
  const result=parse('rgb(0,0,0) 1px 2px inset, rgb(0,0,0) 0px 3px');assert.equal(result.omitted,1);assert.equal(result.effects[0].blur,0);
  assert.deepEqual(parse('none'),{effects:[],omitted:0});assert.equal(boxShadows('rgba(0,0,0,0) 0px 0px',()=>({...color,a:0}),()=>true).effects[0].color.a,0);
});
test('shadows: malformed, excessive and extreme lists are rejected atomically',()=>{
  for(const input of ['rgb(0,0,0) 2px','rgb(0,0,0) 0px 0px -2px','rgb(0,0,0) 0% 0px','rgb(0,0,0) 0px 0px junk','rgb(0,0,0) 10001px 0px',Array(17).fill('rgb(0,0,0) 1px 2px').join(',')])assert.throws(()=>parse(input));
});
test('shadows: conservative visual bounds retain a shadow-only intersection without enlarging clips',()=>{
  const root:SceneNode={id:'root',name:'root',parentId:null,type:'FRAME',order:0,rect:{x:0,y:0,width:100,height:100},style:{},fidelity:'native',clipsContent:true};
  const off:SceneNode={...root,id:'off',parentId:'root',order:1,rect:{x:-70,y:20,width:20,height:20},clipsContent:false};
  const plate:SceneNode={...off,id:'plate',parentId:'off',type:'SHAPE',order:2,rect:{x:0,y:0,width:20,height:20},style:{effects:parse('rgb(0,0,0) 75px 0px 0px').effects}};
  assert.deepEqual(pruneScene([root,off,plate]).map(n=>n.id),['root','off','plate']);
  assert.deepEqual(pruneScene([root,{...off,clipsContent:true},plate]).map(n=>n.id),['root']);
  assert.deepEqual(shadowBounds({x:0,y:0,width:20,height:20},plate.style.effects),{x:0,y:0,width:95,height:20});
});
test('shadows: fully collapsed and invisible effects do not retain distant geometry',()=>{
  assert.deepEqual(shadowBounds({x:0,y:0,width:20,height:20},[{...parse('rgb(0,0,0) 75px 0px 0px -20px').effects[0]}]),{x:0,y:0,width:20,height:20});
});

test('shadows: m2.9 artificial example remains compatible with the existing effect schema',async()=>{
  const {readFile}=await import('node:fs/promises');const {parseCapturePackage}=await import('../packages/contracts/src/index');
  const data=JSON.parse(await readFile('examples/shadows-m2.9.example.json','utf8'));assert.equal(parseCapturePackage(data,true).screens[0].nodes[1].style.effects?.length,2);assert.throws(()=>parseCapturePackage(data),/EXAMPLE/);
  data.screens[0].nodes[1].style.effects[0].blur=-1;assert.throws(()=>parseCapturePackage(data,true),/PACKAGE_INVALID/);
});
