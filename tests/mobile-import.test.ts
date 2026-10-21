import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {importMobileBundle,isMobileMaterial} from '../apps/desktop/src/mobile-import';
import {clearReliableText,decodeMobilePng,encodeMobilePng,type Pixels} from '../apps/desktop/src/mobile-png';
import {writeMobileZip} from '../packages/mobile-contracts/0.1.0-alpha.1/src/core/archive';
import {addCapture,addProject,emptyManifest,type Capture} from '../packages/mobile-contracts/0.1.0-alpha.1/src/core/project';
import {parseCapturePackage,type CapturePackage} from '../packages/contracts/src/index';
import validateV1 from '../packages/contracts/generated/validate.js';
import {addProjectStates,emptyProject,editProject} from '../apps/desktop/src/project';
import {decodeCaptureZip,encodeCaptureZip} from '../packages/contracts/src/archive';

const now='2026-10-20T05:00:00.000Z',rect={x:10,y:10,width:20,height:12};
function pixels():Pixels{
 const rgba=new Uint8Array(64*48*4).fill(255);
 for(let y=13;y<18;y++)for(let x=14;x<23;x++)rgba.set([0,0,0,255],(y*64+x)*4);
 return {width:64,height:48,rgba};
}
async function raw(overrides:Partial<Capture>={},image=pixels()){
 const png=encodeMobilePng(image),id=createHash('sha256').update(png).digest('hex');
 const asset={id,bytes:png.length,width:image.width,height:image.height,mediaType:'image/png' as const};
 const capture:Capture={id:'c-capture001',projectId:'p-project001',title:'手机画面',createdAt:now,sourceKind:'imported_image',platform:'ios',assetId:id,width:64,height:48,logicalWidth:64,logicalHeight:48,coordinateSpace:'image_pixels',observations:[],webNodes:[],warnings:[],redacted:false,...overrides};
 const state=addCapture(addProject(emptyManifest(),capture.projectId,'手机项目',now),capture,asset);
 const encode=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v));
 const meta={artifactKind:'mobile_capture',formatVersion:'0.1.0-alpha.1',packageId:'b-bundle001',revision:state.revision,createdAt:now,producer:{appVersion:'1.0.0',adapterVersion:'mobile-1'},project:{id:capture.projectId,name:'手机项目'},captures:[{id:capture.id,snapshotPath:`captures/${capture.id}/snapshot.json`}],assets:[{...asset,path:`assets/${id}.png`}]};
 async function* entries(){yield {name:'mobile.json',bytes:encode(meta)};yield {name:meta.captures[0].snapshotPath,bytes:encode(capture)};yield {name:meta.assets[0].path,bytes:png};}
 const chunks:Uint8Array[]=[];await writeMobileZip(entries(),{write(bytes){chunks.push(bytes.slice());}});
 return new Uint8Array(Buffer.concat(chunks));
}
test('mobile: PNG codec round-trip preserves pixels, rejects CRC damage',()=>{
 const image=pixels(),png=encodeMobilePng(image);assert.deepEqual(decodeMobilePng(png)?.rgba,image.rgba);
 const damaged=png.slice();damaged[damaged.length-15]^=1;assert.throws(()=>decodeMobilePng(damaged),/PNG|CRC/);
});
test('mobile: reliable text clearing removes original glyph pixels; textured regions remain unchanged',()=>{
 const image=pixels();assert.ok(clearReliableText(image,rect));assert.deepEqual(Array.from(image.rgba.slice((15*64+16)*4,(15*64+16)*4+4)),[255,255,255,255]);
 const textured=pixels();for(let y=8;y<24;y++)textured.rgba.set([0,0,0,255],(y*64+7)*4);
 const before=textured.rgba.slice();assert.equal(clearReliableText(textured,rect),false);assert.deepEqual(textured.rgba,before);
});
test('mobile: native sources retain honest provenance and require updated schema',async()=>{
 const material=await raw({sourceKind:'ios_native'});assert.ok(isMobileMaterial(material));assert.equal(isMobileMaterial(new Uint8Array([1,2,3])),false);
 const {data}=await importMobileBundle(material);
 assert.equal(data.schemaVersion,'2.0.0');assert.equal(data.source.kind,'ios_native');assert.equal(data.source.url,undefined);
 assert.equal(data.screens[0].sourceOverride?.platform,'ios');assert.equal(validateV1(data),false);
 assert.throws(()=>parseCapturePackage({...data,source:{...data.source,url:'https://example.com'}}),/URL/);
 assert.deepEqual(await decodeCaptureZip(encodeCaptureZip(data)),data);
});
test('mobile: unrecognized App screenshots call offline OCR, replace reliable text, and retain image on OCR failure',async()=>{
 const material=await raw();let calls=0;
 const {data}=await importMobileBundle(material,async(_bytes,width,height)=>{calls++;assert.equal(width,64);assert.equal(height,48);return [{text:'电脑识别',bounds:rect,confidence:null,provenance:'ocr'}];});
 assert.equal(calls,1);assert.ok(data.screens[0].nodes.some(n=>n.text?.characters==='电脑识别'));
 const fallback=await importMobileBundle(material,async()=>{throw Error('unavailable');});assert.equal(fallback.data.screens[0].nodes.filter(n=>n.type==='TEXT').length,0);assert.ok(fallback.data.warnings.some(w=>w.message.includes('离线文字识别不可用')));
});
test('mobile: final asset has no old text beneath editable replacement',async()=>{
 const {data}=await importMobileBundle(await raw({observations:[{text:'已校对文字',bounds:rect,confidence:null,provenance:'user'}]}));
 const nodes=data.screens[0].nodes;assert.equal(nodes.filter(n=>n.type==='TEXT').length,1);
 const asset=data.assets.find(a=>a.assetId===nodes.find(n=>n.type==='IMAGE')?.assetId)!;
 const image=decodeMobilePng(Buffer.from(asset.inlineBase64!,'base64'))!;
 assert.deepEqual(Array.from(image.rgba.slice((15*64+16)*4,(15*64+16)*4+4)),[255,255,255,255]);
 assert.equal(nodes.find(n=>n.type==='TEXT')?.text?.characters,'已校对文字');
});
test('mobile: overlapping OCR stays rasterized instead of duplicating text',async()=>{
 const observations=[{text:'a',bounds:rect,confidence:null,provenance:'ocr' as const},{text:'b',bounds:{...rect,x:12},confidence:null,provenance:'ocr' as const}];
 const {data}=await importMobileBundle(await raw({observations}));assert.equal(data.screens[0].nodes.filter(n=>n.type==='TEXT').length,0);
 assert.ok(data.warnings.some(w=>w.code==='W_OCR_REGION_RETAINED'));
});
test('mobile: DOM basic text uses measured geometry and actual color',async()=>{
 const {data}=await importMobileBundle(await raw({sourceKind:'web',sourceUrl:'https://example.com/page',coordinateSpace:'css_pixels',webNodes:[{id:'title',kind:'text',bounds:rect,text:'网页标题',fontSize:14,color:'rgb(10, 20, 30)'}]}));
 const text=data.screens[0].nodes.find(n=>n.type==='TEXT')!;assert.deepEqual(text.rect,rect);
 assert.deepEqual(text.style.fills,[{kind:'solid',color:{r:10/255,g:20/255,b:30/255,a:1}}]);
});
test('mobile: measured DOM font family, weight, line height and alignment survive conversion',async()=>{
 const {data}=await importMobileBundle(await raw({sourceKind:'web',sourceUrl:'https://example.com/page',coordinateSpace:'css_pixels',webNodes:[{id:'styled',kind:'text',bounds:rect,text:'字体',fontSize:14,fontFamily:'"Arial", sans-serif',fontWeight:700,lineHeight:18,textAlign:'center'}]}));
 const text=data.screens[0].nodes.find(n=>n.type==='TEXT')!.text!;assert.equal(text.font.family,'Arial');assert.equal(text.font.weight,700);assert.equal(text.lineHeight,18);assert.equal(text.align,'center');
});
test('mobile: old web and mobile states coexist with independent source kinds and manual links',async()=>{
 const {data}=await importMobileBundle(await raw()),web=JSON.parse(await readFile('examples/figma-m0-probe.json','utf8')) as CapturePackage;web.artifactKind='capture';
 for(const inputs of [[web,data],[data,web]]){
  let project=emptyProject('project-mobile-test');for(const [i,input] of inputs.entries())project=addProjectStates(project,input,[],`n${i}`);
  assert.equal(project.data!.schemaVersion,'2.0.0');assert.equal(project.data!.screens.length,web.screens.length+1);
  assert.doesNotThrow(()=>parseCapturePackage(project.data));
  const [from,to]=project.data!.screens;
  project=editProject(project,'link',{screenId:from.id,nodeId:from.rootNodeId,targetId:to.id,action:'navigate',id:'manual'});
  assert.ok(project.data!.interactions.some(i=>i.id==='link-manual'));
 }
});
