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
import {reconstructMobileImage} from '../apps/desktop/src/mobile-reconstruct';

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
test('mobile: an editable text replacement has a clean native background without a full-screen bitmap',async()=>{
 const {data}=await importMobileBundle(await raw({observations:[{text:'已校对文字',bounds:rect,confidence:null,provenance:'user'}]}));
 const nodes=data.screens[0].nodes;assert.equal(nodes.filter(n=>n.type==='TEXT').length,1);
 assert.equal(nodes.filter(n=>n.type==='IMAGE').length,0);
 assert.deepEqual(nodes[0].style.fills,[{kind:'solid',color:{r:1,g:1,b:1,a:1}}]);
 assert.equal(nodes.find(n=>n.type==='TEXT')?.text?.characters,'已校对文字');
});

test('mobile: dense CJK-like glyph boxes on slightly noisy flat backgrounds become editable without erasing texture',()=>{
 const image={width:100,height:60,rgba:new Uint8Array(100*60*4)};
 for(let y=0;y<60;y++)for(let x=0;x<100;x++){const n=(x+y)%5;image.rgba.set([248+n,249+n,250+n,255],(y*100+x)*4);}
 for(let y=20;y<38;y++)for(let x=20;x<70;x++)if(x%4!==0&&y%4!==0)image.rgba.set([30,34,40,255],(y*100+x)*4);
 assert.equal(clearReliableText(image,{x:18,y:18,width:54,height:22}),true);
 for(let y=20;y<38;y++)for(let x=20;x<70;x++)image.rgba.set([x*3%256,y*7%256,(x+y)*9%256,255],(y*100+x)*4);
 const before=image.rgba.slice();
 assert.equal(clearReliableText(image,{x:18,y:18,width:54,height:22}),false);
 assert.deepEqual(image.rgba,before);
});

test('mobile: flat controls are native shapes, complex artwork is cropped, and no residual pixel is dropped',()=>{
 const image={width:160,height:120,rgba:new Uint8Array(160*120*4).fill(255)};
 for(let y=15;y<40;y++)for(let x=20;x<140;x++)image.rgba.set([8,96,200,255],(y*160+x)*4);
 for(let y=65;y<95;y++)for(let x=60;x<100;x++)image.rgba.set([x*17%200,y*13%200,(x+y)*19%200,255],(y*160+x)*4);
 const result=reconstructMobileImage(image);
 assert.ok(result.shapes.some(shape=>shape.rect.x===20&&shape.rect.y===15&&shape.rect.width===120&&shape.rect.height===25));
 assert.ok(result.images.length>0);assert.ok(result.images.every(part=>part.rect.width<160&&part.rect.height<120));
 // Recompose the non-text result. Quantisation may change flat fills by at most 7.
 const output=new Uint8Array(image.rgba.length);
 const fill=(rect:typeof result.shapes[number]['rect'],color:typeof result.background)=>{for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++)output.set([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),255],(y*160+x)*4);};
 fill({x:0,y:0,width:160,height:120},result.background);
 for(const shape of result.shapes)fill(shape.rect,shape.color);
 for(const part of result.images)for(let y=0;y<part.image.height;y++)for(let x=0;x<part.image.width;x++){
  const p=(y*part.image.width+x)*4;if(part.image.rgba[p+3])output.set(part.image.rgba.subarray(p,p+4),((part.rect.y+y)*160+part.rect.x+x)*4);
 }
 for(let i=0;i<output.length;i++)assert.ok(Math.abs(output[i]-image.rgba[i])<=7,`pixel channel ${i}`);
});

test('mobile: reconstruction preserves logical coordinates and source attribution for editable App layers',async()=>{
 const image={width:160,height:120,rgba:new Uint8Array(160*120*4).fill(255)};
 for(let y=15;y<40;y++)for(let x=20;x<140;x++)image.rgba.set([8,96,200,255],(y*160+x)*4);
 const {data}=await importMobileBundle(await raw({sourceKind:'ios_native',width:160,height:120,logicalWidth:80,logicalHeight:60},image));
 const shape=data.screens[0].nodes.find(n=>n.type==='SHAPE')!;
 assert.deepEqual(shape.rect,{x:10,y:7.5,width:60,height:12.5});assert.equal(shape.fidelity,'approximated');
 assert.equal(data.source.kind,'ios_native');assert.equal(data.producer.converterVersion,'mobile-desktop-2');
 assert.equal(data.screens[0].nodes.filter(n=>n.type==='IMAGE').length,0);
 assert.ok(data.warnings.some(w=>w.code==='W_MOBILE_RECONSTRUCTED'));
});

test('mobile: transparent artwork retains its alpha instead of gaining an inferred opaque background',()=>{
 const image=pixels();image.rgba[3]=0;
 const result=reconstructMobileImage(image);
 assert.equal(result.background.a,0);assert.equal(result.shapes.length,0);assert.equal(result.images.length,1);
 assert.deepEqual(result.images[0].image.rgba,image.rgba);
});

test('mobile: nested artwork crop bounds do not duplicate another image region underneath',()=>{
 const image={width:160,height:120,rgba:new Uint8Array(160*120*4).fill(255)};
 for(let y=10;y<105;y++)for(let x=10;x<150;x++)if(x===10||x===149||y===10||y===104)image.rgba.set([0,0,0,255],(y*160+x)*4);
 for(let y=40;y<70;y++)for(let x=50;x<90;x++)image.rgba.set((x+y)%2?[30,180,60,255]:[180,40,90,255],(y*160+x)*4);
 const result=reconstructMobileImage(image),counts=new Uint8Array(160*120);
 assert.ok(result.images.length>=2);
 for(const part of result.images)for(let y=0;y<part.image.height;y++)for(let x=0;x<part.image.width;x++)if(part.image.rgba[(y*part.image.width+x)*4+3])counts[(part.rect.y+y)*160+part.rect.x+x]++;
 assert.ok(counts.every(count=>count<=1));assert.equal(counts[50*160+60],1);
});

test('mobile: OCR word spacing and long labels produce complete editable text at a bounded font size',async()=>{
 const {data}=await importMobileBundle(await raw({observations:[{text:'更 换 项 目 。',bounds:rect,confidence:.9,provenance:'ocr'}]}));
 const node=data.screens[0].nodes.find(n=>n.type==='TEXT')!;
 assert.equal(node.text!.characters,'更换项目。');assert.ok(node.text!.font.size<5);
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
