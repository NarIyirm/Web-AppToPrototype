import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareFullPage,withFullPageSession,referencePositions,FULL_PAGE_LIMITS,type PageInfo,type FullPageAdapter} from '../apps/desktop/src/full-page';
import {previewPath} from '../apps/desktop/src/preview-path';
import {win32} from 'node:path';
function fixture(height=1500){let current:PageInfo={x:17,y:85,width:800,viewportHeight:300,height,revision:0,virtualized:false,cancelled:false,settled:true};let restored=0;const visits:number[]=[];
 const adapter:FullPageAdapter={async begin(){return {...current};},async scroll(y){visits.push(y);current={...current,x:0,y:Math.min(y,current.height-current.viewportHeight)};return {...current};},async restore(initial){restored++;current={...initial};return true;}};
 return {adapter,visits,get restored(){return restored;},change(value:Partial<PageInfo>){current={...current,...value};}};
}
const noop=()=>{};
test('loaded-content mode does not traverse the document and always restores the original position',async()=>{
 const f=fixture();const result=await withFullPageSession(f.adapter,()=>prepareFullPage(f.adapter,false,noop,noop));assert.deepEqual(f.visits,[0]);assert.equal(result.value.reason,'loaded');assert.equal(result.value.capturedHeight,1500);assert.equal(result.restored,true);assert.equal(f.restored,1);
});
test('scroll preparation follows appended content rather than stopping at the old document height',async()=>{
 const f=fixture(1000);const original=f.adapter.scroll;f.adapter.scroll=async y=>{if(y>=700)f.change({height:1800});return original(y);};
 const result=await prepareFullPage(f.adapter,true,noop,noop);assert.equal(result.documentHeight,1800);assert.equal(result.capturedHeight,1800);assert.equal(result.reason,'bottom');assert.ok(f.visits.at(-1)!>=1500);
});
test('step budget returns only the visited extent and marks the result partial',async()=>{
 const f=fixture(10000);const result=await prepareFullPage(f.adapter,true,noop,noop,{...FULL_PAGE_LIMITS,steps:2});assert.equal(result.reason,'step_limit');assert.equal(result.partial,true);assert.equal(result.steps,2);assert.equal(result.capturedHeight,f.visits.at(-1)!+300);assert.ok(result.capturedHeight<10000);
});
test('preparation deadline terminates independently of a growing page',async()=>{
 const f=fixture(10000);let clock=0;const result=await prepareFullPage(f.adapter,true,noop,()=>{clock+=200;},{...FULL_PAGE_LIMITS,prepareMs:300},()=>clock);assert.equal(result.reason,'time_limit');assert.equal(result.partial,true);assert.ok(result.steps<=2);
});
test('height budget clips loaded content without claiming the whole document',async()=>{
 const f=fixture(42000);const result=await prepareFullPage(f.adapter,false,noop,noop);assert.equal(result.capturedHeight,30000);assert.equal(result.documentHeight,42000);assert.equal(result.reason,'height_limit');assert.equal(result.partial,true);
});
test('virtualized content fails and session cleanup still restores exactly once',async()=>{
 const f=fixture();const original=f.adapter.scroll;f.adapter.scroll=async y=>{const info=await original(y);return {...info,virtualized:y>0};};
 await assert.rejects(withFullPageSession(f.adapter,()=>prepareFullPage(f.adapter,true,noop,noop)),/E_FULL_PAGE_VIRTUALIZED/);assert.equal(f.restored,1);
});
test('cancellation during preparation preserves the error and always runs cleanup',async()=>{
 const f=fixture();let cancel=false;await assert.rejects(withFullPageSession(f.adapter,()=>prepareFullPage(f.adapter,true,()=>{if(cancel)throw Error('E_CANCELLED');},()=>{cancel=true;})),/E_CANCELLED/);assert.equal(f.restored,1);
});
test('bounded reference sampling includes both ends and never pretends to be a continuous full-page bitmap',()=>{
 const plan=referencePositions(30000,600);assert.equal(plan.sampled,true);assert.equal(plan.positions.length,12);assert.equal(plan.positions[0],0);assert.equal(plan.positions.at(-1),29400);assert.equal(new Set(plan.positions).size,12);
 const short=referencePositions(1000,600);assert.equal(short.sampled,false);assert.deepEqual(short.positions,[0,400]);
});
test('cleanup failure is reported without hiding the original capture error',async()=>{
 const f=fixture();f.adapter.restore=async()=>{throw Error('restore failed');};await assert.rejects(withFullPageSession(f.adapter,async()=>{throw Error('primary failure');}),/primary failure/);const result=await withFullPageSession(f.adapter,async()=>42);assert.equal(result.value,42);assert.equal(result.restored,false);
});
test('reference sidecar paths cannot interpret imported screen IDs as directories',()=>{
 const path='E:\\captures\\batch.json';for(const id of ['../../outside','..\\outside','C:\\outside','a/b','a%2Fb']){const result=previewPath(path,id,'screen-1',2);assert.equal(win32.dirname(result),win32.dirname(path));assert.match(win32.basename(result),/^batch\.json\.id-[a-f0-9]{32}\.segment-2$/);}
 assert.equal(previewPath(path,'screen-2','screen-1'),path+'.screen-2');assert.equal(previewPath(path,'screen-1','screen-1'),path);
});
