import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import type {BridgeDelivery,BridgeTarget,ImportReport} from '../packages/contracts/src/bridge';
import {importMobileBundle} from '../apps/desktop/src/mobile-import';
const source=build({entryPoints:['apps/figma-plugin/src/main.ts'],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',define:{__html__:'""'}}).then(result=>result.outputFiles[0].text);
test('synthetic Figma host: mobile v2 material imports through the same preflight without claiming a web source',async()=>{
 const f=await fixture(),{data}=await importMobileBundle(await readFile('examples/mobile-material.w2pm.zip'));
 f.delivery.data=data;f.delivery.job.packageId=data.packageId;f.delivery.job.revision=data.revision;
 f.figma.base64Decode=(value:string)=>new Uint8Array(Buffer.from(value,'base64'));
 f.figma.createImage=()=>({hash:'mobile-synthetic-image',async getSizeAsync(){return {width:data.assets[0].width,height:data.assets[0].height};}});
 await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
 const result=f.messages.find(m=>m.type==='bridge-result')!.data;
 assert.ok(result.report,result.error);assert.equal(result.report.versions.schema,'2.0.0');
 assert.equal(result.report.counts.screens,1);assert.equal(data.source.kind,'imported_image');assert.equal(data.source.url,undefined);
});
async function fixture(){
  const store=new Map<string,unknown>(),nodes=new Map<string,any>(),events=new Map<string,()=>void>(),messages:Array<{type:string;data:any}>=[];
  let next=1;let onCreate:((node:any)=>void)|undefined;let failLastReport=false;
  function node(type:string,id=`synthetic:${next++}`):any{
    const data=new Map<string,string>();const result:any={id,type,name:type,x:0,y:0,width:100,height:100,visible:true,removed:false,children:[],parent:null,fills:[],strokes:[],topLeftRadius:0,topRightRadius:0,bottomRightRadius:0,bottomLeftRadius:0,
      resize(width:number,height:number){this.width=width;this.height=height;},
      appendChild(child:any){if(child.parent)child.parent.children=child.parent.children.filter((n:any)=>n!==child);this.children.push(child);child.parent=this;},
      remove(){for(const child of [...this.children])child.remove();this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter((n:any)=>n!==this);},
      rangeCalls:[] as any[],setPluginData(key:string,value:string){data.set(key,value);},getPluginData(key:string){return data.get(key)??'';},async setReactionsAsync(){},
      setRangeFontName(start:number,end:number,value:any){this.rangeCalls.push({kind:'font',start,end,value});},setRangeFontSize(start:number,end:number,value:any){this.rangeCalls.push({kind:'size',start,end,value});},
      setRangeFills(start:number,end:number,value:any){this.rangeCalls.push({kind:'fills',start,end,value});},setRangeLetterSpacing(start:number,end:number,value:any){this.rangeCalls.push({kind:'spacing',start,end,value});},setRangeTextDecoration(start:number,end:number,value:any){this.rangeCalls.push({kind:'decoration',start,end,value});}
    };nodes.set(id,result);return result;
  }
  const page=node('PAGE','0:1'),other=node('PAGE','0:2');const unrelated=node('FRAME','unrelated');page.appendChild(unrelated);
  const figma:any={root:{name:'Synthetic file'},currentPage:page,showUI(){},on(name:string,callback:()=>void){events.set(name,callback);},
    ui:{postMessage(msg:any){messages.push(msg);},onmessage:undefined},viewport:{scrollAndZoomIntoView(){}},commitUndo(){},
    clientStorage:{async getAsync(key:string){return store.get(key);},async setAsync(key:string,value:unknown){if(failLastReport&&key==='last-report')throw Error('synthetic disk failure');store.set(key,structuredClone(value));},async deleteAsync(key:string){store.delete(key);}},
    async listAvailableFontsAsync(){return ['Microsoft YaHei','Inter','Arial'].map(family=>({fontName:{family,style:'Regular'}}));},async loadFontAsync(){},
    async getNodeByIdAsync(id:string){const found=nodes.get(id);return found&&!found.removed?found:null;}
  };
  for(const [method,type] of [['createSection','SECTION'],['createFrame','FRAME'],['createText','TEXT'],['createRectangle','RECTANGLE']])figma[method]=()=>{const output=node(type);figma.currentPage.appendChild(output);onCreate?.(output);return output;};
  figma.createNodeFromSvg=(svg:string)=>{const output=node('FRAME');output.svgInput=svg;output.width=Number(svg.match(/width="([\d.]+)"/)?.[1]??100);output.height=Number(svg.match(/height="([\d.]+)"/)?.[1]??100);output.appendChild(node('VECTOR'));figma.currentPage.appendChild(output);onCreate?.(output);return output;};
  runInContext(await source,createContext({figma,setTimeout,clearTimeout,console}));
  await figma.ui.onmessage({type:'bridge-context'});const target=messages.find(m=>m.type==='bridge-context')!.data as BridgeTarget;
  const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));data.artifactKind='capture';data.packageId='synthetic-plugin-bridge';
  const delivery:BridgeDelivery={job:{id:'synthetic-job',importId:'bridge-synthetic-job',packageId:data.packageId,revision:1,target,status:'importing',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),total:data.screens.reduce((sum:number,s:any)=>sum+s.nodes.length,0),completed:0,message:'synthetic'},data};
  return {figma,page,other,unrelated,nodes,delivery,messages,changePage(){figma.currentPage=other;events.get('currentpagechange')?.();},onCreate(fn:(node:any)=>void){onCreate=fn;},failLastReport(){failLastReport=true;}};
}
test('synthetic Figma host: stable importId replays its receipt without duplicate nodes',async()=>{
  const f=await fixture();await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  const first=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(first.report,first.error);const count=[...f.nodes.values()].filter(n=>!n.removed).length;
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const second=f.messages.filter(m=>m.type==='bridge-result').at(-1)!.data;
  assert.equal(second.report.importId,first.report.importId);assert.equal([...f.nodes.values()].filter(n=>!n.removed).length,count);assert.equal(f.unrelated.removed,false);
});
test('synthetic Figma host: a changed page cannot receive the paired job',async()=>{
  const f=await fixture();f.changePage();await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  assert.match(f.messages.find(m=>m.type==='bridge-result')!.data.error,/E_TARGET_CHANGED/);assert.equal(f.page.children.length,1);assert.equal(f.other.children.length,0);
});
test('synthetic Figma host: missing target binding fails before writing any nodes',async()=>{
  const f=await fixture();delete (f.delivery.job as any).target;await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  assert.match(f.messages.find(m=>m.type==='bridge-result')!.data.error,/E_JOB_INVALID/);assert.equal(f.page.children.length,1);
});
test('synthetic Figma host: viewport positioning failure does not turn committed layers into a failed import',async()=>{
  const f=await fixture();f.figma.viewport.scrollAndZoomIntoView=()=>{throw Error('synthetic viewport failure');};await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  assert.ok(result.report.rootNodeIds.every((id:string)=>f.nodes.get(id).getPluginData('state')==='committed'));
});
test('synthetic Figma host: changing page mid-import removes only this staging tree',async()=>{
  const f=await fixture();f.onCreate(node=>{if(node.type==='TEXT')f.changePage();});await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  assert.ok(f.messages.find(m=>m.type==='bridge-result')!.data.error);assert.equal(f.unrelated.removed,false);assert.equal(f.page.children.length,1);assert.equal(f.other.children.length,0);
});
test('synthetic Figma host: committed receipt survives last-report cache failure and missing roots never recreate',async()=>{
  const f=await fixture();f.failLastReport();await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  const report=f.messages.find(m=>m.type==='bridge-result')!.data.report as ImportReport;assert.ok(report);
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});assert.ok(f.messages.filter(m=>m.type==='bridge-result').at(-1)!.data.report);
  const count=f.nodes.size;f.nodes.get(report.rootNodeIds[0]).remove();await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  assert.match(f.messages.filter(m=>m.type==='bridge-result').at(-1)!.data.error,/E_IMPORT_INTERRUPTED/);assert.equal(f.nodes.size,count);
});

