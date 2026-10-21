import type {Color,Font,Rect,SceneNode,CapturePackage} from '../../../packages/contracts/src/index';
import type {StackingLayer} from './stacking';
import {graphemes} from './text';
import {linearGradient} from './visual';
import {applyBoxShadow} from './shadows';
import {composedParent} from './composed';

export function generatedContent(value:string):string|null {
  if(['none','normal'].includes(value))return null;
  let rest=value.trim(),result='';
  while(rest){
    const quote=rest[0];if(quote!=='"'&&quote!=="'")throw Error('unsupported generated content');
    rest=rest.slice(1);let end=false;
    while(rest){
      const char=rest[0];rest=rest.slice(1);
      if(char===quote){end=true;break;}
      if(char!=='\\'){result+=char;continue;}
      const hex=rest.match(/^[\da-f]{1,6}(?:\s)?/i);
      if(hex){const code=parseInt(hex[0],16);result+=String.fromCodePoint(code===0||code>0x10ffff||code>=0xd800&&code<=0xdfff?0xfffd:code);rest=rest.slice(hex[0].length);}
      else if(rest){if(rest[0]!=='\n'&&rest[0]!=='\r')result+=rest[0];rest=rest.slice(1);}
    }
    if(!end)throw Error('unclosed content');rest=rest.trimStart();
  }
  return result;
}
const px=(value:string):number|undefined=>/^[-+]?(?:\d*\.)?\d+px$/.test(value)?parseFloat(value):value==='0'?0:undefined;
export function absolutePseudoBox(css:Pick<CSSStyleDeclaration,'position'|'width'|'height'|'boxSizing'|'left'|'right'|'top'|'bottom'|'marginLeft'|'marginRight'|'marginTop'|'marginBottom'|'paddingLeft'|'paddingRight'|'paddingTop'|'paddingBottom'|'borderLeftWidth'|'borderRightWidth'|'borderTopWidth'|'borderBottomWidth'>,containing:Rect):Rect {
  if(css.position!=='absolute')throw Error('pseudo position');
  const width=px(css.width),height=px(css.height),left=px(css.left),right=px(css.right),top=px(css.top),bottom=px(css.bottom);
  const values=[css.marginLeft,css.marginRight,css.marginTop,css.marginBottom,css.paddingLeft,css.paddingRight,css.paddingTop,css.paddingBottom,css.borderLeftWidth,css.borderRightWidth,css.borderTopWidth,css.borderBottomWidth].map(px);
  if(width===undefined||height===undefined||values.some(v=>v===undefined)||left===undefined&&right===undefined||top===undefined&&bottom===undefined)throw Error('pseudo auto/length');
  const [ml,mr,mt,mb,pl,pr,pt,pb,bl,br,bt,bb]=values as number[];
  const w=width+(css.boxSizing==='border-box'?0:pl+pr+bl+br),h=height+(css.boxSizing==='border-box'?0:pt+pb+bt+bb);
  const x=containing.x+(left!==undefined?left+ml:containing.width-right!-w-mr),y=containing.y+(top!==undefined?top+mt:containing.height-bottom!-h-mb);
  if(![x,y,w,h].every(Number.isFinite)||w<0||h<0||Math.max(w,h)>100000)throw Error('pseudo size');return {x,y,width:w,height:h};
}
export function passwordMask(value:string):string {return '•'.repeat(graphemes(value).length);}
export interface AppearanceContext {
  root:ShadowRoot;nodes:SceneNode[];layers:Map<string,StackingLayer>;
  color(value:string):Color;font(css:CSSStyleDeclaration):Font;checkpoint():void;countText(length:number):void;
  warn(code:string,message:string,nodeId:string):void;frameId(element:Element):string|undefined;preserveContent(id:string):void;background(id:string):void;
}
export function appearanceRenderer(ctx:AppearanceContext){
  const add=(node:Omit<SceneNode,'id'|'order'>)=>{const result:SceneNode={...node,id:`n${ctx.nodes.length}`,order:ctx.nodes.length};ctx.nodes.push(result);ctx.checkpoint();return result;};
  const areaOf=(css:CSSStyleDeclaration,w:number,h:number):Rect=>{
    const left=(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.paddingLeft)||0),top=(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.paddingTop)||0);
    return {x:left,y:top,width:Math.max(0,w-left-(parseFloat(css.borderRightWidth)||0)-(parseFloat(css.paddingRight)||0)),height:Math.max(0,h-top-(parseFloat(css.borderBottomWidth)||0)-(parseFloat(css.paddingBottom)||0))};
  };
  function text(value:string,css:CSSStyleDeclaration,parent:SceneNode,area:Rect,multiline:boolean,center:boolean,scroll={x:0,y:0},opacity=1,preserve=false){
    ctx.countText(value.length);if(!value||area.width<=0||area.height<=0)return;
    const clip=add({sourceId:parent.sourceId,name:'文字显示区域 / 原生裁切',type:'FRAME',parentId:parent.id,rect:{...area},style:{fills:[]},fidelity:'native',clipsContent:true});
    if(preserve)ctx.preserveContent(clip.id);
    const mirror=document.createElement('div');mirror.style.cssText='all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;display:block;box-sizing:content-box;margin:0;padding:0;border:0;';
    for(const property of ['font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-feature-settings','font-variation-settings','line-height','letter-spacing','word-spacing','text-align','text-transform','direction','writing-mode','tab-size'])mirror.style.setProperty(property,css.getPropertyValue(property));
    mirror.style.width=`${area.width}px`;mirror.style.whiteSpace=multiline?css.whiteSpace:'pre';mirror.style.overflowWrap=multiline?css.overflowWrap:'normal';mirror.style.wordBreak=css.wordBreak;mirror.lang=document.documentElement.lang;
    // Only live password bullets, never its value, reach the measurement DOM.
    mirror.textContent=value;ctx.root.append(mirror);
    try{
      const bounds=mirror.getBoundingClientRect(),range=document.createRange(),source=mirror.firstChild!;
      const f=ctx.font(css),lineHeight=parseFloat(css.lineHeight)||f.size*1.2,dy=center?(area.height-bounds.height)/2:0;
      let line:{characters:string;left:number;top:number;right:number;bottom:number}|undefined;
      const flush=()=>{if(!line)return;const content=line;line=undefined;
        add({sourceId:parent.sourceId,name:'显示文字 / 可编辑',type:'TEXT',parentId:clip.id,fidelity:'native',rect:{x:content.left-bounds.x-scroll.x,y:content.top-bounds.y+dy-scroll.y,width:Math.max(.1,content.right-content.left+.5),height:Math.max(lineHeight,content.bottom-content.top)},style:{opacity,fills:[{kind:'solid',color:ctx.color(css.color)}]},text:{characters:content.characters,font:f,lineHeight,letterSpacing:parseFloat(css.letterSpacing)||0,align:'left',runs:[{start:0,end:content.characters.length,font:f,color:ctx.color(css.color)}]}});
      };
      for(const {segment,index}of graphemes(value)){
        if(index%64===0)ctx.checkpoint();range.setStart(source,index);range.setEnd(source,index+segment.length);const rect=range.getClientRects()[0];
        const preservedNewline=segment==='\n'&&['pre','pre-wrap','pre-line','break-spaces'].includes(mirror.style.whiteSpace);
        if(!rect||rect.width<=0||preservedNewline||segment==='\r'){if(preservedNewline)flush();continue;}
        if(line&&Math.abs(line.top-rect.top)>Math.max(2,rect.height*.3))flush();
        const characters=/^[\n\t\f ]+$/.test(segment)&&!['pre','pre-wrap','break-spaces'].includes(mirror.style.whiteSpace)?' ':segment;
        if(!line)line={characters,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};
        else{line.characters+=characters;line.left=Math.min(line.left,rect.left);line.right=Math.max(line.right,rect.right);line.bottom=Math.max(line.bottom,rect.bottom);}
      }flush();
    }finally{mirror.remove();}
  }
  function control(element:Element,css:CSSStyleDeclaration,node:SceneNode):boolean{
    if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement))return false;
    if(css.visibility!=='visible')return true;
    for(let ancestor:Element|null=element;ancestor;ancestor=ancestor.parentElement)if(Number(getComputedStyle(ancestor).opacity)===0)return true;
    const warn=(message:string)=>{node.fidelity='approximated';ctx.warn('W_FORM_NATIVE_APPROXIMATED',message,node.id);};
    const area=areaOf(css,node.rect.width,node.rect.height);
    if(element instanceof HTMLElement){area.width=Math.max(0,element.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0));area.height=Math.max(0,element.clientHeight-(parseFloat(css.paddingTop)||0)-(parseFloat(css.paddingBottom)||0));}
    const input=element instanceof HTMLInputElement?element:undefined;
    if(input&&['checkbox','radio'].includes(input.type)){
      if(css.appearance!=='none'){
        warn('浏览器原生勾选控件按当前checked/indeterminate/disabled状态保留可编辑静态近似，系统主题细节不迁移。');
        const checked=input.checked||input.indeterminate,disabled=input.matches(':disabled'),accent=css.accentColor==='auto'?'#0075ff':css.accentColor;
        const size=Math.min(node.rect.width,node.rect.height),x=(node.rect.width-size)/2,y=(node.rect.height-size)/2;
        const plate=add({sourceId:node.sourceId,name:'勾选控件 / 静态外观',type:'SHAPE',parentId:node.id,rect:{x,y,width:size,height:size},style:{opacity:disabled?.5:1,fills:[{kind:'solid',color:ctx.color(checked?accent:'#fff')}],border:{width:1,color:ctx.color(checked?accent:'#767676')},radii:Array(4).fill(input.type==='radio'?size/2:2)},fidelity:'approximated'});
        if(checked){
          if(input.type==='radio')add({sourceId:node.sourceId,name:'选中圆点',type:'SHAPE',parentId:node.id,rect:{x:x+size*.3,y:y+size*.3,width:size*.4,height:size*.4},style:{opacity:disabled?.5:1,fills:[{kind:'solid',color:ctx.color('#fff')}],radii:Array(4).fill(size)},fidelity:'approximated'});
          else add({sourceId:node.sourceId,name:input.indeterminate?'不确定状态 / 原生矢量':'已勾选 / 原生矢量',type:'VECTOR',parentId:node.id,rect:{...plate.rect},style:{opacity:disabled?.5:1},fidelity:'approximated',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="${input.indeterminate?'M5 10H15':'M4 10L8 14L16 6'}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`});
        }
      }
      return true;
    }
    if(input&&!['text','search','email','url','tel','number','password','button','submit','reset'].includes(input.type)||element instanceof HTMLSelectElement&&(element.multiple||element.size>1)){
      node.fidelity='missing';ctx.warn('W_FORM_UNSUPPORTED','文件/日期/颜色/滑块或多行选择等复杂浏览器控件暂保留外框，未导出内部状态或交互。',node.id);return true;
    }
    if('value' in element&&element.value.length>60000)throw Error('E_LIMIT_EXCEEDED: 表单文字超过60000字符');
    let value=element instanceof HTMLInputElement?element.type==='password'?passwordMask(element.value):element.value:element instanceof HTMLTextAreaElement?element.value:element.selectedOptions[0]?.label??'';
    // Bound source values before a measuring element can allocate a large tree.
    ctx.checkpoint();
    let style=css,opacity=1;
    if(!value&&(element instanceof HTMLTextAreaElement||input)&&!input?.matches('[type=button],[type=submit],[type=reset]')){value=element.getAttribute('placeholder')??'';style=getComputedStyle(element,'::placeholder');opacity=parseFloat(style.opacity)||0;}
    if(css.appearance!=='none'||input&&['search','number'].includes(input.type))warn('浏览器控件按当前显示值输出原生文字与静态外观；光标、系统箭头/清除按钮、主题细节不迁移。');
    if(css.direction!=='ltr'||css.writingMode!=='horizontal-tb'||css.textTransform!=='none'||css.fontVariantCaps!=='normal'||(css.letterSpacing!=='normal'&&parseFloat(css.letterSpacing)!==0))warn('表单文字采用当前样式测量，特殊方向/大小写/字形与字距请核对实际Figma。');
    if(element instanceof HTMLSelectElement&&css.appearance!=='none'){
      area.width=Math.max(0,area.width-20);
      add({sourceId:node.sourceId,name:'下拉箭头 / 静态近似',type:'VECTOR',parentId:node.id,rect:{x:node.rect.width-20,y:node.rect.height/2-5,width:12,height:10},style:{},fidelity:'approximated',svg:'<svg width="12" height="10" viewBox="0 0 12 10"><path d="M2 3L6 7L10 3" fill="none" stroke="#555" stroke-width="1.5"/></svg>'});
    }
    text(value,style,node,area,element instanceof HTMLTextAreaElement,!(element instanceof HTMLTextAreaElement),{x:element.scrollLeft,y:element.scrollTop},opacity,true);
    return true;
  }
  function pseudo(element:Element,kind:'::before'|'::after',owner:SceneNode,ownerBox:DOMRect){
    const css=getComputedStyle(element,kind);if(css.display==='none'||css.visibility!=='visible'||['none','normal'].includes(css.content))return;
    try{
      const content=generatedContent(css.content)!;
      if(!['block','inline-block','flow-root'].includes(css.display)||css.transform!=='none'||css.translate!=='none'||css.rotate!=='none'||css.scale!=='none'||css.filter!=='none'||css.clipPath!=='none'||css.maskImage!=='none'||css.mixBlendMode!=='normal'||css.writingMode!=='horizontal-tb'||css.direction!=='ltr'||css.textTransform!=='none')throw Error('pseudo effect/layout');
      let containing:Element|null=element;
      while(containing&&getComputedStyle(containing).position==='static'){
        const own=getComputedStyle(containing);if(own.transform!=='none'||own.filter!=='none'||own.contain!=='none')throw Error('pseudo transformed/contained ancestor');containing=composedParent(containing);
      }
      if(!containing)throw Error('pseudo initial containing block');
      const containingCss=getComputedStyle(containing);if(containingCss.transform!=='none')throw Error('pseudo transformed containing block');
      const cb=containing.getBoundingClientRect(),bl=parseFloat(containingCss.borderLeftWidth)||0,bt=parseFloat(containingCss.borderTopWidth)||0;
      const bounds=absolutePseudoBox(css,{x:cb.x+bl-(containing.scrollLeft||0),y:cb.y+bt-(containing.scrollTop||0),width:cb.width-bl-(parseFloat(containingCss.borderRightWidth)||0),height:cb.height-bt-(parseFloat(containingCss.borderBottomWidth)||0)});
      const widths=[css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth].map(v=>parseFloat(v)||0),styles=[css.borderTopStyle,css.borderRightStyle,css.borderBottomStyle,css.borderLeftStyle],colors=[css.borderTopColor,css.borderRightColor,css.borderBottomColor,css.borderLeftColor];
      if(widths.some(w=>w!==widths[0])||widths[0]>0&&(styles.some(s=>s!=='solid')||colors.some(c=>c!==colors[0])))throw Error('pseudo nonuniform border');
      const radii=[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(v=>{if(px(v)===undefined)throw Error('pseudo elliptical/percentage radius');return parseFloat(v);});
      const fills:NonNullable<SceneNode['style']['fills']>=[];const bg=ctx.color(css.backgroundColor);if(bg.a)fills.push({kind:'solid',color:bg});
      if(css.backgroundImage!=='none'){if(css.backgroundSize!=='auto'||css.backgroundPosition!=='0% 0%'||css.backgroundClip!=='border-box'||css.backgroundOrigin!=='padding-box')throw Error('pseudo background');fills.push(linearGradient(css.backgroundImage,bounds.width,bounds.height,ctx.color,v=>CSS.supports('color',v)));}
      const node=add({sourceId:`${owner.sourceId}${kind}`,name:`${kind} / 原生生成内容`,type:'FRAME',parentId:owner.id,rect:{...bounds,x:bounds.x-ownerBox.x,y:bounds.y-ownerBox.y},style:{opacity:Number(css.opacity),fills,radii,...widths[0]?{border:{width:widths[0],color:ctx.color(colors[0])}}:{}},fidelity:'native',clipsContent:css.overflowX!=='visible'||css.overflowY!=='visible'});
      const z=css.zIndex==='auto'?null:Number(css.zIndex);
      applyBoxShadow(css,node,ctx.color,add,ctx.background,ctx.warn);
      ctx.layers.set(node.id,{context:z!==null||Number(css.opacity)<1||css.isolation==='isolate',position:'absolute',zIndex:z,containingBlock:ctx.frameId(containing)??'outside-selection'});
      if(content)text(content,css,node,areaOf(css,bounds.width,bounds.height),true,false);
    }catch(error){if(error instanceof Error&&/^E_(?:LIMIT_EXCEEDED|CAPTURE_TIMEOUT)/.test(error.message))throw error;owner.fidelity='approximated';ctx.warn('W_PSEUDO_UNSUPPORTED',`${kind}的文流/内容表达式/边框或复杂效果暂不支持；本批仅重建可定位的绝对定位生成框。`,owner.id);}
  }
  return {control,pseudo};
}
