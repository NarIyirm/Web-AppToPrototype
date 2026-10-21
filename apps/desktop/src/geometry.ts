import type { Rect, SceneNode } from '../../../packages/contracts/src/index';
import {shadowBounds} from './shadows';
export function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x,b.x), y = Math.max(a.y,b.y);
  const right = Math.min(a.x+a.width,b.x+b.width), bottom = Math.min(a.y+a.height,b.y+b.height);
  return right > x && bottom > y ? {x,y,width:right-x,height:bottom-y} : null;
}
export function rectangle(a: {x:number;y:number}, b: {x:number;y:number}): Rect {
  return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
}
export function expandedBounds(input: Rect, candidates: Rect[], viewport: Rect): Rect {
  // One pass against the requested box: expansion does not recursively select neighbours.
  let left=input.x,top=input.y,right=input.x+input.width,bottom=input.y+input.height;
  for (const candidate of candidates) if (intersection(input,candidate)) {
    left=Math.min(left,candidate.x);top=Math.min(top,candidate.y);
    right=Math.max(right,candidate.x+candidate.width);bottom=Math.max(bottom,candidate.y+candidate.height);
  }
  if (right-left > viewport.width*4 || bottom-top > viewport.height*4) throw new Error('E_SELECTION_TOO_LARGE: 完整元素范围过大，请改选 Section 或缩小框选');
  return {x:left,y:top,width:right-left,height:bottom-top};
}
export function pruneScene(nodes: SceneNode[],preserveContents=new Set<string>()): SceneNode[] {
  const root=nodes[0], bounds=root.rect;
  const absolute=new Map<string,Rect>(), clips=new Map<string,Rect|null>(), keep=new Set([root.id]);
  for (const node of nodes) {
    const parent=node.parentId ? absolute.get(node.parentId) : undefined;
    const rect={...node.rect,x:node.rect.x+(parent?.x??0),y:node.rect.y+(parent?.y??0)};
    absolute.set(node.id,rect);
    const inherited=node.parentId ? clips.get(node.parentId)??null : bounds;
    const visible=inherited ? intersection(rect,inherited) : null;
    clips.set(node.id,node.clipsContent ? visible : inherited);
    // An unclipped SVG can paint outside its viewport. Its serialized paths are
    // atomic here, so conservatively retain it when an inherited clip is visible;
    // the native outer crop still performs the exact clipping after import.
    if (visible || inherited&&node.style.effects?.length&&intersection(shadowBounds(rect,node.style.effects),inherited) || node.type==='VECTOR'&&node.clipsContent===false&&inherited || node.parentId&&preserveContents.has(node.parentId)&&inherited) keep.add(node.id);
  }
  const byId=new Map(nodes.map(node=>[node.id,node]));
  for (const id of [...keep]) { let parent=byId.get(id)?.parentId; while(parent) { keep.add(parent);parent=byId.get(parent)?.parentId; } }
  return nodes.filter(node=>keep.has(node.id));
}
