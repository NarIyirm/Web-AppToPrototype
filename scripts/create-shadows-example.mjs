import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('examples/forms-m2.8.example.json','utf8'));
data.packageId='pkg-shadows-m2-9-example';data.producer.converterVersion='m2.9';data.requiredCapabilities=['absolute-layout'];data.source.title='人工外阴影样例 / 非网页证据';
data.screens[0].id='shadow-example';data.screens[0].name='原生外阴影人工样例';data.screens[0].nodes=data.screens[0].nodes.slice(0,2);const plate=data.screens[0].nodes[1];plate.id='shadow-plate';plate.type='SHAPE';plate.name='外阴影与底色 / 原生绘制层';plate.fidelity='approximated';delete plate.clipsContent;delete plate.style.border;
plate.style.effects=[{type:'drop_shadow',x:0,y:8,blur:20,spread:-4,color:{r:0,g:0,b:0,a:.3}},{type:'drop_shadow',x:0,y:0,blur:0,spread:2,color:{r:.6,g:.1,b:.3,a:1}}];
await writeFile('examples/shadows-m2.9.example.json',JSON.stringify(data,null,2)+'\n');
