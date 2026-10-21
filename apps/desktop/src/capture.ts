import type { DomCapture, BoundaryPolicy } from './capture-data';
import type { Color, SceneNode, Rect } from '../../../packages/contracts/src/index';
import { intersection, rectangle, expandedBounds, pruneScene } from './geometry';
import type {PageInfo} from './full-page';
import { cssList, linearGradient } from './visual';
import { graphemes, transformedText, mergeTextLines, type TextFragment } from './text';
import { normalizeStacking, type StackingLayer, type ContentClip } from './stacking';
import { snapshotSvg } from './svg';
import { appearanceRenderer } from './appearance';
import { applyBoxShadow } from './shadows';
import {composedParent,composedContains,renderedChildren,renderedElements,sectionAncestor} from './composed';
(() => {
  const scope = window as unknown as { __w2pProbe?: { enable(mode?: string, policy?: BoundaryPolicy,multiple?:boolean): void; disable(): void; reset(): void; parent(): unknown; read(): unknown; snapshot(): unknown; capture(kind?: string): Promise<DomCapture>; captureBatch(kind?:string,height?:number):Promise<DomCapture[]>;edit(action:string,key?:string):void; boundary(policy: BoundaryPolicy): void; hideOverlay(hidden: boolean): void; layoutMatches(stamp: DomCapture['layoutStamp'],checkContent?:boolean): boolean;fullBegin():PageInfo;fullScroll(y:number):Promise<PageInfo>;fullRestore(x:number,y:number):Promise<boolean>;fullCleanup():Promise<boolean>;fullInfo():PageInfo;freezeAnimations():Promise<number>;restoreAnimations():void } };
  if (scope.__w2pProbe) return;
  let enabled = false;
  let hovered: Element | null = null;
  let selected: Element | null = null;
  let mode = 'element';
  let policy: BoundaryPolicy = 'strict';
  let selectedRect: Rect | null = null;
  let drawing: {x:number;y:number;pointerId:number} | null = null;
  let revision = 0;
  let ignoreClickUntil = 0;
  let note = '';
  let multiple=false;
  let items:Element[]=[],excluded:Element[]=[];
  let contentRevision=0,fullLocked=false,fullCancelled=false,virtualized=false;
  let fullOriginal:{x:number;y:number}|undefined;
  const pausedAnimations=new Set<Animation>();
  function restoreAnimations(){for(const animation of pausedAnimations)try{animation.play();}catch{}pausedAnimations.clear();}
  async function freezeAnimations(){const animations=document.getAnimations().filter(a=>a.playState==='running'&&!pausedAnimations.has(a));if(animations.length>500)throw Error('E_LIMIT_EXCEEDED: 页面动画过多，请缩小范围');for(const animation of animations)try{animation.pause();pausedAnimations.add(animation);}catch{}await Promise.race([Promise.all([...pausedAnimations].map(a=>a.ready.catch(()=>{}))),new Promise(r=>setTimeout(r,500))]);return pausedAnimations.size;}
  const rowSamples=new Map<Element,string>();
  const documentWidth=()=>Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth??0,document.documentElement.clientWidth);
  const documentHeight=()=>Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight??0,document.documentElement.clientHeight);
  const keys=new WeakMap<Element,string>();let nextKey=0;
  const keyOf=(element:Element)=>{let key=keys.get(element);if(!key){key=`dom-${++nextKey}`;keys.set(element,key);}return key;};
  const host = document.createElement('div');
  host.setAttribute('data-w2p-tool', 'true');
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const root = host.attachShadow({ mode: 'closed' });
  const mutationOptions={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['src','srcset','width','height']};const observedRoots=new WeakSet<ShadowRoot>();const observer=new MutationObserver(records=>{if(records.some(record=>record.target!==host&&!host.contains(record.target)))contentRevision++;});observer.observe(document.documentElement,mutationOptions);
  const border = document.createElement('div');
  border.style.cssText = 'position:fixed;box-sizing:border-box;border:2px solid rgb(160,32,75);background:rgba(160,32,75,.05);pointer-events:none;display:none';
  root.append(border); document.documentElement.append(host);
  const outlines=document.createElement('div');root.append(outlines);
  function refreshOutlines(){
    outlines.replaceChildren();
    for(const [list,isExcluded] of [[items,false],[excluded,true]] as const)for(const element of list){
      if(!element.isConnected)continue;const rect=element.getBoundingClientRect();const box=document.createElement('div');
      box.style.cssText=`position:fixed;pointer-events:none;box-sizing:border-box;border:${isExcluded?'2px dashed #b13b32':'2px solid #a0204b'};background:${isExcluded?'rgba(177,59,50,.09)':'transparent'};left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
      outlines.append(box);
    }
  }
  function cleanExclusions(){excluded=excluded.filter(element=>items.some(parent=>parent!==element&&composedContains(parent,element)));}
  function choose(element:Element,append:boolean){
    if(!append){items=[element];excluded=[];}
    else if(items.includes(element)){items=items.filter(item=>item!==element);}
    else if(items.some(parent=>composedContains(parent,element))){note='该元素已包含在选中的父级中，不会重复添加。';return;}
    else {const next=items.filter(child=>!composedContains(element,child));if(next.length>=20){note='一次最多选择 20 个区块。';return;}items=[...next,element];}
    selected=items.at(-1)??null;selectedRect=null;cleanExclusions();revision++;refreshOutlines();
  }
  function describe(element: Element) {
    const box = element.getBoundingClientRect(); const css = getComputedStyle(element);
    return { tag: element.tagName.toLowerCase(), id: element.id, role: element.getAttribute('role'), text: (element.textContent ?? '').trim().slice(0, 240), rect: { x: box.x, y: box.y, width: box.width, height: box.height }, documentRect: { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height }, style: { display: css.display, fontFamily: css.fontFamily, fontSize: css.fontSize, color: css.color, backgroundColor: css.backgroundColor }, childCount: element.children.length };
  }
  function highlight(element: Element) {
    const box = element.getBoundingClientRect();
    highlightRect(box);
  }
  function highlightRect(box: Rect) {
    Object.assign(border.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, display: 'block' });
  }
  function move(event: MouseEvent) {
    if (!enabled || mode === 'rectangle') return;
    const hit = event.composedPath().find((e):e is Element=>e instanceof Element&&e!==host);
    if (hit) { const atomic=hit.closest('svg')??hit;hovered = mode === 'section' ? sectionAncestor(atomic) : atomic; highlight(hovered); }
  }
  function click(event: MouseEvent) {
    if(fullLocked){event.preventDefault();event.stopImmediatePropagation();return;}
    if (performance.now() < ignoreClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!enabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (mode === 'rectangle') return;
    const rawHit = event.composedPath().find((e):e is Element=>e instanceof Element&&e!==host);
    const hit=rawHit?.closest('svg')??rawHit;
    if(!hit||hit===host)return;note='';
    if(mode==='exclude'){
      if(!items.some(parent=>parent!==hit&&composedContains(parent,hit))||items.includes(hit)){note='请点选已选区块内部的子元素；移除整个区块请使用右侧列表。';return;}
      if(excluded.length>=100&&!excluded.includes(hit)){note='一次最多排除 100 项，请缩小范围。';return;}
      if(excluded.includes(hit))excluded=excluded.filter(item=>item!==hit);
      else if(!excluded.some(parent=>composedContains(parent,hit)))excluded=[...excluded.filter(child=>!composedContains(hit,child)),hit];
      revision++;refreshOutlines();return;
    }
    choose(mode==='section'?sectionAncestor(hit):hit,multiple||event.shiftKey);
    enabled=multiple||event.shiftKey;if(selected&&!enabled)highlight(selected);
  }
  function key(event: KeyboardEvent) {if(fullLocked&&['Escape',' ','ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')fullCancelled=true;return;} if (event.key === 'Escape' && enabled) { event.preventDefault();event.stopImmediatePropagation(); disable(); } }
  function disable() {
    enabled = false; hovered = null; note = '';
    if (drawing) { const pointerId=drawing.pointerId; drawing=null;ignoreClickUntil=performance.now()+400; if(host.hasPointerCapture(pointerId))host.releasePointerCapture(pointerId); selectedRect=null; }
    host.style.pointerEvents='none';host.style.cursor='';border.style.display = 'none';
  }
  const point = (event: PointerEvent) => ({x:Math.max(0,Math.min(document.documentElement.clientWidth,event.clientX)),y:Math.max(0,Math.min(document.documentElement.clientHeight,event.clientY))});
  function pointerDown(event: PointerEvent) {
    if (!enabled || mode !== 'rectangle' || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();event.stopImmediatePropagation();
    drawing={...point(event),pointerId:event.pointerId}; selectedRect=null; revision++;note='';
    host.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    event.preventDefault();event.stopImmediatePropagation();highlightRect(rectangle(drawing,point(event)));
  }
  function pointerUp(event: PointerEvent) {
    if (!drawing || drawing.pointerId !== event.pointerId) return;
    event.preventDefault();event.stopImmediatePropagation();
    const rect=rectangle(drawing,point(event));drawing=null;ignoreClickUntil=performance.now()+400;
    if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
    if(rect.width<4||rect.height<4) { note='选区宽高至少 4px，请重新拖拽。';border.style.display='none';return; }
    selectedRect={...rect,x:rect.x+scrollX,y:rect.y+scrollY};revision++;
    enabled=false;host.style.pointerEvents='none';host.style.cursor='';highlightRect(rect);
  }
  document.addEventListener('mousemove', move, true);
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', key, true);
  document.addEventListener('wheel',event=>{if(fullLocked)event.preventDefault();},{capture:true,passive:false});
  document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('pointerup',pointerUp,true);
  document.addEventListener('pointercancel',()=>{if(drawing){disable();selectedRect=null;revision++;}},true);
  host.addEventListener('lostpointercapture',()=>{if(drawing){disable();selectedRect=null;revision++;}});
  addEventListener('blur',()=>{if(drawing){disable();selectedRect=null;revision++;}});
  document.addEventListener('selectstart',event=>{if(enabled&&mode==='rectangle')event.preventDefault();},true);
  addEventListener('scroll', () => {
    refreshOutlines();
    if(drawing){disable();selectedRect=null;revision++;return;}
    if(selectedRect&&!enabled)highlightRect({...selectedRect,x:selectedRect.x-scrollX,y:selectedRect.y-scrollY});
    else if (selected?.isConnected && !enabled) highlight(selected); else if (enabled) border.style.display = 'none';
  }, true);
  addEventListener('resize', () => {refreshOutlines(); if(selectedRect||drawing){disable();selectedRect=null;revision++;}else if (selected?.isConnected) highlight(selected); });

  function rangeBounds(requested: Rect): Rect {
    if(policy==='strict')return requested;
    const candidates: Rect[]=[];let count=0;
    function scan(element: Element,clip?:Rect|null) {
      if(++count>3000)throw new Error('E_LIMIT_EXCEEDED: 元素吸附候选过多，请缩小页面范围');
      if(clip===null)return;
      if(element===host)return;
      const css=getComputedStyle(element);if(css.display==='none'||css.visibility!=='visible')return;
      const box=element.getBoundingClientRect();
      const rect={x:box.x+scrollX,y:box.y+scrollY,width:box.width,height:box.height};
      const atomic=element.matches('button,a,img,input,textarea,select,canvas,video,svg,iframe') || (!['HTML','BODY','MAIN'].includes(element.tagName)&&box.width>0&&box.height>0&&(element.childElementCount===0&&!element.shadowRoot||(!!element.textContent?.trim()&&Array.from(element.children).every(child=>getComputedStyle(child).display.startsWith('inline')))));
      const visible=clip?intersection(rect,clip):rect;
      if(atomic){if(visible&&intersection(requested,visible))candidates.push(visible);return;}
      const childClip=css.display!=='contents'&&(css.overflowX!=='visible'||css.overflowY!=='visible')?visible:clip;
      for(const child of renderedChildren(element))if(child instanceof Element)scan(child,childClip);
    }
    scan(document.documentElement);
    return expandedBounds(requested,candidates,{x:scrollX,y:scrollY,width:innerWidth,height:innerHeight});
  }

  async function capture(kind = 'selection',override?:Element,fullHeight=30000): Promise<DomCapture> {
    const viewportMode=kind==='viewport';
    const fullMode=kind==='full_page';
    const rangeMode=fullMode||viewportMode||!!selectedRect;
    if (!fullMode&&!viewportMode && !selected && !selectedRect) throw new Error('E_SELECTION_REQUIRED: 请先选择元素、Section 或拖出矩形');
    if (!rangeMode && !selected!.isConnected) throw new Error('E_SELECTION_STALE: 请重新选择区块');
    const chosen = rangeMode ? document.documentElement : override??selected!;
    const startRevision=revision;
    const pendingImages = renderedElements(chosen).filter((e):e is HTMLImageElement=>e instanceof HTMLImageElement&&!e.complete).slice(0,100);
    await Promise.race([Promise.all([document.fonts.ready, ...pendingImages.map(img => img.decode().catch(() => undefined))]), new Promise(resolve => setTimeout(resolve, 2000))]);
    if (!chosen.isConnected || revision!==startRevision || (!rangeMode&&!override&&selected !== chosen)) throw new Error('E_SELECTION_STALE: 区块发生变化，请重新选择');
    const started = performance.now();
    const box=chosen.getBoundingClientRect();
    const requested: Rect=fullMode?{x:0,y:0,width:documentWidth(),height:documentHeight()}:viewportMode?{x:scrollX,y:scrollY,width:document.documentElement.clientWidth,height:document.documentElement.clientHeight}:selectedRect?{...selectedRect}:{x:box.x+scrollX,y:box.y+scrollY,width:box.width,height:box.height};
    const documentBounds=fullMode?{...requested,width:Math.min(requested.width,12000),height:Math.min(requested.height,fullHeight,30000)}:rangeMode&&!viewportMode?rangeBounds(requested):requested;
    const original=new DOMRect(documentBounds.x-scrollX,documentBounds.y-scrollY,documentBounds.width,documentBounds.height);
    if (original.width <= 0 || original.height <= 0 || original.width > 100000 || original.height > 100000) throw new Error('E_LIMIT_EXCEEDED: 选区尺寸无效或过大');
    const nodes: SceneNode[] = []; const warnings: DomCapture['warnings'] = []; const images: DomCapture['images'] = [];const seenElements=new Set<Element>();
    const flexCandidates:NonNullable<DomCapture['flexCandidates']>=[];
    const textFragments:TextFragment[]=[],elementFrames=new Map<Element,{id:string;box:DOMRect;css:CSSStyleDeclaration}>();
    const stackingLayers=new Map<string,StackingLayer>(),contentClips=new Map<string,ContentClip>(),backgroundLayers=new Set<string>();
    const textWarningKeys=new Set<string>(),preservedFormContents=new Set<string>();
    let visited = 0, textUnits = 0;
    const warn = (code: string, message: string, nodeId?: string) => { if (warnings.length < 1000) warnings.push({ code, severity: 'warning', message, ...(nodeId ? { nodeId } : {}) }); };
    if(fullMode&&requested.width>documentBounds.width)warn('W_FULL_PAGE_WIDTH_LIMIT','页面超过 12000px 宽度，仅转换左侧已覆盖范围。');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true })!; const colors = new Map<string, Color>();
    const color = (value: string): Color => {
      if (colors.has(value)) return colors.get(value)!;
      context.clearRect(0, 0, 1, 1); context.fillStyle = '#000'; context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      const [r,g,b,a] = context.getImageData(0,0,1,1).data; const result = { r:r/255,g:g/255,b:b/255,a:a/255 }; colors.set(value, result); return result;
    };
    const budget = () => { if (visited > 3000 || nodes.length > 5000 || textUnits > 60000 || images.length > 200) throw new Error('E_LIMIT_EXCEEDED: 请缩小区块（最多 3000 元素 / 5000 图层 / 60000 字符 / 200 图片）'); if (performance.now() - started > 8000) throw new Error('E_CAPTURE_TIMEOUT: 区块提取超时，请缩小范围'); };
    const font = (css: CSSStyleDeclaration) => {
      const weight = Number.parseInt(css.fontWeight) || 400;
      const italic = css.fontStyle !== 'normal';
      const style = weight >= 900 ? 'Black' : weight >= 800 ? 'Extra Bold' : weight >= 700 ? 'Bold' : weight >= 600 ? 'Semi Bold' : weight >= 500 ? 'Medium' : weight <= 100 ? 'Thin' : weight <= 200 ? 'Extra Light' : weight <= 300 ? 'Light' : 'Regular';
      const families=cssList(css.fontFamily).map(f=>f.trim().replace(/^["']|["']$/g,'')).filter(Boolean).slice(0,9);
      return { family:families[0]??'sans-serif', ...(families.length>1?{fallbacks:families.slice(1)}:{}), style: italic ? (style === 'Regular' ? 'Italic' : `${style} Italic`) : style, weight, size: parseFloat(css.fontSize) || 16 };
    };
    const appearance=appearanceRenderer({root,nodes,layers:stackingLayers,color,font,checkpoint:budget,countText(length){textUnits+=length;budget();},warn,frameId(element){return elementFrames.get(element)?.id;},preserveContent(id){preservedFormContents.add(id);},background(id){backgroundLayers.add(id);}});
    const textWarning=(code:string,message:string,nodeId:string,property:string)=>{
      const key=code+nodeId;if(textWarningKeys.has(key))return;textWarningKeys.add(key);
      if(warnings.length<1000)warnings.push({code,severity:'warning',message,nodeId,details:{property,editability:'native text fragments'},fallback:'native-text-fragments'});
    };
    const transparentInline=(css:CSSStyleDeclaration)=>['inline','contents'].includes(css.display)&&css.position==='static'&&css.float==='none'&&css.direction==='ltr'&&css.writingMode==='horizontal-tb'&&css.verticalAlign==='baseline'&&Number(css.opacity)===1&&color(css.backgroundColor).a===0&&css.backgroundImage==='none'&&css.boxShadow==='none'&&css.textShadow==='none'&&css.transform==='none'&&css.filter==='none'&&css.mixBlendMode==='normal'&&css.maskImage==='none'&&css.clipPath==='none'&&css.overflowX==='visible'&&css.overflowY==='visible'&&[css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth,css.paddingLeft,css.paddingRight,css.marginLeft,css.marginRight].every(v=>parseFloat(v)===0);
    const transformed=(css:CSSStyleDeclaration)=>css.transform!=='none'||css.translate!=='none'||css.rotate!=='none'||css.scale!=='none'||css.perspective!=='none';
    const fixedContainingBlock=(css:CSSStyleDeclaration)=>transformed(css)||css.filter!=='none'||css.backdropFilter!=='none'||/\b(layout|paint|strict|content)\b/.test(css.contain)||/\b(transform|filter|perspective)\b/.test(css.willChange);
    function addText(textNode: Text, parentId: string, parentBox: DOMRect, css: CSSStyleDeclaration) {
      const content = textNode.textContent ?? ''; textUnits += content.length; budget();
      const range = document.createRange();
      let owner={id:parentId,box:parentBox};let ancestor=composedParent(textNode);
      while(ancestor&&ancestor!==chosen){const parentElement=composedParent(ancestor),own=elementFrames.get(ancestor),parent=parentElement&&elementFrames.get(parentElement);if(!own||!parent||!transparentInline(own.css))break;owner=parent;ancestor=parentElement;}
      let decoration:'none'|'underline'|'line-through'='none';
      for(let element=composedParent(textNode); element; element=composedParent(element)){
        const own=elementFrames.get(element)?.css??getComputedStyle(element),line=own.textDecorationLine;
        if(line!=='none'){
          const next=line.includes('underline')?'underline':line.includes('line-through')?'line-through':'none';
          if(next!=='none'){if(decoration!=='none'&&decoration!==next)textWarning('W_TEXT_DECORATION_APPROXIMATED','多重装饰线暂保留一条原生装饰线。',parentId,'text-decoration');decoration=next;}
          if(line.includes('overline')||line.includes('underline')&&line.includes('line-through')||own.textDecorationStyle!=='solid'||own.textDecorationThickness!=='auto'||JSON.stringify(color(own.textDecorationColor))!==JSON.stringify(color(css.color)))textWarning('W_TEXT_DECORATION_APPROXIMATED','装饰线采用原生默认颜色/粗细/位置；自定义或多重装饰暂未完整映射。',parentId,'text-decoration');
        }
        if(own.display==='inline-block'||own.display==='inline-flex'||own.display==='inline-grid')break;
      }
      const unsupported=css.writingMode!=='horizontal-tb'||css.direction==='rtl'||!['none','uppercase','lowercase'].includes(css.textTransform)||css.textShadow!=='none'||css.fontVariantCaps!=='normal'||css.fontVariationSettings!=='normal'||css.fontFeatureSettings!=='normal'||css.fontStyle.startsWith('oblique')||css.textAlign==='justify'||content.includes('\t');
      if(unsupported)textWarning('W_TEXT_LAYOUT_UNSUPPORTED','竖排、RTL、特殊大小写/字形、两端对齐、文字阴影或制表符暂按原生片段保留。',parentId,'text layout/transform/shaping');
      const locale=textNode.parentElement?.closest('[lang]')?.getAttribute('lang')||document.documentElement.lang||undefined;
      let line: { text: string; left: number; top: number; right: number; bottom: number } | undefined;
      const flush = () => {
        if (!line || !line.text) { line = undefined; return; }
        const f = font(css); const lineHeight = parseFloat(css.lineHeight) || f.size * 1.2;
        const id = `n${nodes.length}`;
        const node:SceneNode={ id, sourceId: keyOf(composedParent(textNode)!), name: line.text.trim().slice(0, 80)||'空白', type: 'TEXT', parentId, order: nodes.length, fidelity: unsupported||textWarningKeys.has('W_TEXT_DECORATION_APPROXIMATED'+parentId)?'approximated':'native',
          rect: { x: line.left - parentBox.x, y: line.top - parentBox.y, width: Math.max(0.1, line.right - line.left + 0.5), height: Math.max(line.bottom - line.top, lineHeight) },
          style: { fills: [{ kind: 'solid', color: color(css.color) }] },
          text: { characters: line.text, font: f, lineHeight, letterSpacing: parseFloat(css.letterSpacing) || 0, align: 'left', runs: [{start:0,end:line.text.length,font:f,color:color(css.color),letterSpacing:parseFloat(css.letterSpacing)||0,decoration}] } };
        nodes.push(node);
        textFragments.push({node,ownerId:unsupported?parentId:owner.id,ownerRect:unsupported?parentBox:owner.box,absolute:{x:line.left,y:line.top,width:line.right-line.left,height:node.rect.height},sequence:textFragments.length,join:!unsupported});
        if(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(line.text)&&!textWarningKeys.has('glyph'+parentId)){textWarningKeys.add('glyph'+parentId);if(warnings.length<1000)warnings.push({code:'I_TEXT_GLYPH_COVERAGE_UNVERIFIED',severity:'info',nodeId:owner.id,message:'已保留完整 emoji 字素；Figma 字体的逐字缺字/彩色字形覆盖无法由本地 API 确认，请核对实际显示。',details:{property:'font glyph coverage'},fallback:'native-text'});}
        line = undefined; budget();
      };
      for (const {segment:char,index} of graphemes(content)) {
        range.setStart(textNode,index);range.setEnd(textNode,index+char.length);
        const boxes = range.getClientRects(); const box = boxes[0];
        if (!box || box.width <= 0 || box.height <= 0) continue;
        if (line && Math.abs(line.top - box.top) > Math.max(2, box.height * 0.3)) flush();
        // Range positions preserve wrapping/alignment. Each rendered line remains native editable text.
        const visible = transformedText(/^[\t\n\r\f ]+$/.test(char) && !['pre', 'pre-wrap', 'break-spaces'].includes(css.whiteSpace) ? ' ' : char,css.textTransform,locale);
        if (!line) line = { text: visible, left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        else { line.text += visible; line.left = Math.min(line.left, box.left); line.right = Math.max(line.right, box.right); line.bottom = Math.max(line.bottom, box.bottom); }
        if (index % 256 === 0) budget();
      }
      flush();
    }
    function visit(element: Element, parentId: string | null, parentBox: DOMRect) {
      if(seenElements.has(element))return;seenElements.add(element);visited++; budget();
      if (element === host || (!fullMode&&!viewportMode&&excluded.includes(element)) || ['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','META','LINK','HEAD'].includes(element.tagName)) return;
      const css = getComputedStyle(element); if (css.display === 'none' || css.contentVisibility === 'hidden') return;
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        if(css.display==='contents'&&parentId)elementFrames.set(element,{id:parentId,box:parentBox,css});
        if (css.display === 'contents') for (const child of renderedChildren(element)) {
          if (child instanceof Element) visit(child, parentId, parentBox);
          else if (child instanceof Text && parentId !== null && css.visibility === 'visible') addText(child, parentId, parentBox, css);
        }
        return;
      }
      const id = `n${nodes.length}`;
      const node: SceneNode = { id, sourceId: keyOf(element), name: `${element.tagName.toLowerCase()}${element.id ? ` #${element.id}` : ''}`.slice(0, 256), type: 'FRAME', parentId, order: nodes.length,
        rect: { x: parentId ? box.x - parentBox.x : 0, y: parentId ? box.y - parentBox.y : 0, width: box.width, height: box.height }, fidelity: 'native', style: { opacity: parseFloat(css.opacity), fills: [] },
        clipsContent: false, layout: { mode: 'absolute' } };
      nodes.push(node);
      if(['flex','inline-flex'].includes(css.display)&&['row','column'].includes(css.flexDirection)&&css.flexWrap==='nowrap'&&['normal','flex-start','start'].includes(css.justifyContent)&&css.alignItems!=='baseline'&&![...element.childNodes].some(n=>n instanceof Text&&n.textContent?.trim())&&[...element.children].every(child=>getComputedStyle(child).position==='static'))flexCandidates.push({id,axis:css.flexDirection==='row'?'horizontal':'vertical'});
      elementFrames.set(element,{id,box,css});
      let layoutParent=composedParent(element),parentCss=layoutParent?(elementFrames.get(layoutParent)?.css??getComputedStyle(layoutParent)):undefined;
      while(layoutParent&&parentCss?.display==='contents'){layoutParent=composedParent(layoutParent);parentCss=layoutParent?(elementFrames.get(layoutParent)?.css??getComputedStyle(layoutParent)):undefined;}
      const item=!!parentCss&&['flex','inline-flex','grid','inline-grid'].includes(parentCss.display);
      const positioned=css.position!=='static',z=(positioned||item)&&css.zIndex!=='auto'?Number(css.zIndex):null;
      const isContext=element===document.documentElement||['fixed','sticky'].includes(css.position)||z!==null||Number(css.opacity)<1||fixedContainingBlock(css)||css.isolation==='isolate'||css.mixBlendMode!=='normal'||css.clipPath!=='none'||css.maskImage!=='none'||/\b(opacity|mix-blend-mode|clip-path|mask)\b/.test(css.willChange);
      let containingBlock:string|undefined;
      if(['absolute','fixed'].includes(css.position))for(let ancestor=composedParent(element);ancestor;ancestor=composedParent(ancestor)){const ancestorCss=elementFrames.get(ancestor)?.css??getComputedStyle(ancestor);if(ancestorCss.display!=='contents'&&(fixedContainingBlock(ancestorCss)||css.position==='absolute'&&ancestorCss.position!=='static')){containingBlock=elementFrames.get(ancestor)?.id??'outside-selection';break;}}
      stackingLayers.set(id,{context:isContext,position:css.position,zIndex:z,...item?{flowOrder:Number(css.order)||0}:{},containingBlock});
      if (css.visibility !== 'visible') { node.style.opacity = 0; warn('W_VISIBILITY', '隐藏容器的可见子元素暂不完整支持。', id); }
      const bg = color(css.backgroundColor); if (bg.a) node.style.fills!.push({ kind: 'solid', color: bg });
      // The canvas background of HTML/body is painted by the synthetic crop root.
      if(rangeMode&&(element===document.documentElement||(element===document.body&&color(getComputedStyle(document.documentElement).backgroundColor).a===0)))node.style.fills=[];
      const sides = [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth].map(v => parseFloat(v) || 0);
      const sideStyles = [css.borderTopStyle,css.borderRightStyle,css.borderBottomStyle,css.borderLeftStyle];
      const sideColors = [css.borderTopColor,css.borderRightColor,css.borderBottomColor,css.borderLeftColor].map(color);
      const visibleSides = sides.map((width, index) => width > 0 && !['none','hidden'].includes(sideStyles[index]) && sideColors[index].a > 0);
      const uniform = visibleSides.every(Boolean) && sides.every(width => width === sides[0]) && sideStyles.every(style => style === 'solid') && sideColors.every(value => ['r','g','b','a'].every(key => value[key as keyof Color] === sideColors[0][key as keyof Color]));
      if (uniform) node.style.border = { width: sides[0], color: sideColors[0] };
      const separateBorders = !uniform && visibleSides.some(Boolean);
      node.style.radii = [css.borderTopLeftRadius,css.borderTopRightRadius,css.borderBottomRightRadius,css.borderBottomLeftRadius].map(v => { if (v.includes('%') || v.includes(' ')) warn('W_RADIUS_APPROXIMATED', '百分比或椭圆圆角暂用像素近似。', id); return parseFloat(v) || 0; });
      if (separateBorders && (node.style.radii.some(radius => radius > 0) || visibleSides.some((visible, index) => visible && sideStyles[index] !== 'solid'))) {
        node.fidelity = 'approximated'; warn('W_BORDER_APPROXIMATED', '各边独立保留；非实线或非均匀圆角边框的线型/转角暂用矩形近似。', id);
      }
      function appendBorders() {
        if (!separateBorders) return;
        // Existing SHAPE nodes keep the package and Figma importer compatible.
        // A one-sided CSS border must never turn into a full Frame stroke.
        for (let index = 0; index < 4; index++) {
          if (!visibleSides[index]) continue;
          const side = ['top','right','bottom','left'][index];
          const width = Math.min(sides[index], index % 2 ? box.width : box.height);
          const rect = index % 2 ? { x:index === 1 ? box.width - width : 0, y:0, width, height:box.height }
            : { x:0, y:index === 2 ? box.height - width : 0, width:box.width, height:width };
          nodes.push({ id:`n${nodes.length}`, sourceId:`${id}:border-${side}`, name:`边框 / ${side}`, type:'SHAPE', parentId:id, order:nodes.length, rect,
            fidelity:node.fidelity === 'approximated' ? 'approximated' : 'native', style:{ fills:[{kind:'solid',color:sideColors[index]}] } });
          budget();
        }
      }
      applyBoxShadow(css,node,color,extra=>{const result:SceneNode={...extra,id:`n${nodes.length}`,order:nodes.length};nodes.push(result);budget();return result;},id=>backgroundLayers.add(id),warn,element.getClientRects().length===1&&!['inline','table','inline-table'].includes(css.display));
      if (transformed(css) || css.filter !== 'none' || css.backdropFilter !== 'none' || css.mixBlendMode !== 'normal' || css.clipPath !== 'none' || css.maskImage !== 'none') { node.fidelity = 'approximated'; warn('W_EFFECT_UNSUPPORTED', '变换/透视/filter/混合/蒙版暂按轴对齐布局近似。', id); }
      if(fullMode&&['fixed','sticky'].includes(css.position))warn('I_FULL_PAGE_POSITION', `${css.position==='fixed'?'固定':'吸顶'}元素按页面顶部滚动状态导出一次，保留静态可编辑外观。`,id);
      if(css.float!=='none'||['table','inline-table','ruby'].includes(css.display)||[css.marginTop,css.marginRight,css.marginBottom,css.marginLeft].some(v=>parseFloat(v)<0)||element.matches(':modal,:popover-open')){node.fidelity='approximated';warn('W_STACKING_UNSUPPORTED','浮动、表格/ruby、负外边距重叠或顶层弹窗的特殊绘制阶段暂未完整还原。',id);}
      if(/\b(paint|strict|content)\b/.test(css.contain)||css.contentVisibility==='auto'){node.fidelity='approximated';warn('W_CLIP_UNSUPPORTED','contain/content-visibility 引入的隐式裁切暂未完整还原，保留可编辑轴对齐外观。',id);}
      const borderBox:Rect={x:0,y:0,width:box.width,height:box.height};
      const insetBox=(base:Rect,values:number[]):Rect=>({x:base.x+values[3],y:base.y+values[0],width:Math.max(0,base.width-values[1]-values[3]),height:Math.max(0,base.height-values[0]-values[2])});
      const paddingBox=insetBox(borderBox,sides);
      const contentBox=insetBox(paddingBox,[css.paddingTop,css.paddingRight,css.paddingBottom,css.paddingLeft].map(v=>parseFloat(v)||0));
      const boxFor=(value:string)=>value==='border-box'?borderBox:value==='padding-box'?paddingBox:value==='content-box'?contentBox:undefined;
      const clipFrame=(rect:Rect,name:string)=>{
        const clipId=`n${nodes.length}`;
        const insets=[rect.y,box.width-rect.x-rect.width,box.height-rect.y-rect.height,rect.x];
        const radii=node.style.radii!.map((r,i)=>Math.max(0,r-Math.max(insets[i],insets[(i+3)%4])));
        nodes.push({id:clipId,sourceId:id,name,type:'FRAME',parentId:id,order:nodes.length,rect:{...rect},style:{fills:[],radii},fidelity:'native',clipsContent:true,layout:{mode:'absolute'}});budget();return clipId;
      };
      const visualWarning=(code:string,message:string,property:string)=>{
        node.fidelity='approximated';warn(code,message,id);
        const warning=warnings.at(-1);if(warning?.nodeId===id){warning.fallback='base-color-and-native-content';warning.details={property,editability:'native remainder; unsupported background omitted'};}
      };
      const addImage = (request: Omit<DomCapture['images'][number], 'nodeId'>,clip:Rect,name:string) => {
        if(clip.width<=0||clip.height<=0)return;
        const parent=clipFrame(clip,name+' / 裁切');
        if(name==='背景图片')backgroundLayers.add(parent);
        const imageId = `n${nodes.length}`;
        nodes.push({ id: imageId, sourceId: id, name, type: 'IMAGE', parentId: parent, order: nodes.length, rect: { x:0,y:0,width:clip.width,height:clip.height }, style: {}, fidelity: 'native', assetId: 'pending' });
        images.push({ nodeId: imageId, ownerNodeId:id, ...request });
        budget();
      };
      const backgroundClip=boxFor(css.backgroundClip);
      const backgroundOrigin=boxFor(css.backgroundOrigin);
      // The color uses background-clip too, independently of overflow on the content.
      if(backgroundClip&&css.backgroundClip!=='border-box'&&bg.a){
        node.style.fills=[];
        if(backgroundClip.width>0&&backgroundClip.height>0){const layer=clipFrame(backgroundClip,'背景色 / 裁切');backgroundLayers.add(layer);nodes.at(-1)!.style.fills=[{kind:'solid',color:bg}];}
      }
      if(css.backgroundImage!=='none'){
        const layers=cssList(css.backgroundImage);
        const url=css.backgroundImage.match(/^url\("((?:\\.|[^"\\])*)"\)$/);
        if(layers.length!==1||!backgroundClip||!backgroundOrigin||css.backgroundAttachment!=='scroll'||css.backgroundBlendMode!=='normal'){
          visualWarning('W_BACKGROUND_UNSUPPORTED','多层背景、特殊裁切、固定背景或背景混合暂不支持；保留底色和原生内容。','background-image/clip/attachment/blend-mode');
        }else if(url){
          if(!['no-repeat','repeat','repeat no-repeat','no-repeat repeat'].includes(css.backgroundRepeat))visualWarning('W_BACKGROUND_UNSUPPORTED','背景 round/space 平铺暂不支持；保留底色和原生内容。','background-repeat');
          else addImage({url:url[1].replace(/\\(["\\])/g,'$1'),layout:{area:{...backgroundOrigin,x:backgroundOrigin.x-backgroundClip.x,y:backgroundOrigin.y-backgroundClip.y},size:css.backgroundSize,position:css.backgroundPosition,repeat:css.backgroundRepeat}},backgroundClip,'背景图片');
        }else{
          try{
            if(!['auto','auto auto'].includes(css.backgroundSize)||css.backgroundPosition!=='0% 0%')throw Error('渐变自定义背景尺寸和定位暂不支持');
            const fill=linearGradient(css.backgroundImage,backgroundOrigin.width,backgroundOrigin.height,color,value=>CSS.supports('color',value));
            const parent=clipFrame(backgroundClip,'渐变 / 裁切');
            backgroundLayers.add(parent);
            nodes.push({id:`n${nodes.length}`,sourceId:id,name:'线性渐变',type:'SHAPE',parentId:parent,order:nodes.length,rect:{...backgroundOrigin,x:backgroundOrigin.x-backgroundClip.x,y:backgroundOrigin.y-backgroundClip.y},style:{fills:[fill]},fidelity:'native'});budget();
            if(css.backgroundRepeat!=='no-repeat'&&(backgroundOrigin.width<backgroundClip.width||backgroundOrigin.height<backgroundClip.height))visualWarning('W_BACKGROUND_UNSUPPORTED','渐变保留单次原生绘制，边框下的重复区域暂不还原。','background-repeat');
          }catch{visualWarning('W_GRADIENT_UNSUPPORTED','暂不支持此渐变类型、色标或背景尺寸/定位；保留底色和原生内容。','background-image/size/position');}
        }
      }
      if (element instanceof HTMLImageElement) {
        if (!element.complete || !element.naturalWidth) warn('E_ASSET_UNAVAILABLE', '图片尚未加载或已损坏。', id);
        else {
          let base64: string | undefined;
          if (element.currentSrc.startsWith('blob:')) {
            try { const bitmap = document.createElement('canvas'); bitmap.width = element.naturalWidth; bitmap.height = element.naturalHeight;
              if (bitmap.width > 4096 || bitmap.height > 4096) throw Error('图片超过 4096px');
              bitmap.getContext('2d')!.drawImage(element,0,0); base64 = bitmap.toDataURL('image/png').split(',')[1];
            } catch { warn('E_ASSET_UNAVAILABLE', 'blob 图片无法读取。', id); }
          }
          if (base64 || !element.currentSrc.startsWith('blob:')) addImage({...base64?{base64}:{url:element.currentSrc||element.src},layout:{area:{x:0,y:0,width:contentBox.width,height:contentBox.height},fit:css.objectFit,position:css.objectPosition,natural:{width:element.naturalWidth,height:element.naturalHeight}}},contentBox,'图片');
        }
        appendBorders(); return;
      }
      if(element instanceof SVGSVGElement){
        try{
          const snapshot=snapshotSvg(element,contentBox.width,contentBox.height,()=>{visited++;budget();},fullMode||viewportMode?[]:excluded);
          nodes.push({id:`n${nodes.length}`,sourceId:id,name:'SVG / 可编辑矢量',type:'VECTOR',parentId:id,order:nodes.length,rect:{...contentBox},style:{},fidelity:'native',clipsContent:css.overflowX!=='visible'||css.overflowY!=='visible',svg:snapshot.svg});budget();
        }catch(error){
          if(error instanceof Error&&/^E_(?:LIMIT_EXCEEDED|CAPTURE_TIMEOUT)/.test(error.message))throw error;
          node.fidelity='missing';warn('W_SVG_UNSUPPORTED','SVG含暂不支持的元素、外部引用、复杂效果或超出矢量预算，保留外框；未转为截图。',id);
        }
        appendBorders();return;
      }
      if(appearance.control(element,css,node)){
        if(element instanceof HTMLInputElement&&['checkbox','radio'].includes(element.type)&&css.appearance==='none'){appearance.pseudo(element,'::before',node,box);appearance.pseudo(element,'::after',node,box);}
        appendBorders();return;
      }
      if (['IFRAME','CANVAS','VIDEO'].includes(element.tagName)) { node.fidelity = 'missing'; warn('W_CONTENT_UNSUPPORTED', `${element.tagName} 内容暂未重建，只保留外框。`, id); appendBorders(); return; }
      if (element.shadowRoot&&!observedRoots.has(element.shadowRoot)){observer.observe(element.shadowRoot,mutationOptions);observedRoots.add(element.shadowRoot);}
      if(element.tagName.includes('-')&&!element.shadowRoot){node.fidelity=element.childNodes.length?'approximated':'missing';warn('W_COMPONENT_BOUNDARY','自定义组件未暴露开放ShadowRoot；仅采集可访问内容，封闭内部无法读取。',id);}
      const clipX=css.overflowX!=='visible',clipY=css.overflowY!=='visible';
      if(clipX||clipY){
        if(clipX!==clipY||!['0px','border-box 0px','padding-box 0px','content-box 0px'].includes(css.overflowClipMargin)){node.fidelity='approximated';warn('W_CLIP_UNSUPPORTED','单轴裁切或非零overflow-clip-margin暂用双轴padding-box裁切近似。',id);}
        const scrollBarX=element instanceof HTMLElement?Math.max(0,element.offsetWidth-element.clientWidth-sides[1]-sides[3]):0;
        const scrollBarY=element instanceof HTMLElement?Math.max(0,element.offsetHeight-element.clientHeight-sides[0]-sides[2]):0;
        const clipRect={...paddingBox,width:Math.max(0,paddingBox.width-scrollBarX),height:Math.max(0,paddingBox.height-scrollBarY)};
        const clipId=clipFrame(clipRect,'内容溢出 / 裁切');contentClips.set(id,{id:clipId,ownerId:id,rect:clipRect});
        if(scrollBarX||scrollBarY)warn('I_SCROLLBAR_OMITTED','按当前滚动位置保留内容与可见内边界；浏览器原生滚动条不转换为图层。',id);
      }
      appearance.pseudo(element,'::before',node,box);
      for (const child of renderedChildren(element)) {
        if (child instanceof Element) visit(child, id, box);
        else if (child instanceof Text && css.visibility === 'visible') addText(child, id, box, css);
      }
      appearance.pseudo(element,'::after',node,box);
      appendBorders();
    }
    if(rangeMode){
      const html=color(getComputedStyle(document.documentElement).backgroundColor);
      const body=document.body?color(getComputedStyle(document.body).backgroundColor):{r:0,g:0,b:0,a:0};
      const canvas=html.a>0?html:body;
      const background={r:canvas.r*canvas.a+1-canvas.a,g:canvas.g*canvas.a+1-canvas.a,b:canvas.b*canvas.a+1-canvas.a,a:1};
      nodes.push({id:'n0',name:fullMode?`整个页面 · ${document.title.slice(0,80)}`:viewportMode?'当前视口':'框选区域',type:'FRAME',parentId:null,order:0,rect:{x:0,y:0,width:original.width,height:original.height},fidelity:'native',style:{fills:[{kind:'solid',color:background}]},clipsContent:true,layout:{mode:'absolute'}});
      visit(chosen,'n0',original);
    }else visit(chosen, null, original);
    if (!nodes.length) throw new Error('E_SELECTION_EMPTY');
    const styledNodes=mergeTextLines(nodes,textFragments,id=>textWarning('W_TEXT_FRAGMENTED','混合字号的同一行保留为独立可编辑片段，以保持原始位置。',id,'font-size/baseline'));
    const paintedNodes=normalizeStacking(styledNodes,stackingLayers,contentClips,budget,5000,backgroundLayers);
    const outputNodes=rangeMode?pruneScene(paintedNodes,preservedFormContents):paintedNodes;
    const kept=new Set(outputNodes.map(node=>node.id));
    if(rangeMode)warnings.push({code:'I_SELECTION_CLIPPED',severity:'info',message:'外层 Frame 按实际采集边界裁切；边界处的完整文本仍保留在可编辑图层中。'});
    return { url: location.href, title: document.title,
      context: { viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio, zoomFactor: 1, scroll: { x: scrollX, y: scrollY } },
      selection: { mode: fullMode?'full_page':viewportMode?'viewport':rangeMode?'rectangle':'element', sourceNodeIds: rangeMode?[]:[keyOf(chosen)], excludedSourceNodeIds: fullMode||viewportMode?[]:excluded.filter(element=>rangeMode||composedContains(chosen,element)).map(keyOf), originalRect: documentBounds, boundaryPolicy: fullMode||viewportMode?'strict':rangeMode?policy:'complete_elements', contentScope: fullMode?'loaded_content':rangeMode?'visible':'loaded_content' },
      requestedRect:requested,layoutStamp:{revision,scrollX,scrollY,width:innerWidth,height:innerHeight,...(fullMode?{contentRevision,documentHeight:documentHeight(),documentWidth:documentWidth()}:{})},
      nodes:outputNodes,flexCandidates:flexCandidates.filter(c=>kept.has(c.id)),warnings:warnings.filter(w=>!w.nodeId||kept.has(w.nodeId)),images:images.filter(image=>kept.has(image.nodeId)) };
  }
  function fullInfo():PageInfo{
    for(const [element,text] of rowSamples)if(!element.isConnected||element.textContent?.trim().slice(0,160)!==text)virtualized=true;
    for(const element of document.querySelectorAll('li,article,[role="row"],[data-index],[data-virtual-index]')){if(rowSamples.size>=500)break;const box=element.getBoundingClientRect();if(box.bottom>0&&box.top<innerHeight&&element.textContent?.trim()&&!rowSamples.has(element))rowSamples.set(element,element.textContent.trim().slice(0,160));}
    return {x:scrollX,y:scrollY,width:document.documentElement.clientWidth,viewportHeight:document.documentElement.clientHeight,height:documentHeight(),revision:contentRevision,virtualized,cancelled:fullCancelled};
  }
  async function fullScroll(y:number):Promise<PageInfo>{
    if(!Number.isFinite(y)||y<0||y>30000)throw Error('E_LIMIT_EXCEEDED: 无效滚动位置');
    scrollTo({left:0,top:y,behavior:'instant'});let previous=fullInfo(),stable=0;const started=performance.now();
    do{await new Promise(resolve=>setTimeout(resolve,100));const current=fullInfo();if(current.cancelled)throw Error('E_CANCELLED: 全页采集已取消');stable=current.height===previous.height&&current.revision===previous.revision?stable+1:0;previous=current;}while(stable<3&&performance.now()-started<900);
    return {...previous,settled:stable>=3};
  }
  function unlockFull(){fullLocked=false;fullOriginal=undefined;rowSamples.clear();host.style.pointerEvents='none';host.style.cursor='';host.style.visibility='visible';refreshOutlines();}
  async function fullRestore(x:number,y:number){try{scrollTo({left:x,top:y,behavior:'instant'});await new Promise(resolve=>setTimeout(resolve,100));return Math.abs(scrollX-x)<2&&Math.abs(scrollY-y)<2;}finally{fullCancelled=false;unlockFull();}}
  scope.__w2pProbe = {
    freezeAnimations,restoreAnimations,
    fullBegin(){disable();fullOriginal={x:scrollX,y:scrollY};fullLocked=true;fullCancelled=false;virtualized=false;rowSamples.clear();host.style.pointerEvents='auto';host.style.cursor='progress';host.style.visibility='hidden';return fullInfo();},
    fullScroll,fullInfo,
    fullRestore,
    fullCleanup(){return fullLocked&&fullOriginal?fullRestore(fullOriginal.x,fullOriginal.y):Promise.resolve(true);},
    enable(value = 'element', boundary = 'strict',append=false) { disable();mode = value;policy=boundary;multiple=append;enabled = true;
      if(mode==='rectangle'){items=[];excluded=[];selected=null;selectedRect=null;host.style.pointerEvents='auto';host.style.cursor='crosshair';host.style.touchAction='none';}
      else if(mode!=='exclude'){selectedRect=null;if(!append){items=[];excluded=[];selected=null;}}
      revision++;refreshOutlines();
    }, disable,
    reset() {restoreAnimations(); disable();if(fullLocked){fullCancelled=true;unlockFull();}selected = null;selectedRect=null;items=[];excluded=[];revision++;refreshOutlines(); },
    edit(action,key){
      if(action==='clear'){disable();items=[];excluded=[];selectedRect=null;}
      else if(action==='single'){disable();multiple=false;}
      else if(action==='remove')items=items.filter(element=>keyOf(element)!==key);
      else if(action==='restore')excluded=excluded.filter(element=>keyOf(element)!==key);
      else throw Error('无效选择操作');
      selected=items.at(-1)??null;cleanExclusions();revision++;border.style.display='none';refreshOutlines();
    },
    boundary(value) { policy=value;revision++; },
    hideOverlay(hidden) {host.style.visibility=hidden?'hidden':'visible';},
    // A full-page scene is immutable after the synchronous DOM read. Later
    // content changes invalidate new references, not the already-read scene.
    // Selection and viewport changes still invalidate the capture itself.
    layoutMatches(stamp,checkContent=true) { return !!stamp&&stamp.revision===revision&&stamp.width===innerWidth&&stamp.height===innerHeight&&(stamp.documentHeight!==undefined?(!checkContent||stamp.documentHeight===documentHeight()&&(stamp.documentWidth===undefined||stamp.documentWidth===documentWidth())&&stamp.contentRevision===contentRevision):stamp.scrollX===scrollX&&stamp.scrollY===scrollY); },
    parent() { if (!selected?.isConnected || !composedParent(selected) || selected === document.body) throw new Error('请先点选元素，矩形不能切换父级'); const parent=composedParent(selected)!;items=items.filter(item=>item!==selected&&!composedContains(parent,item));if(!items.some(item=>composedContains(item,parent)))items.push(parent);selected=parent;cleanExclusions();revision++;refreshOutlines();highlight(selected);return describe(selected); },
    capture,
    async captureBatch(kind='selection',height){
      if(kind==='full_page')return [await capture(kind,undefined,height)];
      if(kind==='viewport'||selectedRect)return [await capture(kind)];
      if(!items.length)throw Error('E_SELECTION_REQUIRED: 请先选择内容');
      if(items.some(element=>!element.isConnected))throw Error('E_SELECTION_STALE: 部分区块已失效，请移除或重新选择');
      const roots=items.filter(child=>!items.some(parent=>parent!==child&&composedContains(parent,child)));
      if(roots.length!==items.length){items=roots;selected=items.at(-1)??null;revision++;refreshOutlines();}
      const chosen=[...roots].sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);const captures:DomCapture[]=[];
      const stamp=revision;
      for(const element of chosen){if(revision!==stamp)throw Error('E_SELECTION_STALE');captures.push(await capture('selection',element));}
      return captures;
    },
    read() { const item=(element:Element)=>({key:keyOf(element),tag:element.tagName.toLowerCase(),id:element.id,text:(element.getAttribute('aria-label')??element.querySelector('h1,h2,h3')?.textContent??element.textContent??'').trim().slice(0,80),rect:describe(element).documentRect,stale:!element.isConnected});return { enabled, note, selected: selectedRect?{kind:'rectangle',rect:selectedRect,boundaryPolicy:policy}:selected?.isConnected ? describe(selected) : null,selectionState:{items:items.map(item),excluded:excluded.map(item),multiple,mode} }; },
    snapshot() {
      if (selected && !selected.isConnected) throw new Error('E_SELECTION_STALE');
      const element = selected ?? document.body;
      return { kind: 'dom_probe', conversionImplemented: false, title: document.title, viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, selection: describe(element), descendants: Array.from(element.querySelectorAll('*')).filter(e => e !== host && !['SCRIPT', 'STYLE'].includes(e.tagName)).slice(0, 200).map(describe) };
    }
  };
})();
