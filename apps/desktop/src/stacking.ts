import type { Rect, SceneNode } from '../../../packages/contracts/src/index';

export interface StackingLayer {
  context: boolean;
  position: string;
  zIndex: number | null;
  flowOrder?: number;
  containingBlock?: string;
}
export interface ContentClip { id: string; ownerId: string; rect: Rect }

/** Native scene normalization for the supported CSS paint phases. Non-context
 * DOM containers cannot trap positioned descendants. Crossed clips are copied
 * as empty native frames, so lifting a layer does not discard its clipping. */
export function normalizeStacking(input: SceneNode[], sourceLayers: Map<string,StackingLayer>, clips: Map<string,ContentClip>, checkpoint=()=>{}, limit=5000, sourceBackgrounds=new Set<string>()): SceneNode[] {
  const nodes=input.map(n=>({...n,rect:{...n.rect},style:{...n.style}}));
  const layers=new Map(sourceLayers),byId=new Map(nodes.map(n=>[n.id,n]));
  const backgrounds=new Set(sourceBackgrounds);
  const root=nodes[0];if(!root)return [];
  const clipOwners=new Map([...clips.values()].map(c=>[c.id,c.ownerId]));
  let serial=0;
  const newId=()=>{let id:string;do{id=`paint-${++serial}`;}while(byId.has(id));return id;};
  const append=(node:SceneNode)=>{checkpoint();if(nodes.length>=limit)throw Error('E_LIMIT_EXCEEDED: 层叠/裁切图层超过节点预算，请缩小范围');nodes.push(node);byId.set(node.id,node);};
  // Only DOM content and Text move into the padding clip. Background image/color
  // clips and border shapes remain on the outer frame.
  for(const n of nodes){const clip=n.parentId&&clips.get(n.parentId);if(clip&&(sourceLayers.has(n.id)||n.type==='TEXT')){n.parentId=clip.id;n.rect.x-=clip.rect.x;n.rect.y-=clip.rect.y;}}
  function children(){
    const map=new Map<string,SceneNode[]>();for(const n of nodes)if(n.parentId){const list=map.get(n.parentId)??[];list.push(n);map.set(n.parentId,list);}return map;
  }
  const original=children();
  // Flex/grid order modifies DOM painting order. Preserve slots occupied by
  // auxiliary background/border nodes while ordering the actual item frames.
  for(const list of original.values()){
    const slots=list.map((n,i)=>sourceLayers.get(n.id)?.flowOrder!==undefined?i:-1).filter(i=>i>=0);
    const items=slots.map(i=>list[i]).sort((a,b)=>sourceLayers.get(a.id)!.flowOrder!-sourceLayers.get(b.id)!.flowOrder!||a.order-b.order);
    slots.forEach((slot,i)=>list[slot]=items[i]);
  }
  const absolute=new Map<string,Rect>(),paintIndex=new Map<string,number>();
  const todo:Array<{node:SceneNode;x:number;y:number}>=[{node:root,x:0,y:0}];
  while(todo.length){checkpoint();const {node,x,y}=todo.pop()!;if(absolute.has(node.id))throw Error('E_PACKAGE_INVALID: duplicate/cyclic scene');
    const rect={...node.rect,x:x+node.rect.x,y:y+node.rect.y};absolute.set(node.id,rect);paintIndex.set(node.id,paintIndex.size);
    const list=original.get(node.id)??[];for(let i=list.length-1;i>=0;i--)todo.push({node:list[i],x:rect.x,y:rect.y});
  }
  if(absolute.size!==nodes.length)throw Error('E_PACKAGE_INVALID: disconnected scene');
  const targets=new Map<string,string>(),crossed=new Map<string,string[]>();
  for(const n of nodes){checkpoint();const layer=sourceLayers.get(n.id);if(n.id===root.id||!layer||!layer.context&&layer.position==='static')continue;
    let parent=n.parentId,active=!['absolute','fixed'].includes(layer.position);const chain:string[]=[];
    while(parent){
      const p=byId.get(parent)!;const owner=clipOwners.get(parent)??parent;
      if(owner===layer.containingBlock)active=true;
      if(parent===root.id||sourceLayers.get(parent)?.context){targets.set(n.id,parent);break;}
      if(p.clipsContent&&active)chain.push(parent);
      parent=p.parentId;
    }
    crossed.set(n.id,chain.reverse());
  }
  // A selected non-context element is only a capture boundary. Its own background
  // must remain above negative descendants, as in the source ancestor context.
  if(sourceLayers.get(root.id)?.context===false&&[...targets].some(([id,target])=>target===root.id&&(sourceLayers.get(id)!.zIndex??0)<0)){
    if(root.style.fills?.length||root.style.effects?.length){
      const shell:SceneNode={id:newId(),sourceId:root.sourceId,name:'选区背景 / 原生绘制层',type:'SHAPE',parentId:root.id,order:0,rect:{x:0,y:0,width:root.rect.width,height:root.rect.height},fidelity:root.fidelity,style:{...root.style}};
      delete shell.style.opacity;delete shell.style.border;append(shell);backgrounds.add(shell.id);paintIndex.set(shell.id,-1);
    }
    if(root.style.border){
      const border:SceneNode={id:newId(),sourceId:root.sourceId,name:'选区边框 / 原生绘制层',type:'SHAPE',parentId:root.id,order:0,rect:{x:0,y:0,width:root.rect.width,height:root.rect.height},fidelity:root.fidelity,style:{fills:[],border:root.style.border,radii:root.style.radii}};
      append(border);backgrounds.add(border.id);paintIndex.set(border.id,Number.MAX_SAFE_INTEGER);
    }
    root.style={opacity:root.style.opacity,radii:root.style.radii,fills:[]};
  }
  // CSS context borders paint with the background, behind negative descendants.
  // A Figma Frame stroke paints over its children, so preserve the border as a
  // native shape in that earlier paint phase instead.
  for(const n of [...nodes])if(sourceLayers.get(n.id)?.context&&n.style.border){
    const border:SceneNode={id:newId(),sourceId:n.sourceId,name:'上下文边框 / 原生绘制层',type:'SHAPE',parentId:n.id,order:n.order,rect:{x:0,y:0,width:n.rect.width,height:n.rect.height},style:{fills:[],border:n.style.border,radii:n.style.radii},fidelity:n.fidelity};
    delete n.style.border;append(border);backgrounds.add(border.id);paintIndex.set(border.id,Number.MAX_SAFE_INTEGER);
  }
  for(const [id,targetId] of targets){
    const n=byId.get(id)!,layer=sourceLayers.get(id)!,rect=absolute.get(id)!;if(n.parentId===targetId)continue;
    let parentId=targetId,parentRect=absolute.get(targetId)!;
    const chain=crossed.get(id)??[];
    for(const clipId of chain){
      const source=byId.get(clipId)!,clipRect=absolute.get(clipId)!;
      const copy:SceneNode={id:newId(),sourceId:source.sourceId,name:'层叠裁切 / '+source.name,type:'FRAME',parentId,order:n.order,rect:{...clipRect,x:clipRect.x-parentRect.x,y:clipRect.y-parentRect.y},style:{fills:[],...(source.style.radii?{radii:source.style.radii}:{})},fidelity:source.fidelity,clipsContent:true,layout:{mode:'absolute'}};
      append(copy);paintIndex.set(copy.id,paintIndex.get(id)!);if(parentId===targetId)layers.set(copy.id,{...layer,context:true});parentId=copy.id;parentRect=clipRect;
    }
    n.parentId=parentId;n.rect={...rect,x:rect.x-parentRect.x,y:rect.y-parentRect.y};
  }
  const ordered=children();
  const category=(n:SceneNode)=>{if(backgrounds.has(n.id)){if(sourceLayers.get(n.parentId??'')?.context)return -1;if(n.parentId===root.id&&sourceLayers.get(root.id)?.context===false)return .5;}const layer=layers.get(n.id);if(!layer||!layer.context&&layer.position==='static')return 1;const z=layer.zIndex??0;return z<0?0:z>0?3:2;};
  for(const list of ordered.values())list.sort((a,b)=>{
    const ca=category(a),cb=category(b);return ca-cb||((ca===0||ca===3)?(layers.get(a.id)?.zIndex??0)-(layers.get(b.id)?.zIndex??0):0)||(paintIndex.get(a.id)??a.order)-(paintIndex.get(b.id)??b.order);
  });
  const result:SceneNode[]=[],stack=[root];
  while(stack.length){checkpoint();const n=stack.pop()!;n.order=result.length;result.push(n);const list=ordered.get(n.id)??[];for(let i=list.length-1;i>=0;i--)stack.push(list[i]);}
  return result;
}
