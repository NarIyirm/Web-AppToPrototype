import type {Color,Rect} from '../../../packages/contracts/src/index';
import {cropMobilePixels,type Pixels} from './mobile-png';

type FlatRegion={label:number;key:number;rect:Rect;color:Color;radius:number;area:number};
type ResidualRegion=Rect&{tiles:Set<number>;columns:number;tile:number};
const keyAt=(data:Uint8Array,p:number)=>data[p+3]<250?0:1+((data[p]>>3)<<10)+((data[p+1]>>3)<<5)+(data[p+2]>>3);
const colorOf=(sum:number[],count:number):Color=>({r:sum[0]/count/255,g:sum[1]/count/255,b:sum[2]/count/255,a:1});

/** Infer flat UI regions, then keep only residual artwork as transparent local
 * crops. Text must be removed first, so editing text never reveals old glyphs.
 * This is pixel reconstruction, not recovery of the original application's tree. */
export function reconstructMobileImage(image:Pixels,clearedText:Rect[]=[]){
 // A screenshot is normally opaque. Preserve alpha-bearing source artwork
 // rather than filling transparent holes with an inferred screen background.
 for(let p=3;p<image.rgba.length;p+=4)if(image.rgba[p]<250)return {background:{r:0,g:0,b:0,a:0},shapes:[] as FlatRegion[],images:[{rect:{x:0,y:0,width:image.width,height:image.height},image}]};
 const step=Math.max(1,Math.ceil(Math.max(image.width,image.height)/960));
 const width=Math.ceil(image.width/step),height=Math.ceil(image.height/step),size=width*height;
 const keys=new Int32Array(size),labels=new Int32Array(size),queue=new Int32Array(size);
 const colors=new Map<number,{sum:number[];count:number}>();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=(Math.min(image.height-1,y*step+Math.floor(step/2))*image.width+Math.min(image.width-1,x*step+Math.floor(step/2)))*4;
  const key=keyAt(image.rgba,p);keys[y*width+x]=key;if(!key)continue;
  const value=colors.get(key)??{sum:[0,0,0],count:0};value.count++;
  for(let c=0;c<3;c++)value.sum[c]+=image.rgba[p+c];colors.set(key,value);
 }
 const dominant=[...colors.entries()].sort((a,b)=>b[1].count-a[1].count)[0];
 const backgroundKey=dominant?.[0]??0,background=dominant?colorOf(dominant[1].sum,dominant[1].count):{r:1,g:1,b:1,a:0};
 const backgroundBytes=[background.r,background.g,background.b].map(v=>Math.round(v*255));
 const nearBackground=(r:number,g:number,b:number)=>Math.max(Math.abs(r-backgroundBytes[0]),Math.abs(g-backgroundBytes[1]),Math.abs(b-backgroundBytes[2]))<=12;
 let serial=0;const regions:FlatRegion[]=[];
 for(let start=0;start<size;start++){
  if(labels[start]||!keys[start])continue;
  const label=++serial,key=keys[start];let head=0,tail=1;queue[0]=start;labels[start]=label;
  let minX=width,minY=height,maxX=0,maxY=0;
  while(head<tail){const cell=queue[head++],x=cell%width,y=Math.floor(cell/width);
   minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   for(const next of [x>0?cell-1:-1,x+1<width?cell+1:-1,y>0?cell-width:-1,y+1<height?cell+width:-1]){
    if(next>=0&&!labels[next]&&keys[next]===key){labels[next]=label;queue[tail++]=next;}
   }
  }
  const w=(maxX-minX+1)*step,h=(maxY-minY+1)*step,area=tail*step*step;
  if(key===backgroundKey||w<12||h<6||area<Math.max(48,image.width*image.height*0.0001)||tail/((maxX-minX+1)*(maxY-minY+1))<0.82)continue;
  let first=width,last=0;
  for(let x=minX;x<=maxX;x++)if(labels[minY*width+x]===label){first=Math.min(first,x);last=Math.max(last,x);}
  const radius=Math.min(w/2,h/2,Math.max(0,((first-minX)+(maxX-last))/2*step));
  const values=colors.get(key)!;
  if(nearBackground(values.sum[0]/values.count,values.sum[1]/values.count,values.sum[2]/values.count))continue;
  regions.push({label,key,rect:{x:minX*step,y:minY*step,width:Math.min(w,image.width-minX*step),height:Math.min(h,image.height-minY*step)},
   color:colorOf(values.sum,values.count),radius,area});
 }
 const shapes=regions.sort((a,b)=>b.area-a.area).slice(0,200),selected=new Set(shapes.map(region=>region.label));
 const residual:Pixels={...image,rgba:image.rgba.slice()};
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const p=(y*image.width+x)*4,key=keyAt(image.rgba,p),cell=Math.floor(y/step)*width+Math.floor(x/step);
  if(key&&nearBackground(image.rgba[p],image.rgba[p+1],image.rgba[p+2])||selected.has(labels[cell])&&key===keys[cell])residual.rgba[p+3]=0;
 }
 // Group neighbouring occupied tiles so an icon is one crop, not one per stroke.
 // Coarsen when necessary rather than dropping artwork to satisfy a layer budget.
 let tile=Math.max(4,Math.round(Math.min(image.width,image.height)/80));let boxes:ResidualRegion[];
 do{boxes=residualBoxes(residual,tile);tile*=2;}while(boxes.length>200);
 // OCR's ink bounds can miss a few ringing/antialiasing pixels in compressed
 // screenshots. Remove only tiny islands immediately beside text we replaced;
 // never suppress an unrecognised word, control or photographic region.
 if(clearedText.length){
  for(const box of boxes){
   if(box.width>8||box.height>12||box.width*box.height>48||!clearedText.some(r=>box.x>=r.x-7&&box.y>=r.y-7&&box.x+box.width<=r.x+r.width+7&&box.y+box.height<=r.y+r.height+7))continue;
   for(let y=box.y;y<box.y+box.height;y++)for(let x=box.x;x<box.x+box.width;x++)residual.rgba[(y*image.width+x)*4+3]=0;
  }
  boxes=residualBoxes(residual,Math.max(4,Math.round(Math.min(image.width,image.height)/80)));
  while(boxes.length>200){boxes=residualBoxes(residual,tile);tile*=2;}
 }
 const images=boxes.map(part=>{
  const rect={x:part.x,y:part.y,width:part.width,height:part.height},crop=cropMobilePixels(residual,rect);
  // Bounding boxes can nest. Isolate each connected region so moving an image
  // in Figma never exposes a duplicate of some other icon/photo underneath.
  for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++)if(!part.tiles.has(Math.floor((rect.y+y)/part.tile)*part.columns+Math.floor((rect.x+x)/part.tile)))crop.rgba[(y*crop.width+x)*4+3]=0;
  return {rect,image:crop};
 });
 return {background,shapes,images};
}