test('synthetic Figma host: imports native gradients and positioned images while retaining old-package FILL',async()=>{
  const f=await fixture();
  const probe=JSON.parse(await readFile('examples/figma-m0-probe.json','utf8'));
  const asset=probe.assets[0];f.delivery.data.assets=[asset];f.delivery.data.requiredCapabilities=['image-placement','linear-gradients'];
  f.figma.base64Decode=(value:string)=>new Uint8Array(Buffer.from(value,'base64'));
  f.figma.createImage=()=>({hash:'synthetic-image-hash',async getSizeAsync(){return {width:asset.width,height:asset.height};}});
  const root=f.delivery.data.screens[0].nodes[0];
  root.style.fills=[{kind:'linear_gradient',angle:90,stops:[{position:0,color:{r:1,g:0,b:0,a:.2}},{position:1,color:{r:0,g:0,b:1,a:1}}]}];
  const image={...probe.screens[0].nodes.find((n:any)=>n.type==='IMAGE'),id:'placed-image',parentId:root.id,rect:{x:-50,y:10,width:300,height:150},imageSizing:'stretch'};
  f.delivery.data.screens[0].nodes.push(image,{...image,id:'legacy-image',imageSizing:undefined});
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  const output=(id:string)=>f.nodes.get(result.report.nodeMap.find((m:any)=>m.sceneNodeId===id&&m.screenId===f.delivery.data.screens[0].id).figmaNodeId);
  assert.equal(output(root.id).fills[0].type,'GRADIENT_LINEAR');assert.equal(output(root.id).fills[0].gradientStops[0].color.a,.2);
  assert.equal(output('placed-image').fills[0].scaleMode,'CROP');assert.equal(output('placed-image').x,-50);assert.equal(output('placed-image').width,300);
  assert.equal(output('legacy-image').fills[0].scaleMode,'FILL');
});

