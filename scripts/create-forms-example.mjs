import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));
data.packageId='pkg-forms-m2-8-example';data.producer.converterVersion='m2.8';data.requiredCapabilities=['absolute-layout'];data.source.title='人工表单与生成内容样例 / 非网页证据';
data.screens=[{...data.screens[0],id:'forms-example',rootNodeId:'root',name:'表单静态外观人工样例',nodes:[
  {id:'root',name:'人工样例',type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:280,height:140},style:{fills:[]},fidelity:'native'},
  {id:'field',name:'当前输入值 / 原生外框',type:'FRAME',parentId:'root',order:1,rect:{x:20,y:30,width:240,height:44},style:{fills:[{kind:'solid',color:{r:1,g:1,b:1,a:1}}],border:{width:1,color:{r:.4,g:.4,b:.4,a:1}},radii:[6,6,6,6]},fidelity:'native',clipsContent:true},
  {id:'value',name:'显示文字 / 可编辑',type:'TEXT',parentId:'field',order:2,rect:{x:12,y:10,width:210,height:24},style:{fills:[{kind:'solid',color:{r:.1,g:.1,b:.1,a:1}}]},fidelity:'native',text:{characters:'当前输入值',font:{family:'Arial',style:'Regular',weight:400,size:16},lineHeight:24,letterSpacing:0,align:'left',runs:[]}}
]}];data.assets=[];data.interactions=[];data.warnings=[];
await writeFile('examples/forms-m2.8.example.json',JSON.stringify(data,null,2)+'\n');
