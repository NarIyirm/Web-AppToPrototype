import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('examples/capture-package.v1.example.json','utf8'));
data.packageId='pkg-text-m2-5-example';data.producer.converterVersion='m2.5';data.requiredCapabilities=['absolute-layout','styled-text'];data.source.title='人工富文本协议样例 / 非网页采集';
const font={family:'Arial',style:'Regular',weight:400,size:20,fallbacks:['Microsoft YaHei','sans-serif']};
let characters='';const runs=[];
for(const [text,style,color,decoration] of [['普通 ','Regular',{r:.15,g:.15,b:.18,a:1},'none'],['Bold ','Bold',{r:.63,g:.13,b:.29,a:1},'underline'],['👩‍💻','Italic',{r:.14,g:.31,b:.59,a:.8},'none']]){
  const start=characters.length;characters+=text;runs.push({start,end:characters.length,font:{...font,style,weight:style==='Bold'?700:400},color,letterSpacing:0,decoration});
}
data.screens=[{...data.screens[0],id:'text-example',name:'人工富文本 / 非网页证据',rootNodeId:'text-root',selection:{...data.screens[0].selection,sourceNodeIds:['synthetic-text'],originalRect:{x:0,y:0,width:500,height:150}},nodes:[
  {id:'text-root',name:'人工样例',type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:500,height:150},style:{fills:[{kind:'solid',color:{r:1,g:1,b:1,a:1}}]},fidelity:'native'},
  {id:'rich-text',name:characters,type:'TEXT',parentId:'text-root',order:1,rect:{x:20,y:30,width:440,height:32},style:{fills:[{kind:'solid',color:{r:.15,g:.15,b:.18,a:1}}]},fidelity:'native',text:{characters,font,lineHeight:32,letterSpacing:0,align:'left',runs}}
]}];data.assets=[];data.interactions=[];data.warnings=[];
await writeFile('examples/text-m2.5.example.json',JSON.stringify(data,null,2)+'\n');