test('synthetic Figma host: styled UTF-16 ranges preserve color, font stack, tracking and decoration',async()=>{
  const f=await fixture(),example=JSON.parse(await readFile('examples/text-m2.5.example.json','utf8'));
  f.delivery.data={...example,artifactKind:'capture',packageId:f.delivery.data.packageId};
  f.figma.listAvailableFontsAsync=async()=>['Regular','Bold','Italic'].map(style=>({fontName:{family:'Arial',style}}));
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});
  const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  const node=f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId==='rich-text').figmaNodeId);
  assert.equal(node.characters,'普通 Bold 👩‍💻');assert.equal(node.rangeCalls.filter((c:any)=>c.kind==='fills').length,3);
  const bold=node.rangeCalls.find((c:any)=>c.kind==='font'&&c.value.style==='Bold');assert.equal(bold.start,3);assert.equal(bold.end,8);
  assert.equal(node.rangeCalls.find((c:any)=>c.kind==='decoration'&&c.start===3).value,'UNDERLINE');
  assert.equal(node.rangeCalls.find((c:any)=>c.kind==='spacing').value.unit,'PIXELS');
});
test('synthetic Figma host: font substitutions explain the requested stack and actual choice',async()=>{
  const f=await fixture();const text=f.delivery.data.screens[0].nodes.find(n=>n.type==='TEXT')!.text!;
  text.font={...text.font,family:'Missing Font',style:'Bold',weight:700,fallbacks:['Arial','Inter']};f.delivery.data.requiredCapabilities=['styled-text'];
  f.figma.listAvailableFontsAsync=async()=>[{fontName:{family:'Arial',style:'Regular'}},{fontName:{family:'Arial',style:'Bold'}},{fontName:{family:'Inter',style:'Regular'}}];
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const report=f.messages.find(m=>m.type==='bridge-result')!.data.report;
  assert.ok(report);const warning=report.warnings.find((w:any)=>w.code==='E_FONT_MISSING'&&w.details.requested.family==='Missing Font');
  assert.equal(warning.details.reason,'css-fallback');assert.equal(warning.details.chosen.family,'Arial');assert.equal(warning.details.chosen.style,'Bold');assert.equal(warning.details.glyphCoverage,'unverified');
});