function residualBoxes(image:Pixels,tile:number):ResidualRegion[]{
 const width=Math.ceil(image.width/tile),height=Math.ceil(image.height/tile),occupied=new Uint8Array(width*height),queue=new Int32Array(width*height);
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(image.rgba[(y*image.width+x)*4+3])occupied[Math.floor(y/tile)*width+Math.floor(x/tile)]=1;
 const boxes:ResidualRegion[]=[];
 for(let start=0;start<occupied.length;start++){
  if(!occupied[start])continue;let head=0,tail=1;queue[0]=start;occupied[start]=0;
  let minX=width,minY=height,maxX=0,maxY=0;
  while(head<tail){const cell=queue[head++],x=cell%width,y=Math.floor(cell/width);
   minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,next=ny*width+nx;
    if(nx>=0&&nx<width&&ny>=0&&ny<height&&occupied[next]){occupied[next]=0;queue[tail++]=next;}
   }
  }
  let left=image.width,top=image.height,right=0,bottom=0;
  for(let y=minY*tile;y<Math.min(image.height,(maxY+1)*tile);y++)for(let x=minX*tile;x<Math.min(image.width,(maxX+1)*tile);x++){
   if(image.rgba[(y*image.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  }
  if(right>left&&bottom>top)boxes.push({x:left,y:top,width:right-left,height:bottom-top,tiles:new Set(queue.subarray(0,tail)),columns:width,tile});
 }
 return boxes;
}
