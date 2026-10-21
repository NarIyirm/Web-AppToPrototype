import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeSvg,svgForSize,svgForImageSize,SVG_LIMITS} from '../packages/contracts/src/svg';
import {parseCapturePackage} from '../packages/contracts/src/index';
import {convertCapture} from '../apps/desktop/src/converter';
const svg=(body:string,attrs='')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attrs}>${body}</svg>`;
test('SVG: native paths, solid shapes and inherited currentColor retain presentation',()=>{
  const result=normalizeSvg(svg('<g color="#ac2454" opacity=".5"><path fill="none" stroke="currentColor" stroke-linecap="round" d="M2 12L10 20L22 4"/></g>'));
  assert.equal(result.width,24);assert.match(result.svg,/stroke="#ac2454"/);assert.match(result.svg,/opacity=".5"/);assert.equal(result.elements,3);
  assert.equal(normalizeSvg(result.svg).svg,result.svg);
});
test('SVG: nonzero viewBox, inline styles and nested coordinate transforms survive',()=>{
  const result=normalizeSvg('<svg viewBox="10 20 80 40" width="160px" height="80"><g transform="translate(10 20) rotate(15)"><rect style="fill: red; stroke: blue" fill="green" x="0" y="0" width="20" height="20"/></g></svg>');
  assert.match(result.svg,/fill="red"/);assert.match(result.svg,/viewBox="10 20 80 40"/);assert.equal(result.width,160);
});
test('SVG: local symbols/use expand and repeated instances have unique IDs',()=>{
  const input=svg('<defs><symbol id="check" viewBox="0 0 24 24"><path id="line" fill="none" stroke="currentColor" d="M2 12L10 20L22 4"/></symbol></defs><use href="#check" color="red" width="12" height="12"/><use href="#check" x="12" width="12" height="12" color="blue"/>');
  const result=normalizeSvg(input);assert.doesNotMatch(result.svg,/<use|<symbol/);assert.match(result.svg,/stroke="red"/);assert.match(result.svg,/stroke="blue"/);assert.doesNotThrow(()=>normalizeSvg(result.svg));
});
test('SVG: internal gradients and clip paths remain self-contained',()=>{
  const result=normalizeSvg(svg('<defs><linearGradient id="ink"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><clipPath id="cut"><circle cx="12" cy="12" r="10"/></clipPath></defs><rect width="24" height="24" fill="url(#ink)" clip-path="url(#cut)"/>'));
  assert.match(result.svg,/url\(#ink\)/);assert.match(result.svg,/<clipPath/);assert.doesNotThrow(()=>normalizeSvg(result.svg));
});
test('SVG: sizing wraps a viewport so Frame resize never leaves unscaled child paths',()=>{
  const scaled=svgForSize(svg('<path d="M0 0H24V24H0Z"/>'),120,60);
  assert.match(scaled,/width="120" height="60" viewBox="0 0 24 24" preserveAspectRatio="none"/);assert.match(scaled,/<svg[^>]*width="24"/);
});
test('SVG: image sizing preserves explicit viewBox negotiation and scales intrinsic coordinates without viewBox',()=>{
  const explicit=svgForImageSize('<svg width="160" height="80" viewBox="0 0 160 80"><circle cx="80" cy="40" r="20"/></svg>',160,100);
  assert.match(explicit,/height="100" viewBox="0 0 160 80"/);assert.doesNotMatch(explicit,/preserveAspectRatio="none"/);
  const intrinsic=svgForImageSize('<svg width="120" height="60"><rect width="120" height="60"/></svg>',200,100);
  assert.match(intrinsic,/viewBox="0 0 120 60" preserveAspectRatio="none"/);
});
test('SVG: reject active content, external resources and unsupported rendering rather than partially importing',()=>{
  for(const body of ['<script/>','<foreignObject/>','<image href="https://example.com/a.png"/>','<path onclick="x()"/>','<use href="icons.svg#x"/>','<path fill="url(https://example.com/p.svg#x)"/>','<style>path{fill:red}</style>','<filter/>','<text>字</text>','<animate/>','<path style="filter:blur(2px)"/>','<path vector-effect="non-scaling-stroke"/>'])assert.throws(()=>normalizeSvg(svg(body)),/E_SVG_UNSUPPORTED/);
});
test('SVG: reject declarations, malformed XML, invalid references and encoded URL tricks',()=>{
  for(const input of ['<!DOCTYPE svg [<!ENTITY x "boom">]>'+svg(''),svg('<g><path/></svg>'),svg('<path/><path id="same"/><g id="same"/>'),svg('<path fill="url(#missing)"/>'),svg('<use href="&#104;ttps://example.com/x"/>'),svg('<path a="&evil;"/>'),svg('<g id="a"><use href="#a"/></g>')])assert.throws(()=>normalizeSvg(input),/E_SVG_UNSUPPORTED/);
});
test('SVG: input, expanded references and depth have bounded complexity',()=>{
  assert.throws(()=>normalizeSvg(svg('<path/>'.repeat(SVG_LIMITS.elements))),/budget/);
  assert.throws(()=>normalizeSvg(svg('<g>'.repeat(33)+'</g>'.repeat(33))),/budget/);
  assert.throws(()=>normalizeSvg(svg('<path d="'+'M0 0 '.repeat(60000)+'"/>')),/budget/);
});
test('SVG: namespaced legacy use expands and local paint references are renamed per instance',()=>{
  const input=svg('<defs><symbol id="tile" viewBox="0 0 24 24"><defs><linearGradient id="ink"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="24" height="24" fill="url(#ink)"/></symbol></defs><use xlink:href="#tile" width="12" height="12"/><use xlink:href="#tile" x="12" width="12" height="12"/>','xmlns:xlink="http://www.w3.org/1999/xlink"');
  const output=normalizeSvg(input);assert.doesNotMatch(output.svg,/xlink:href|<use/);assert.doesNotThrow(()=>normalizeSvg(output.svg));assert.match(output.svg,/url\(#instance1-ink\)/);assert.match(output.svg,/url\(#instance2-ink\)/);
});
test('SVG: viewport clipping remains explicit and CSS percentages are kept in SVG user coordinates',()=>{
  const output=normalizeSvg(svg('<rect width="100%" height="100%"/>','overflow="visible"'));assert.match(output.svg,/overflow="visible"/);assert.match(output.svg,/width="100%"/);
});
test('SVG: shared package parser requires declared capability and rejects unsafe input before writes',async()=>{
  const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8')),root=data.screens[0].nodes[0];
  data.screens[0].nodes.push({id:'vector',name:'vector',type:'VECTOR',parentId:root.id,order:90,rect:{x:10,y:10,width:24,height:24},fidelity:'native',style:{},svg:svg('<path d="M0 0H24V24H0Z"/>')});
  assert.throws(()=>parseCapturePackage(data,true),/inline-svg capability/);data.requiredCapabilities=['inline-svg'];assert.doesNotThrow(()=>parseCapturePackage(data,true));
  data.screens[0].nodes.at(-1).svg=svg('<script/>');assert.throws(()=>parseCapturePackage(data,true),/E_SVG_UNSUPPORTED/);
});
test('SVG: total vector complexity is bounded across screens and instances',async()=>{
  const data=JSON.parse(await readFile('examples/svg-m2.7.example.json','utf8')),root=data.screens[0].nodes[0],vector=data.screens[0].nodes[1];
  vector.svg=svg('<path d="M0 0H1V1Z"/>'.repeat(490));
  data.screens[0].nodes=[root,...Array.from({length:11},(_,i)=>({...vector,id:'v'+i,order:i+1}))];
  assert.throws(()=>parseCapturePackage(data,true),/total SVG complexity/);
});
test('SVG: capture declares inline-svg only when vectors exist and old examples still parse',async()=>{
  const data=JSON.parse(await readFile('examples/svg-m2.7.example.json','utf8'));assert.doesNotThrow(()=>parseCapturePackage(data,true));assert.throws(()=>parseCapturePackage(data),/EXAMPLE/);
  const capture:any={url:'http://localhost/fixture',title:'svg',context:data.source.captureContext,selection:data.screens[0].selection,nodes:data.screens[0].nodes,images:[],warnings:[]};
  const output=convertCapture(capture,[],'epoch','svg-test');assert.ok(output.requiredCapabilities?.includes('inline-svg'));assert.equal(output.producer.converterVersion,'desktop-1.0');
  capture.nodes=capture.nodes.filter((n:any)=>n.type!=='VECTOR');assert.ok(!convertCapture(capture,[],'epoch','old-test').requiredCapabilities?.includes('inline-svg'));
});

