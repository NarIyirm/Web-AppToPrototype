import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));
data.packageId='pkg-svg-m2-7-example';data.producer.converterVersion='m2.7';data.requiredCapabilities=['absolute-layout','inline-svg'];data.source.title='人工SVG样例 / 非网页证据';
data.screens=[{...data.screens[0],id:'svg-example',rootNodeId:'root',name:'原生SVG人工样例',nodes:[
  {id:'root',name:'人工样例',type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:240,height:160},style:{fills:[]},fidelity:'native',clipsContent:true},
  {id:'check-icon',name:'SVG / 可编辑勾选',type:'VECTOR',parentId:'root',order:1,rect:{x:20,y:20,width:72,height:72},style:{},fidelity:'native',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="#a0204b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 12L9 17L20 6"/></svg>'}
]}];data.assets=[];data.interactions=[];data.warnings=[];
await writeFile('examples/svg-m2.7.example.json',JSON.stringify(data,null,2)+'\n');
