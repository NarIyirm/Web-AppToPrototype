import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertCapture, convertCaptures,mergeCaptures,sanitizeSource } from '../apps/desktop/src/converter';
import type { DomCapture } from '../apps/desktop/src/capture-data';
test('source metadata removes credentials, fragments and query tokens', () => {
  assert.equal(sanitizeSource('https://user:secret@example.com/demo?token=secret#fragment'), 'https://example.com/demo');
});
function sample(x:number,name:string):DomCapture{return {url:'https://example.com',title:'Synthetic converter input',context:{viewport:{width:1000,height:700},devicePixelRatio:1,zoomFactor:1,scroll:{x:0,y:0}},selection:{mode:'element',sourceNodeIds:[name],excludedSourceNodeIds:[`excluded-${name}`],originalRect:{x,y:40,width:200,height:100},boundaryPolicy:'complete_elements',contentScope:'loaded_content'},nodes:[{id:'root',sourceId:name,name,type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:200,height:100},fidelity:'native',style:{}},{id:'text',name:'title',type:'TEXT',parentId:'root',order:1,rect:{x:10,y:20,width:50,height:24},style:{},fidelity:'native',text:{characters:name,font:{family:'Arial',style:'Regular',weight:400,size:16},lineHeight:24,letterSpacing:0,align:'left',runs:[]}}],images:[],warnings:[{code:'W_TEST',severity:'warning',message:'Synthetic warning',nodeId:'text'}]};}
test('multi-screen packages preserve local geometry and scope warnings to the correct screen',()=>{
 const data=convertCaptures([sample(20,'first'),sample(320,'second')],[],'1','synthetic-batch');assert.equal(data.screens.length,2);assert.notEqual(data.screens[0].captureId,data.screens[1].captureId);assert.equal(data.screens[1].nodes[1].rect.x,10);assert.equal(data.warnings[1].screenId,'screen-2');assert.equal(data.screens[1].selection.originalRect.x,320);
});
test('merged selections preserve gaps, remap references and omit unrelated page content',()=>{
 const captures=[sample(20,'first'),sample(320,'second')];const merged=mergeCaptures(captures);const data=convertCapture(merged,[],'1','synthetic-merged');const nodes=data.screens[0].nodes;assert.equal(data.screens.length,1);assert.equal(nodes[0].rect.width,500);assert.equal(nodes.find(n=>n.sourceId==='second')!.rect.x,300);assert.equal(nodes[4].parentId,nodes[3].id);assert.equal(data.warnings[1].nodeId,nodes[4].id);assert.deepEqual(data.screens[0].selection.excludedSourceNodeIds,['excluded-first','excluded-second']);assert.equal(captures[1].nodes[0].rect.x,0);
});
test('real capture conversion keeps native geometry and marks input as capture', () => {
  const capture: DomCapture = { url:'https://example.com/demo?token=secret', title:'真实页面', context:{ viewport:{width:1000,height:700}, devicePixelRatio:2, zoomFactor:1, scroll:{x:0,y:200} },
    selection:{ mode:'element',sourceNodeIds:['root'],excludedSourceNodeIds:[],originalRect:{x:40,y:240,width:300,height:100},boundaryPolicy:'complete_elements',contentScope:'loaded_content' },
    nodes:[{id:'root',name:'section',parentId:null,type:'FRAME',order:0,rect:{x:0,y:0,width:300,height:100},fidelity:'native',style:{}}], images:[],warnings:[] };
  const data = convertCapture(capture, [], '3', 'test-package');
  assert.equal(data.artifactKind, 'capture'); assert.equal(data.source.url,'https://example.com/demo');
  assert.equal(data.screens[0].selection.originalRect.y,240); assert.equal(data.screens[0].nodes[0].rect.y,0); assert.deepEqual(data.interactions,[]);
});
