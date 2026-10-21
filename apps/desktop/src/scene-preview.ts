import type {CapturePackage,Color,Rect,SceneNode} from '../../../packages/contracts/src/index';
type Screen=CapturePackage['screens'][number];
const css=(c:Color)=>`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a})`;
const revisions=new WeakMap<HTMLCanvasElement,number>();
export function absoluteRects(screen:Screen){
 const nodes=new Map(screen.nodes.map(n=>[n.id,n])),rects=new Map<string,Rect>();
 function visit(node:SceneNode):Rect{const old=rects.get(node.id);if(old)return old;const parent=node.parentId?nodes.get(node.parentId):undefined,p=parent?visit(parent):undefined;const rect={...node.rect,x:node.rect.x+(p?.x??0),y:node.rect.y+(p?.y??0)};rects.set(node.id,rect);return rect;}
 for(const node of screen.nodes)visit(node);return rects;
}
export function sceneHit(screen:Screen,x:number,y:number){const rects=absoluteRects(screen);return [...screen.nodes].reverse().find(n=>n.id!==screen.rootNodeId&&(()=>{const r=rects.get(n.id)!;return x>=r.x&&y>=r.y&&x<=r.x+r.width&&y<=r.y+r.height;})());}
export async function drawScene(canvas:HTMLCanvasElement,data:CapturePackage,screen:Screen,highlight?:string,region?:Rect){
 const revision=(revisions.get(canvas)??0)+1;revisions.set(canvas,revision);
 const root=screen.nodes.find(n=>n.id===screen.rootNodeId)!,view=region??root.rect;
 const scale=Math.min(1,600/view.width,1600/view.height),width=Math.max(1,Math.round(view.width*scale)),height=Math.max(1,Math.round(view.height*scale));
 const buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;const c=buffer.getContext('2d')!;
 c.fillStyle='white';c.fillRect(0,0,width,height);c.scale(scale,scale);c.translate(-view.x,-view.y);
 const rects=absoluteRects(screen),byId=new Map(screen.nodes.map(n=>[n.id,n]));
 const imageCache=new Map<string,HTMLImageElement>();
 for(const n of screen.nodes){const asset=n.assetId?data.assets.find(a=>a.assetId===n.assetId):undefined;
  const src=asset?.inlineBase64?`data:${asset.mime};base64,${asset.inlineBase64}`:n.svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(n.svg)}`:undefined;
  if(src&&!imageCache.has(src)){const image=new Image();image.src=src;try{await image.decode();imageCache.set(src,image);}catch{/* Missing images are shown as a placeholder. */}}
 }
 function paint(n:SceneNode){const r=rects.get(n.id)!;if(r.x+r.width<view.x||r.y+r.height<view.y||r.x>view.x+view.width||r.y>view.y+view.height)return;
  c.save();let p=n.parentId?byId.get(n.parentId):undefined;let opacity=n.style.opacity??1;
  while(p){opacity*=p.style.opacity??1;if(p.clipsContent){const b=rects.get(p.id)!;c.beginPath();c.rect(b.x,b.y,b.width,b.height);c.clip();}p=p.parentId?byId.get(p.parentId):undefined;}
  c.globalAlpha=opacity;c.translate(r.x,r.y);c.beginPath();c.roundRect(0,0,r.width,r.height,(n.style.radii??[0]).map(v=>Math.min(v,r.width/2,r.height/2)));
  if(n.type==='TEXT'&&n.text){const text=n.text;c.save();c.rect(0,0,r.width,r.height);c.clip();c.fillStyle=n.style.fills?.[0]?.kind==='solid'?css(n.style.fills[0].color):'#111';c.font=`${text.font.weight} ${text.font.size}px ${JSON.stringify(text.font.family)},sans-serif`;c.textBaseline='top';c.textAlign=text.align==='justify'?'left':text.align;
   const x=text.align==='center'?r.width/2:text.align==='right'?r.width:0;let y=0;
   for(const paragraph of text.characters.split('\n')){let line='';for(const char of paragraph){if(line&&c.measureText(line+char).width>r.width){c.fillText(line,x,y);y+=text.lineHeight;line='';}line+=char;}c.fillText(line,x,y);y+=text.lineHeight;}
   c.restore();
  }else{
   for(const fill of n.style.fills??[]){if(fill.kind==='solid')c.fillStyle=css(fill.color);else{const angle=fill.angle*Math.PI/180,dx=Math.cos(angle)*r.width/2,dy=Math.sin(angle)*r.height/2,gradient=c.createLinearGradient(r.width/2-dx,r.height/2-dy,r.width/2+dx,r.height/2+dy);for(const stop of fill.stops)gradient.addColorStop(stop.position,css(stop.color));c.fillStyle=gradient;}c.fill();}
   const asset=n.assetId?data.assets.find(a=>a.assetId===n.assetId):undefined,src=asset?.inlineBase64?`data:${asset.mime};base64,${asset.inlineBase64}`:n.svg?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(n.svg)}`:undefined;
   const image=src?imageCache.get(src):undefined;if(image){c.save();c.clip();c.drawImage(image,0,0,r.width,r.height);c.restore();}
   if((n.type==='IMAGE'||n.type==='VECTOR')&&!image){c.fillStyle='#eee';c.fill();c.strokeStyle='#888';c.setLineDash([4,4]);c.stroke();}
  }
  if(n.style.border){c.lineWidth=n.style.border.width;c.strokeStyle=css(n.style.border.color);c.stroke();}c.restore();
 }
 // Keep each subtree together and respect sibling paint order.
 const children=new Map<string|null,SceneNode[]>();for(const n of screen.nodes){const list=children.get(n.parentId)??[];list.push(n);children.set(n.parentId,list);}
 function visit(n:SceneNode){paint(n);for(const child of (children.get(n.id)??[]).sort((a,b)=>a.order-b.order))visit(child);}visit(root);
 if(highlight){const r=rects.get(highlight);if(r){c.strokeStyle='#a3275f';c.lineWidth=2/scale;c.setLineDash([]);c.strokeRect(r.x,r.y,r.width,r.height);}}
 if(revisions.get(canvas)!==revision)return;
 canvas.width=width;canvas.height=height;canvas.getContext('2d')!.drawImage(buffer,0,0);
}
