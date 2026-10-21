import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generatedContent,passwordMask,absolutePseudoBox} from '../apps/desktop/src/appearance';
import {readFile} from 'node:fs/promises';
import {parseCapturePackage} from '../packages/contracts/src/index';
const css=(overrides:Partial<CSSStyleDeclaration>={})=>({position:'absolute',width:'50px',height:'20px',boxSizing:'content-box',left:'10px',right:'auto',top:'5px',bottom:'auto',marginLeft:'0px',marginRight:'0px',marginTop:'0px',marginBottom:'0px',paddingLeft:'4px',paddingRight:'4px',paddingTop:'2px',paddingBottom:'2px',borderLeftWidth:'1px',borderRightWidth:'1px',borderTopWidth:'1px',borderBottomWidth:'1px',...overrides} as CSSStyleDeclaration);
test('generated content distinguishes absent content from painted empty strings',()=>{
  assert.equal(generatedContent('none'),null);assert.equal(generatedContent('normal'),null);assert.equal(generatedContent('""'),'');assert.equal(generatedContent('"NEW"'),'NEW');
});
test('generated content decodes CSS strings without executing attr/counter/URL expressions',()=>{
  assert.equal(generatedContent('"A\\41  \\2713" "标签"'),'AA ✓标签');
  assert.equal(generatedContent("'a\\\'b'"),"a'b");
  for(const input of ['url("icon.svg")','counter(item)','attr(data-label)','"not closed'])assert.throws(()=>generatedContent(input));
});
test('password mask exports only glyph placeholders, including Unicode graphemes',()=>{
  assert.equal(passwordMask('FixtureSecret42'),'•'.repeat(15));assert.equal(passwordMask('a👩‍💻e\u0301'),'•••');assert.equal(passwordMask(''),'');
});
test('absolute pseudo geometry accounts for content-box padding/borders and container origin',()=>{
  assert.deepEqual(absolutePseudoBox(css(),{x:100,y:200,width:300,height:100}),{x:110,y:205,width:60,height:26});
});
test('right and bottom anchored generated boxes include end margins and border-box dimensions',()=>{
  assert.deepEqual(absolutePseudoBox(css({left:'auto',right:'12px',top:'auto',bottom:'7px',boxSizing:'border-box',marginRight:'3px',marginBottom:'2px'}),{x:100,y:200,width:300,height:100}),{x:335,y:271,width:50,height:20});
});
test('ambiguous static positions and unknown dimensions explicitly refuse approximation',()=>{
  for(const overrides of [{position:'static'},{width:'auto'},{left:'auto',right:'auto'},{top:'auto',bottom:'auto'},{marginLeft:'auto'}])assert.throws(()=>absolutePseudoBox(css(overrides),{x:0,y:0,width:100,height:100}));
});
test('form example reuses native scene fields and remains explicit development-only data',async()=>{
  const data=JSON.parse(await readFile('examples/forms-m2.8.example.json','utf8'));assert.doesNotThrow(()=>parseCapturePackage(data,true));assert.throws(()=>parseCapturePackage(data),/DEVELOPMENT_MODE/);assert.equal(data.interactions.length,0);assert.ok(data.screens[0].nodes.some((n:any)=>n.type==='TEXT'));
});
