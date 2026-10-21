import type {DomCapture} from './capture-data';
/** Opt-in only. Freeze a single reliable Flex line as native fixed-size layout;
 * reject overlap, wrapping, lifted auxiliaries and unstable gaps. */
export function applyAutoLayouts(capture:DomCapture){
 for(const hint of capture.flexCandidates??[]){const parent=capture.nodes.find(n=>n.id===hint.id);if(!parent||parent.type!=='FRAME'||parent.style.effects?.length)continue;const children=capture.nodes.filter(n=>n.parentId===parent.id).sort((a,b)=>a.order-b.order);if(children.length<2||children.some(n=>n.type!=='FRAME'||n.style.opacity===0))continue;
  const horizontal=hint.axis==='horizontal',start=horizontal?'x':'y',size=horizontal?'width':'height',cross=horizontal?'y':'x',first=children[0],last=children.at(-1)!;
  const gap=children[1].rect[start]-first.rect[start]-first.rect[size];if(gap<0||children.some((n,i)=>Math.abs(n.rect[cross]-first.rect[cross])>.5||i>0&&Math.abs(n.rect[start]-children[i-1].rect[start]-children[i-1].rect[size]-gap)>.5))continue;
  const left=first.rect.x,top=first.rect.y,right=parent.rect.width-(horizontal?last.rect.x+last.rect.width:Math.max(...children.map(n=>n.rect.x+n.rect.width))),bottom=parent.rect.height-(horizontal?Math.max(...children.map(n=>n.rect.y+n.rect.height)):last.rect.y+last.rect.height);
  if([left,top,right,bottom].some(n=>n<0||!Number.isFinite(n)))continue;parent.layout={mode:hint.axis,gap,padding:[top,right,bottom,left]};
 }
}