test('synthetic Figma host: native layer order and rounded clip trees import without new capabilities',async()=>{
  const f=await fixture(),example=JSON.parse(await readFile('examples/layers-m2.6.example.json','utf8'));
  f.delivery.data={...example,artifactKind:'capture',packageId:f.delivery.data.packageId};
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  const output=(id:string)=>f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId===id).figmaNodeId);
  assert.deepEqual(output('layers-root').children.map((n:any)=>n.name),['普通祖先背景','较低蓝色层','层叠裁切 / 原生Frame']);
  const clip=output('lifted-clip');assert.equal(clip.clipsContent,true);assert.equal(clip.topLeftRadius,16);assert.equal(output('red').parent.id,clip.id);assert.equal(output('red').x,-20);assert.equal(result.report.counts.nodes,5);
});

test('synthetic Figma host: SVG import retains native paths and scales content through SVG viewport',async()=>{
  const f=await fixture(),example=JSON.parse(await readFile('examples/svg-m2.7.example.json','utf8'));f.delivery.data={...example,artifactKind:'capture',packageId:f.delivery.data.packageId};
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  const icon=f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId==='check-icon').figmaNodeId);
  assert.equal(icon.type,'FRAME');assert.equal(icon.children[0].type,'VECTOR');assert.equal(icon.width,72);assert.equal(icon.x,20);assert.match(icon.svgInput,/width="72" height="72" viewBox="0 0 24 24" preserveAspectRatio="none"/);assert.match(icon.svgInput,/stroke="#a0204b"/);assert.equal(result.report.counts.images,0);
});
test('synthetic Figma host: SVG root opacity is retained when applying scene opacity',async()=>{
  const f=await fixture(),example=JSON.parse(await readFile('examples/svg-m2.7.example.json','utf8'));f.delivery.data={...example,artifactKind:'capture',packageId:f.delivery.data.packageId};
  f.delivery.data.screens[0].nodes[1].style.opacity=.5;
  const create=f.figma.createNodeFromSvg;f.figma.createNodeFromSvg=(svg:string)=>{const node=create(svg);node.opacity=.4;return node;};
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  assert.equal(f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId==='check-icon').figmaNodeId).opacity,.2);
});
test('synthetic Figma host: unsafe SVG preflight leaves every existing user node untouched',async()=>{
  const f=await fixture(),example=JSON.parse(await readFile('examples/svg-m2.7.example.json','utf8'));f.delivery.data={...example,artifactKind:'capture',packageId:f.delivery.data.packageId};f.delivery.data.screens[0].nodes[1].svg='<svg><use href="https://example.com/x.svg#p"/></svg>';
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;
  assert.match(result.error,/E_SVG_UNSUPPORTED/);assert.equal(f.page.children.length,1);assert.equal(f.unrelated.removed,false);
});

test('synthetic Figma host: native background shadow plate keeps ordered effects separate from overflowing children',async()=>{
  const f=await fixture();const root=f.delivery.data.screens[0].nodes[0];
  const plate:any={id:'shadow-plate',name:'外阴影与底色 / 原生绘制层',type:'SHAPE',parentId:root.id,order:1,rect:{x:12,y:14,width:120,height:70},fidelity:'approximated',style:{fills:[{kind:'solid',color:{r:1,g:1,b:1,a:1}}],radii:[8,8,8,8],effects:[{type:'drop_shadow',x:-2,y:4,blur:12,spread:-3,color:{r:0,g:0,b:0,a:.3}},{type:'drop_shadow',x:0,y:0,blur:0,spread:2,color:{r:1,g:0,b:0,a:1}}]}};
  f.delivery.data.screens[0].nodes=[root,plate];f.delivery.data.screens=f.delivery.data.screens.slice(0,1);f.delivery.data.interactions=[];
  await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);
  const output=f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId===plate.id).figmaNodeId);
  assert.equal(output.type,'RECTANGLE');assert.equal(output.topLeftRadius,8);assert.equal(output.effects.length,2);assert.equal(output.effects[0].radius,12);assert.equal(output.effects[0].spread,-3);assert.equal(output.effects[1].spread,2);assert.equal(output.effects[0].showShadowBehindNode,false);assert.equal(output.opacity,1);
});

