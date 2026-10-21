/// <reference types="@figma/plugin-typings" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cssList, imageRect, position, linearGradient, gradientGeometry } from '../apps/desktop/src/visual';
import { scenePaint, sceneImagePaint } from '../apps/figma-plugin/src/paints';
import { parseCapturePackage, type CapturePackage, type Color, type Fill } from '../packages/contracts/src/index';
const red:Color={r:1,g:0,b:0,a:1},blue:Color={r:0,g:0,b:1,a:.5};
const parseColor=(v:string)=>v==='red'?red:blue;
const validColor=(v:string)=>['red','blue','rgba(0, 0, 255, 0.5)','oklch(.5 .1 20)'].includes(v);
const area={x:0,y:0,width:150,height:210};

test('image geometry preserves CSS free-space percentages including negative crop space',()=>{
  const cover=imageRect({area,fit:'cover',position:'85% 20%'},{width:320,height:160});
  assert.deepEqual(cover,{x:-229.5,y:0,width:420,height:210});
  const contain=imageRect({area,fit:'contain',position:'left bottom'},{width:320,height:160});
  assert.deepEqual(contain,{x:0,y:135,width:150,height:75});
  assert.deepEqual(imageRect({area,fit:'fill',position:'50% 50%'},{width:160,height:320}),area);
});
test('none and scale-down use CSS intrinsic dimensions, retaining density-corrected natural size',()=>{
  assert.deepEqual(imageRect({area,fit:'none',position:'-20px -5px',natural:{width:80,height:40}},{width:320,height:160}),{x:-20,y:-5,width:80,height:40});
  assert.deepEqual(imageRect({area,fit:'scale-down',position:'right bottom'},{width:32,height:32}),{x:118,y:178,width:32,height:32});
});
test('background size and edge offsets respect origin-to-clip offsets',()=>{
  assert.deepEqual(imageRect({area:{x:4,y:4,width:232,height:142},size:'100px auto',position:'calc(100% - 12px) calc(100% - 8px)'},{width:320,height:160}),{x:124,y:88,width:100,height:50});
  assert.deepEqual(imageRect({area,size:'50% 25%',position:'center'},{width:320,height:160}),{x:37.5,y:78.75,width:75,height:52.5});
  assert.deepEqual(position('bottom left',30,40),{x:0,y:40});
  assert.throws(()=>imageRect({area,size:'calc(100% - 1em) auto',position:'center'},{width:320,height:160}));
  assert.throws(()=>imageRect({area,size:'100001px auto',position:'center'},{width:320,height:160}));
});
test('CSS list parsing preserves function commas, quoted URLs and calc spaces',()=>{
  assert.equal(cssList('linear-gradient(rgb(0, 0, 0), rgba(1, 2, 3, .5)), url("a,b.png")').length,2);
  assert.deepEqual(cssList('calc(100% - 12px) 25%',' '),['calc(100% - 12px)','25%']);
});
test('gradient parsing resolves angles, missing stops, pixels, duplicate hard stops and alpha',()=>{
  const fill=linearGradient('linear-gradient(.25turn, red 0% 30%, blue 30% 70%, red 70%)',260,140,parseColor,validColor);
  assert.equal(fill.kind,'linear_gradient');if(fill.kind!=='linear_gradient')return;
  assert.equal(fill.angle,90);assert.deepEqual(fill.stops.map(s=>s.position),[0,.3,.3,.7,.7]);assert.equal(fill.stops[2].color.a,.5);
  const pixels=linearGradient('linear-gradient(180deg, red 14px, blue, red 126px)',260,140,parseColor,validColor);
  if(pixels.kind==='linear_gradient')assert.ok(pixels.stops.every((s,i)=>Math.abs(s.position-[.1,.5,.9][i])<1e-10));
  const decreasing=linearGradient('linear-gradient(red 70%, blue 20%)',260,140,parseColor,validColor);
  if(decreasing.kind==='linear_gradient')assert.deepEqual(decreasing.stops.map(s=>s.position),[.7,.7]);
});
test('corner direction uses rectangular magic-corner geometry',()=>{
  const fill=linearGradient('linear-gradient(to top right, red, blue)',260,140,parseColor,validColor);
  if(fill.kind!=='linear_gradient')throw Error('not gradient');
  assert.ok(Math.abs(fill.angle-Math.atan2(140,260)*180/Math.PI)<1e-10);
});
test('complex gradients are rejected explicitly instead of silently changing interpolation or repetition',()=>{
  for(const css of ['radial-gradient(red, blue)','repeating-linear-gradient(red, blue)','linear-gradient(in oklab, red, blue)','linear-gradient(red -10%, blue)','linear-gradient(red, 40%, blue)','linear-gradient(oklch(.5 .1 20), blue)'])assert.throws(()=>linearGradient(css,260,140,parseColor,validColor),css);
});
test('Figma gradient transform projects physical coordinates correctly on a wide rectangle',()=>{
  for(const angle of [0,45,90,135,180,270,330]){
    const fill:Fill={kind:'linear_gradient',angle,stops:[{position:0,color:red},{position:1,color:blue}]};
    const paint=scenePaint(fill,260,140);assert.equal(paint.type,'GRADIENT_LINEAR');if(paint.type!=='GRADIENT_LINEAR')return;
    const [a,b,c]=paint.gradientTransform[0];const axis=gradientGeometry(angle,260,140);
    assert.ok(Math.abs(a*.5+b*.5+c-.5)<1e-9);
    const x=130+axis.dx*axis.length/2,y=70+axis.dy*axis.length/2;
    assert.ok(Math.abs(a*x/260+b*y/140+c-1)<1e-9);
  }
});
test('old packages retain FILL images; new capability-gated images use editable crop paint',()=>{
  const data=JSON.parse(readFileSync('examples/figma-m0-probe.json','utf8')) as CapturePackage;
  const node=data.screens[0].nodes.find(n=>n.type==='IMAGE')!;
  assert.equal(sceneImagePaint(node,'hash').scaleMode,'FILL');
  node.imageSizing='stretch';assert.throws(()=>parseCapturePackage(data,true),/capability required/);
  data.requiredCapabilities=[...(data.requiredCapabilities??[]),'image-placement'];
  assert.equal(parseCapturePackage(data,true).schemaVersion,'1.0.0');
  assert.deepEqual(sceneImagePaint(node,'hash').imageTransform,[[1,0,0],[0,1,0]]);
  node.type='SHAPE';assert.throws(()=>parseCapturePackage(data,true),/capability required/);
});
test('gradient contract requires capability, sorted finite bounded stops and known fields',()=>{
  const data=JSON.parse(readFileSync('examples/capture-package.v1.example.json','utf8')) as CapturePackage;
  const fill:Fill={kind:'linear_gradient',angle:135,stops:[{position:0,color:red},{position:1,color:blue}]};data.screens[0].nodes[0].style.fills=[fill];
  assert.throws(()=>parseCapturePackage(data,true),/capability required/);
  data.requiredCapabilities=['linear-gradients'];assert.equal(parseCapturePackage(data,true).screens.length,2);
  fill.stops.reverse();assert.throws(()=>parseCapturePackage(data,true),/unsorted/);fill.stops.reverse();
  fill.stops[0].position=-.1;assert.throws(()=>parseCapturePackage(data,true),/E_PACKAGE_INVALID/);fill.stops[0].position=0;
  (fill as any).unknown=true;assert.throws(()=>parseCapturePackage(data,true),/E_PACKAGE_INVALID/);
});
test('m2.4 synthetic example validates and stays distinct from actual web captures',()=>{
  const data=JSON.parse(readFileSync('examples/visual-m2.4.example.json','utf8'));
  assert.equal(parseCapturePackage(data,true).artifactKind,'example');
  assert.throws(()=>parseCapturePackage(data),/DEVELOPMENT_MODE/);
});
