import type {Color,Rect,SceneNode} from '../../../packages/contracts/src/index';
import {cssList} from './visual';
type Effect=NonNullable<SceneNode['style']['effects']>[number];

/** Read the computed list atomically; never silently keep only its first item. */
export function boxShadows(value:string,parseColor:(value:string)=>Color,validColor:(value:string)=>boolean):{effects:Effect[];omitted:number}{
  if(value==='none')return {effects:[],omitted:0};
  if(value.length>8192)throw Error('shadow list size');
  const items=cssList(value);if(!items.length||items.length>16)throw Error('shadow count');
  const effects:Effect[]=[];let omitted=0;
  for(const item of items){
    const tokens=cssList(item,' '),lengths:number[]=[];let color:Color|undefined,inset=false;
    for(const token of tokens){
      if(token==='inset'&&!inset){inset=true;continue;}
      if(/^[-+]?(?:\d*\.)?\d+(?:px)?$/.test(token)&&(+token===0||token.endsWith('px'))){lengths.push(parseFloat(token));continue;}
      if(!color&&validColor(token)){color=parseColor(token);continue;}
      throw Error('shadow syntax');
    }
    if(lengths.length<2||lengths.length>4||!color||lengths.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)||(lengths[2]??0)<0)throw Error('shadow lengths/color');
    if(inset){omitted++;continue;}
    effects.push({type:'drop_shadow',x:lengths[0],y:lengths[1],blur:lengths[2]??0,spread:lengths[3]??0,color});
  }
  return {effects,omitted};
}

/** Effects belong to an opaque native background rectangle, never the frame's
 * descendant silhouette. This also permits native positive/negative spread. */
export function applyBoxShadow(css:CSSStyleDeclaration,node:SceneNode,parseColor:(s:string)=>Color,add:(node:Omit<SceneNode,'id'|'order'>)=>SceneNode,background:(id:string)=>void,warn:(code:string,message:string,id:string)=>void,rectangular=true){
  if(css.boxShadow==='none')return;
  const unsupported=(message:string)=>{node.fidelity='approximated';warn('W_SHADOW_UNSUPPORTED',message,node.id);};
  try{
    const parsed=boxShadows(css.boxShadow,parseColor,value=>CSS.supports('color',value));
    if(parsed.omitted)unsupported('内阴影暂未重建；保留可支持的外阴影、背景和原生内容。');
    if(!parsed.effects.length)return;
    const radius=[css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius];
    const solid=node.style.fills?.find(fill=>fill.kind==='solid'&&fill.color.a===1);
    if(!rectangular||node.clipsContent||!solid||css.backgroundClip!=='border-box'||radius.some(v=>!/^\d+(?:\.\d+)?px$/.test(v))||radius.some(v=>v!==radius[0])||parseFloat(radius[0])>Math.min(node.rect.width,node.rect.height)/2||css.transform!=='none'||css.translate!=='none'||css.rotate!=='none'||css.scale!=='none'||css.filter!=='none'||css.backdropFilter!=='none'||css.mixBlendMode!=='normal'||css.clipPath!=='none'||css.maskImage!=='none'){
      unsupported('本批外阴影要求不透明纯色底、单个矩形盒、统一像素圆角及普通合成；此处省略阴影，保留原生外观其余部分。');return;
    }
    const plate=add({sourceId:node.sourceId,name:'外阴影与底色 / 原生绘制层',type:'SHAPE',parentId:node.id,rect:{x:0,y:0,width:node.rect.width,height:node.rect.height},style:{fills:[...node.style.fills!],radii:node.style.radii,effects:parsed.effects},fidelity:'approximated'});
    node.style.fills=[];background(plate.id);
    // CSS/Figma use different rendering engines; parameters remain editable.
    node.fidelity='approximated';warn('W_SHADOW_APPROXIMATED','外阴影已保留全部受支持层及原生参数；模糊和扩散边缘仍需在Figma比较。',node.id);
  }catch(error){if(error instanceof Error&&/^E_(?:LIMIT_EXCEEDED|CAPTURE_TIMEOUT)/.test(error.message))throw error;unsupported('阴影表达式、层数（最多16层）或长度超出支持范围；省略阴影并保留原生内容。');}
}

/** Conservative blur support for pruning only; never enlarge a content clip. */
export function shadowBounds(rect:Rect,effects:Effect[]=[]):Rect{
  let left=rect.x,top=rect.y,right=rect.x+rect.width,bottom=rect.y+rect.height;
  for(const effect of effects){
    if(effect.color.a===0||rect.width+2*effect.spread<=0||rect.height+2*effect.spread<=0)continue;
    const pad=Math.max(0,effect.spread)+effect.blur*2;
    left=Math.min(left,rect.x+effect.x-pad);top=Math.min(top,rect.y+effect.y-pad);
    right=Math.max(right,rect.x+rect.width+effect.x+pad);bottom=Math.max(bottom,rect.y+rect.height+effect.y+pad);
  }
  return {x:left,y:top,width:right-left,height:bottom-top};
}
