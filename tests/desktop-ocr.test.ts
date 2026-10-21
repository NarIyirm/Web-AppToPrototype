import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDesktopOcr,remapOcr} from '../apps/desktop/src/desktop-ocr';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const result=()=>({width:100,height:100,observations:[{text:'本地 OCR',bounds:{x:5,y:5,width:80,height:20},confidence:null,provenance:'ocr'}]});
test('offline OCR preserves unknown confidence and strips untrusted fields',()=>{
 const value=result();const parsed=parseDesktopOcr(JSON.stringify({...value,script:'bad',observations:[{...value.observations[0],url:'secret'}]}),100,100);
 assert.equal(parsed[0].confidence,null);assert.equal('url'in parsed[0],false);assert.equal(parsed[0].text,'本地 OCR');
});
test('offline OCR rejects wrong dimensions, excessive output and invalid bounds',()=>{
 assert.throws(()=>parseDesktopOcr(JSON.stringify(result()),99,100));const value=result();value.observations[0].bounds.x=90;assert.throws(()=>parseDesktopOcr(JSON.stringify(value),100,100));assert.throws(()=>parseDesktopOcr('x'.repeat(2*1024*1024+1),100,100));
});
test('large phone screenshot OCR coordinates map back to the original pixels',()=>{
 const lines=parseDesktopOcr(JSON.stringify(result()),100,100),mapped=remapOcr(lines,{width:100,height:100},{width:200,height:300});
 assert.deepEqual(mapped[0].bounds,{x:10,y:15,width:160,height:60});assert.deepEqual(lines[0].bounds,{x:5,y:5,width:80,height:20});
});
test('macOS Vision bridge normalizes bottom-left boxes without requiring developer tools',()=>{
 const result={boundingBox:{origin:{x:.1,y:.2},size:{width:.5,height:.1}},topCandidates:()=>({count:1,objectAtIndex:()=>({string:'Vision text',confidence:.8})})};
 const request={supportedRecognitionLanguagesAndReturnError:()=>['en-US'],results:{count:1,objectAtIndex:()=>result}};
 const bridge=Object.assign((v:unknown)=>v,{NSData:{dataWithContentsOfFile:()=>({})},NSBitmapImageRep:{imageRepWithData:()=>({pixelsWide:100,pixelsHigh:200})},NSURL:{fileURLWithPath:(v:unknown)=>v},VNRecognizeTextRequest:{alloc:{init:request}},VNImageRequestHandler:{alloc:{initWithURLOptions:()=>({performRequestsError:()=>true})}}});
 const raw=runInNewContext(readFileSync('apps/desktop/src/ocr/macos.js','utf8')+'\nrun(["synthetic.png"]);',{ObjC:{import:()=>{},deepUnwrap:(v:unknown)=>v,unwrap:(v:unknown)=>v},$:bridge,Ref:()=>({})});
 const parsed=parseDesktopOcr(raw,100,200);assert.equal(parsed[0].text,'Vision text');assert.ok(Math.abs(parsed[0].bounds.y-140)<.001);assert.equal(parsed[0].bounds.width,50);
});
