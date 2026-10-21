import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {graphemes,transformedText,mergeTextLines,type TextFragment} from '../apps/desktop/src/text';
import {resolveFont} from '../apps/figma-plugin/src/font-resolver';
import {parseCapturePackage,type SceneNode,type Font,type CapturePackage} from '../packages/contracts/src/index';
const base:Font={family:'Arial',style:'Regular',weight:400,size:20};
function fragment(id:string,text:string,x:number,sequence:number,font=base,ownerId='root'):TextFragment{
  const node:SceneNode={id,name:text,type:'TEXT',parentId:'inline-'+id,order:sequence+1,rect:{x:0,y:0,width:50.5,height:30},fidelity:'native',style:{fills:[]},text:{characters:text,font,lineHeight:30,letterSpacing:0,align:'left',runs:[{start:0,end:text.length,font,color:{r:1,g:0,b:0,a:.5},decoration:'none'}]}};
  return {node,ownerId,ownerRect:{x:10,y:20,width:500,height:100},absolute:{x,y:30,width:50,height:30},sequence};
}
test('graphemes keep ZWJ emoji, flags, combining marks and UTF-16 offsets intact',()=>{
  const text='A👩‍💻👨‍👩‍👧‍👦🇦🇺éB';const values=graphemes(text);
  assert.deepEqual(values.map(v=>v.segment),['A','👩‍💻','👨‍👩‍👧‍👦','🇦🇺','é','B']);
  for(const v of values)assert.equal(text.slice(v.index,v.index+v.segment.length),v.segment);
});
test('common CSS casing handles expansions and locale without changing source offsets',()=>{
  assert.equal(transformedText('straße','uppercase','de'),'STRASSE');assert.equal(transformedText('istanbul','uppercase','tr'),'İSTANBUL');
  assert.equal(transformedText('LOWER','lowercase','en'),'lower');assert.equal(transformedText('Mixed','capitalize'),'Mixed');
});
test('same visual line joins native styles and remaps UTF-16 runs to a shared owner',()=>{
  const a=fragment('a','👩‍💻 ',20,0),b=fragment('b','Bold',70,1,{...base,style:'Bold',weight:700});
  const nodes=[a.node,b.node],merged=mergeTextLines(nodes,[a,b],()=>assert.fail('not fragmented'));
  assert.equal(merged.length,1);assert.equal(merged[0].parentId,'root');assert.equal(merged[0].rect.x,10);assert.equal(merged[0].rect.width,100.5);
  assert.equal(merged[0].text!.characters,'👩‍💻 Bold');assert.equal(merged[0].text!.runs[1].start,'👩‍💻 '.length);assert.equal(merged[0].text!.runs[1].font.weight,700);assert.equal(nodes[0].text!.characters,'👩‍💻 ');
});
test('merge never crosses new lines, positioning gaps, overlap, different owners or unsafe fragments',()=>{
  for(const change of [(b:TextFragment)=>b.absolute.y+=32,(b:TextFragment)=>b.absolute.x+=12,(b:TextFragment)=>b.absolute.x-=12,(b:TextFragment)=>b.ownerId='other',(b:TextFragment)=>b.join=false,(b:TextFragment)=>b.sequence=4]){
    const a=fragment('a','A',20,0),b=fragment('b','B',70,1);change(b);assert.equal(mergeTextLines([a.node,b.node],[a,b],()=>{}).length,2);
  }
});
test('mixed font sizes stay native fragments and explicitly report fragmentation',()=>{
  const a=fragment('a','A',20,0),b=fragment('b','B',70,1,{...base,size:28});b.absolute.y-=4;const warnings:string[]=[];
  assert.equal(mergeTextLines([a.node,b.node],[a,b],id=>warnings.push(id)).length,2);assert.deepEqual(warnings,['root']);
});
test('font resolver uses CSS fallback order and deterministic nearest weight plus italic',()=>{
  const available=[{family:'Arial',style:'Regular'},{family:'Arial',style:'Bold'},{family:'Arial',style:'Italic'},{family:'Arial',style:'Bold Italic'},{family:'Inter',style:'Bold'}];
  assert.deepEqual(resolveFont({...base,family:'Missing',style:'Bold',weight:700,fallbacks:['Arial','Inter']},available),{font:{family:'Arial',style:'Bold'},reason:'css-fallback'});
  assert.equal(resolveFont({...base,style:'Semi Bold Italic',weight:600},available).font.style,'Bold Italic');
  assert.deepEqual(resolveFont(base,[...available].reverse()),resolveFont(base,available));
  assert.equal(resolveFont({...base,family:'Missing'},available).font.family,'Arial');assert.throws(()=>resolveFont(base,[]));
});
test('styled-text capability gates new run properties and ordered font fallback stacks; old runs remain accepted',()=>{
  const data=JSON.parse(readFileSync('examples/capture-package.v1.example.json','utf8')) as CapturePackage;
  assert.equal(parseCapturePackage(data,true).screens.length,2);
  const text=data.screens[0].nodes.find(n=>n.type==='TEXT')!.text!;text.characters='A😀B';text.runs=[{start:1,end:3,font:{...base,fallbacks:['Arial']},color:{r:1,g:0,b:0,a:.5},decoration:'underline',letterSpacing:2}];
  assert.throws(()=>parseCapturePackage(data,true),/styled-text capability/);data.requiredCapabilities=['styled-text'];assert.equal(parseCapturePackage(data,true).schemaVersion,'1.0.0');
  text.runs[0].end=2;assert.throws(()=>parseCapturePackage(data,true),/text run/);text.runs[0].end=3;text.runs[0].color!.a=2;assert.throws(()=>parseCapturePackage(data,true),/E_PACKAGE_INVALID/);
});
test('m2.5 sample is valid explicit example data and never mistaken for a real capture',()=>{
  const data=JSON.parse(readFileSync('examples/text-m2.5.example.json','utf8'));assert.equal(parseCapturePackage(data,true).artifactKind,'example');assert.throws(()=>parseCapturePackage(data),/DEVELOPMENT_MODE/);
});
