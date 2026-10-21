import { writeFile, readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
function chunk(type, bytes) {
  const body=Buffer.concat([Buffer.from(type),bytes]);let crc=0xffffffff;
  for(const byte of body){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}
  const head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(bytes.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([head,body,tail]);
}
const bytes=await readFile('apps/desktop/fixtures/visual-wide.png'),hash=createHash('sha256').update(bytes).digest('hex');
const example=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));
example.packageId='pkg-visual-m2-4-example';example.requiredCapabilities=['absolute-layout','inline-images','image-placement','linear-gradients'];example.producer.converterVersion='m2.4';
example.screens=[{...example.screens[0],id:'visual-example',rootNodeId:'visual-root',name:'m2.4 人工视觉协议样例',nodes:[
  {id:'visual-root',parentId:null,name:'人工样例 / 非网页证据',type:'FRAME',order:0,rect:{x:0,y:0,width:500,height:240},style:{fills:[{kind:'solid',color:{r:1,g:1,b:1,a:1}}]},clipsContent:true,fidelity:'native'},
  {id:'image-clip',parentId:'visual-root',name:'图片裁切',type:'FRAME',order:1,rect:{x:20,y:20,width:150,height:210},style:{fills:[]},clipsContent:true,fidelity:'native'},
  {id:'placed-image',parentId:'image-clip',name:'cover / 85% 20%',type:'IMAGE',order:2,rect:{x:-229.5,y:0,width:420,height:210},style:{},assetId:hash,imageSizing:'stretch',fidelity:'native'},
  {id:'gradient',parentId:'visual-root',name:'135deg 原生渐变',type:'SHAPE',order:3,rect:{x:210,y:20,width:260,height:140},style:{fills:[{kind:'linear_gradient',angle:135,stops:[{position:0,color:{r:.77,g:.19,b:.28,a:.2}},{position:.65,color:{r:.18,g:.33,b:.75,a:.8}},{position:1,color:{r:.11,g:.5,b:.33,a:1}}]}]},fidelity:'native'}
]}];
example.screens[0].selection={...example.screens[0].selection,sourceNodeIds:['synthetic-visual'],originalRect:{x:0,y:0,width:500,height:240}};
example.assets=[{assetId:hash,sha256:hash,mime:'image/png',byteLength:bytes.length,width:320,height:160,inlineBase64:bytes.toString('base64')}];example.interactions=[];example.warnings=[];
await writeFile('examples/visual-m2.4.example.json',JSON.stringify(example,null,2)+'\n');
// Deterministic reference pixels, deliberately asymmetric: red/green top, blue/gold bottom.
for(const [name,width,height,alpha] of [['wide',320,160,false],['portrait',160,320,false],['alpha',320,160,true]]){
  const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=y*(1+width*4)+1+x*4;
    let rgba=[[196,48,72,255],[28,128,83,255],[45,85,190,255],[213,159,38,255]][(y>=height*.5?2:0)+(x>=width*.5?1:0)];
    if(x<8||y<8||x>=width-8||y>=height-8)rgba=[30,30,35,255];
    if(Math.abs(x-width*.35)<3||Math.abs(y-height*.65)<3)rgba=[255,255,255,255];
    if(alpha)rgba=[...rgba.slice(0,3),x<width*.2||y<height*.2?0:x<width*.5?128:255];
    raw.set(rgba,index);
  }
  await writeFile(`apps/desktop/fixtures/visual-${name}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