test('synthetic Figma host: twenty independent imports keep committed roots, bounded receipts and native reactions',async()=>{
 const f=await fixture();let reactions=0;f.onCreate(node=>{node.setReactionsAsync=async(value:any)=>{assert.ok(value[0].trigger.type==='ON_CLICK');reactions++;};});
 for(let i=0;i<20;i++){const delivery=structuredClone(f.delivery);delivery.job.id='stress-'+i;delivery.job.importId='bridge-stress-'+i;delivery.data.packageId=delivery.job.packageId='stress-'+i;await f.figma.ui.onmessage({type:'bridge-import',data:delivery});const result=f.messages.filter(m=>m.type==='bridge-result').at(-1)!.data;assert.ok(result.report,result.error);assert.equal(result.report.counts.interactions,2);}
 assert.equal(reactions,40);assert.equal(f.unrelated.removed,false);assert.ok(f.page.children.filter((n:any)=>n.id!=='unrelated').every((n:any)=>n.getPluginData('state')==='committed'));assert.equal(f.page.children.length,41);
});
test('synthetic Figma host: optional native Auto Layout is applied after children without forcing complex scenes',async()=>{
 const f=await fixture(),root=f.delivery.data.screens[0].nodes[0];f.delivery.data.requiredCapabilities=['auto-layout'];root.layout={mode:'horizontal',gap:12,padding:[10,20,30,40]};await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);const out=f.nodes.get(result.report.nodeMap.find((n:any)=>n.sceneNodeId===root.id&&n.screenId===f.delivery.data.screens[0].id).figmaNodeId);assert.equal(out.layoutMode,'HORIZONTAL');assert.equal(out.paddingLeft,40);assert.equal(out.itemSpacing,12);assert.equal(out.primaryAxisSizingMode,'FIXED');
});

test('synthetic Figma host: real three-state project actions resolve to page-level destinations and close has no target',async()=>{
 const {emptyProject,addProjectStates,editProject}=await import('../apps/desktop/src/project');const f=await fixture(),source=structuredClone(f.delivery.data);source.screens=source.screens.slice(0,1);source.interactions=[];let p=emptyProject('project-reactions');for(const id of ['a','b','c'])p=addProjectStates(p,source,[],id);const [a,b,c]=p.data!.screens;
 p=editProject(p,'link',{screenId:a.id,nodeId:a.rootNodeId,action:'navigate',targetId:b.id,id:'ab'});p=editProject(p,'link',{screenId:b.id,nodeId:b.rootNodeId,action:'open_overlay',targetId:c.id,id:'bc'});p=editProject(p,'link',{screenId:c.id,nodeId:c.rootNodeId,action:'close_overlay',id:'close'});
 f.onCreate(node=>{node.setReactionsAsync=async(value:any)=>{node.reactions=value;};});f.delivery.data=p.data!;f.delivery.job.packageId=p.data!.packageId;f.delivery.job.revision=p.data!.revision;f.delivery.job.total=p.data!.screens.reduce((n,s)=>n+s.nodes.length,0);await f.figma.ui.onmessage({type:'bridge-import',data:f.delivery});const result=f.messages.find(m=>m.type==='bridge-result')!.data;assert.ok(result.report,result.error);const outputs=[a,b,c].map(s=>f.nodes.get(result.report.nodeMap.find((m:any)=>m.screenId===s.id&&m.sceneNodeId===s.rootNodeId).figmaNodeId));
 assert.equal(outputs[0].reactions[0].actions[0].destinationId,outputs[1].id);assert.equal(outputs[1].reactions[0].actions[0].navigation,'OVERLAY');assert.equal(outputs[2].reactions[0].actions[0].type,'CLOSE');assert.ok(outputs.every(n=>n.parent===f.page));
});

