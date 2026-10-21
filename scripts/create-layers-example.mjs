import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));
const rect=(x,y,width,height)=>({x,y,width,height}),solid=(r,g,b)=>({fills:[{kind:'solid',color:{r,g,b,a:1}}]});
data.packageId='pkg-layers-m2-6-example';data.producer.converterVersion='m2.6';data.requiredCapabilities=['absolute-layout'];data.source.title='人工层叠裁切样例 / 非网页证据';
data.screens=[{...data.screens[0],id:'layers-example',rootNodeId:'layers-root',name:'原生层叠裁切人工样例',selection:{...data.screens[0].selection,sourceNodeIds:['synthetic-layers'],originalRect:rect(0,0,420,240)},nodes:[
  {id:'layers-root',name:'人工样例',type:'FRAME',parentId:null,order:0,rect:rect(0,0,420,240),style:solid(1,1,1),fidelity:'native',clipsContent:true},
  {id:'normal',name:'普通祖先背景',type:'FRAME',parentId:'layers-root',order:1,rect:rect(20,20,220,180),style:solid(.91,.86,.89),fidelity:'native'},
  {id:'blue',name:'较低蓝色层',type:'SHAPE',parentId:'layers-root',order:2,rect:rect(140,100,200,110),style:solid(.18,.33,.75),fidelity:'native'},
  {id:'lifted-clip',name:'层叠裁切 / 原生Frame',type:'FRAME',parentId:'layers-root',order:3,rect:rect(35,35,210,150),style:{fills:[],radii:[16,16,16,16]},fidelity:'native',clipsContent:true},
  {id:'red',name:'较高红色层 / 保留裁切',type:'SHAPE',parentId:'lifted-clip',order:4,rect:rect(-20,-20,270,190),style:solid(.77,.19,.28),fidelity:'native'}
]}];data.assets=[];data.interactions=[];data.warnings=[];
await writeFile('examples/layers-m2.6.example.json',JSON.stringify(data,null,2)+'\n');
