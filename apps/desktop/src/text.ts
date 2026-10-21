import type { Rect, SceneNode, TextRun } from '../../../packages/contracts/src/index';
export interface TextFragment { node: SceneNode; ownerId: string; ownerRect: Rect; absolute: Rect; sequence: number; join?: boolean }

/** A visual line can combine transparent, baseline-aligned inline fragments. Do not
 * join across a new line, font size/line-height, atomic element, gap or overlap. */
export function mergeTextLines(nodes: SceneNode[], fragments: TextFragment[], onSplit: (ownerId:string)=>void): SceneNode[] {
  const replacements=new Map<string,SceneNode>(),removed=new Set<string>();
  let current:TextFragment|undefined;
  const finish=(group:TextFragment[])=>{
    if(group.length<2)return;
    const first=group[0],node=structuredClone(first.node),text=node.text!;
    const left=Math.min(...group.map(f=>f.absolute.x)),top=Math.min(...group.map(f=>f.absolute.y));
    const right=Math.max(...group.map(f=>f.absolute.x+f.absolute.width)),bottom=Math.max(...group.map(f=>f.absolute.y+f.absolute.height));
    let characters='',runs:TextRun[]=[];
    for(const fragment of group){const base=characters.length;for(const run of fragment.node.text!.runs)runs.push({...run,start:run.start+base,end:run.end+base});characters+=fragment.node.text!.characters;}
    text.characters=characters;text.runs=runs;node.name=characters.trim().slice(0,80);node.parentId=first.ownerId;
    node.rect={x:left-first.ownerRect.x,y:top-first.ownerRect.y,width:right-left+.5,height:bottom-top};
    if(group.some(f=>f.node.fidelity==='approximated'))node.fidelity='approximated';
    replacements.set(first.node.id,node);for(const f of group.slice(1))removed.add(f.node.id);
  };
  let group:TextFragment[]=[];
  for(const next of fragments){
    const sameOwner=current?.ownerId===next.ownerId, a=current?.node.text,b=next.node.text!;
    const sameLine=!!current&&Math.abs(current.absolute.y-next.absolute.y)<=1;
    const adjacent=!!current&&Math.abs(next.absolute.x-(current.absolute.x+current.absolute.width))<=1.5;
    const safe=sameOwner&&sameLine&&adjacent&&current!.join!==false&&next.join!==false&&current!.sequence+1===next.sequence&&a!.font.size===b.font.size&&Math.abs(a!.lineHeight-b.lineHeight)<.1&&a!.letterSpacing===b.letterSpacing;
    const overlap=!!current&&Math.min(current.absolute.y+current.absolute.height,next.absolute.y+next.absolute.height)>Math.max(current.absolute.y,next.absolute.y);
    if(!safe){finish(group);group=[];if(sameOwner&&overlap&&adjacent&&a!.font.size!==b.font.size)onSplit(next.ownerId);}
    group.push(next);current=next;
  }
  finish(group);
  return nodes.filter(node=>!removed.has(node.id)).map(node=>replacements.get(node.id)??node);
}

/** Grapheme offsets stay in UTF-16, the index convention shared by Range and Figma. */
export function graphemes(value:string):Array<{segment:string;index:number}>{
  return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value),s=>({segment:s.segment,index:s.index}));
}
export function transformedText(value:string,transform:string,locale?:string):string{
  try{if(transform==='uppercase')return value.toLocaleUpperCase(locale);if(transform==='lowercase')return value.toLocaleLowerCase(locale);}catch{if(transform==='uppercase')return value.toUpperCase();if(transform==='lowercase')return value.toLowerCase();}
  return value;
}
