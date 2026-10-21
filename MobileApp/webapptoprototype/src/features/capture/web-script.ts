export type SelectionMode = 'browse' | 'element' | 'rectangle' | 'exclude';
export type WebCommand = { action?: 'parent' | 'clear' | 'undo' | 'start' | 'step' | 'finish'; multiple?: boolean; x?: number; y?: number };
export function selectionScript(epoch: string, mode: SelectionMode, requestId?: string, command: WebCommand = {}): string {
  if (!/^[a-z0-9_-]{7,100}$/.test(epoch) || (requestId && !/^[a-z0-9_-]{7,100}$/.test(requestId))
    || (command.x !== undefined && (!Number.isFinite(command.x) || command.x < 0 || command.x > 30000))
    || (command.y !== undefined && (!Number.isFinite(command.y) || command.y < 0 || command.y > 30000))) throw new Error('Invalid page identity');
  return `(function(){
var epoch=${JSON.stringify(epoch)},mode=${JSON.stringify(mode)},requestId=${JSON.stringify(requestId ?? null)},command=${JSON.stringify(command)};
var old=window.__w2pCapture;
if(old&&old.epoch!==epoch){if(old.cleanup)old.cleanup();old=null;}
var state=old||{epoch:epoch,items:[],excluded:[],rect:null,overlay:null,history:[],multiple:false};window.__w2pCapture=state;
function post(value){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({epoch:epoch},value)));}
function own(el){return el instanceof Element&&!!el.closest('#w2p-selection-overlay,#w2p-capture-style');}
function restore(){if(state.hidden){state.hidden.forEach(function(v){if(v[1])v[0].style.setProperty('visibility',v[1],v[2]);else v[0].style.removeProperty('visibility');});state.hidden=null;}
if(state.sheet){state.sheet.remove();state.sheet=null;}if(state.origin)scrollTo(state.origin.x,state.origin.y);state.origin=null;state.stickySeen=null;state.capturing=false;}
if(!state.observer){
 state.onChange=function(){if(!state.capturing)post({kind:'capture_changed'});};
 state.observer=new MutationObserver(function(records){if(state.capturing)return;var changed=records.some(function(r){if(own(r.target))return false;
 if(r.type==='childList'){var affected=Array.from(r.addedNodes).concat(Array.from(r.removedNodes));if(affected.length&&affected.every(own))return false;}return true;});if(changed)state.onChange();});
 state.observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
 addEventListener('scroll',state.onChange,true);addEventListener('resize',state.onChange);
 state.cleanup=function(){state.observer.disconnect();removeEventListener('scroll',state.onChange,true);removeEventListener('resize',state.onChange);if(state.overlay)state.overlay.remove();restore();};
}
function clip(r){var x=Math.max(0,r.x),y=Math.max(0,r.y),right=Math.min(innerWidth,r.x+r.width),bottom=Math.min(innerHeight,r.y+r.height);return{x:x,y:y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};}
function rect(el){var r=el.getBoundingClientRect();return clip({x:r.x,y:r.y,width:r.width,height:r.height});}
function remember(){state.history.push({items:state.items.slice(),excluded:state.excluded.slice(),rect:state.rect});if(state.history.length>20)state.history.shift();}
function region(){if(state.rect)return state.rect;var rs=state.items.map(rect).filter(function(r){return r.width>0&&r.height>0;});if(!rs.length)return null;
var x=Math.min.apply(null,rs.map(function(r){return r.x;})),y=Math.min.apply(null,rs.map(function(r){return r.y;}));return{x:x,y:y,width:Math.max.apply(null,rs.map(function(r){return r.x+r.width;}))-x,height:Math.max.apply(null,rs.map(function(r){return r.y+r.height;}))-y};}
function show(){if(state.overlay){state.overlay.replaceChildren();var draw=function(r,excluded){if(r.width<1||r.height<1)return;var box=document.createElement('div');box.style.cssText='position:absolute;pointer-events:none;box-sizing:border-box;border:2px '+(excluded?'dashed #c33232':'solid #0965cb')+';background:'+(excluded?'rgba(195,50,50,.12)':'rgba(9,101,203,.08)')+';left:'+r.x+'px;top:'+r.y+'px;width:'+r.width+'px;height:'+r.height+'px';state.overlay.appendChild(box);};
if(state.rect)draw(state.rect,false);state.items.forEach(function(el){draw(rect(el),false);});state.excluded.forEach(function(el){draw(rect(el),true);});}
post({kind:'selection',rect:region(),count:state.rect?1:state.items.length,excluded:state.excluded.length,canParent:!!state.items.length&&state.items[state.items.length-1].parentElement!==document.documentElement,canExclude:!!state.items.length,canUndo:!!state.history.length});}
if(state.overlay){state.overlay.remove();state.overlay=null;}
if(command.multiple!==undefined)state.multiple=command.multiple;
if(command.action==='clear'){remember();state.items=[];state.excluded=[];state.rect=null;}
if(command.action==='undo'){var prev=state.history.pop();if(prev){state.items=prev.items;state.excluded=prev.excluded;state.rect=prev.rect;}}
if(command.action==='parent'&&state.items.length){var last=state.items[state.items.length-1],parent=last.parentElement;if(parent&&parent!==document.documentElement){remember();state.items[state.items.length-1]=parent;state.items=state.items.filter(function(el,i,all){return all.indexOf(el)===i&&!all.some(function(other){return other!==el&&other.contains(el);});});}}
if(command.action==='finish'){restore();state.items=[];state.excluded=[];state.rect=null;show();return true;}
if(requestId){
 (async function(){try{
 if(window.visualViewport&&Math.abs(window.visualViewport.scale-1)>.01)throw Error('请先恢复网页缩放，再采集。');
 if(command.action==='start'){state.capturing=true;state.origin={x:scrollX,y:scrollY};state.stickySeen=[];state.sheet=document.createElement('style');state.sheet.id='w2p-capture-style';state.sheet.textContent='html{scroll-behavior:auto!important;scroll-snap-type:none!important}*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';document.documentElement.appendChild(state.sheet);}
 if(command.action==='step'&&!state.capturing)throw Error('长页采集已结束，请重新开始。');
 if(state.capturing){if(command.action==='step'){state.hidden=state.hidden||[];Array.from(document.querySelectorAll('body *')).slice(0,10000).forEach(function(el){var s=getComputedStyle(el);if((s.position==='fixed'||(s.position==='sticky'&&state.stickySeen.indexOf(el)>=0))&&!state.hidden.some(function(v){return v[0]===el;})){state.hidden.push([el,el.style.getPropertyValue('visibility'),el.style.getPropertyPriority('visibility')]);el.style.setProperty('visibility','hidden','important');}});}
 scrollTo(command.x||0,command.y||0);await new Promise(function(resolve){setTimeout(resolve,350);});}
 await new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});
 var area=state.capturing||mode==='browse'?{x:0,y:0,width:innerWidth,height:innerHeight}:region();
 if(!area||area.width<1||area.height<1)throw Error('请先选择有效范围。');
 var nodes=[],warnings=[],units=0,rasters=[];
 if(state.excluded.length)warnings.push('排除内容不生成图层，源画面对照仍保留原网页。');
 function bounds(r,element){var clipLeft=area.x,clipTop=area.y,clipRight=area.x+area.width,clipBottom=area.y+area.height;for(var parent=element.parentElement;parent&&parent!==document.documentElement;parent=parent.parentElement){var ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();if(['hidden','clip','scroll','auto'].indexOf(ps.overflowX)>=0){clipLeft=Math.max(clipLeft,pr.left+parent.clientLeft);clipRight=Math.min(clipRight,pr.left+parent.clientLeft+parent.clientWidth);}if(['hidden','clip','scroll','auto'].indexOf(ps.overflowY)>=0){clipTop=Math.max(clipTop,pr.top+parent.clientTop);clipBottom=Math.min(clipBottom,pr.top+parent.clientTop+parent.clientHeight);}}var left=Math.max(clipLeft,r.left),top=Math.max(clipTop,r.top),right=Math.min(clipRight,r.right),bottom=Math.min(clipBottom,r.bottom);return right>left&&bottom>top?{x:left-area.x,y:top-area.y,width:right-left,height:bottom-top}:null;}
 function add(n){if(nodes.length<2000)nodes.push(Object.assign({id:'node-'+nodes.length},n));}
 var elements=document.querySelectorAll('body,body *');if(elements.length>10000)warnings.push('页面元素超过扫描预算，只读取前 10000 个。');
 for(var i=0;i<Math.min(elements.length,10000)&&nodes.length<2000;i++){
 var el=elements[i];if(own(el)||['SCRIPT','STYLE','NOSCRIPT'].indexOf(el.tagName)>=0||rasters.some(function(p){return p.contains(el);}))continue;
 if(!state.capturing&&mode!=='browse'&&state.items.length&&!state.items.some(function(p){return p===el||p.contains(el);}))continue;
 if(!state.capturing&&mode!=='browse'&&state.excluded.some(function(p){return p===el||p.contains(el);}))continue;
 var style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)continue;
 var r=el.getBoundingClientRect(),b=bounds(r,el);if(!b)continue;if(state.capturing&&style.position==='sticky'&&state.stickySeen.indexOf(el)<0)state.stickySeen.push(el);
 var complex=style.backgroundImage!=='none'||style.transform!=='none'||style.filter!=='none'||Number(style.opacity)<1||style.boxShadow!=='none';
 var media=['IMG','CANVAS','SVG','VIDEO','IFRAME','INPUT','TEXTAREA','SELECT'].indexOf(el.tagName)>=0;
 if(complex||media){if(!state.excluded.some(function(p){return el.contains(p);})){add({kind:'image',bounds:b});rasters.push(el);if(complex)warnings.push('渐变、变换、阴影或透明叠层保留为图片区域。');continue;}warnings.push('含排除项的复杂区域只转换基础样式。');}
 if(style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent')add({kind:'shape',bounds:b,background:style.backgroundColor,radius:Math.max(0,Math.min(30000,parseFloat(style.borderRadius)||0))});
 for(var j=0;j<el.childNodes.length&&nodes.length<2000;j++){var child=el.childNodes[j];if(child.nodeType!==3||!child.textContent.trim())continue;
 var range=document.createRange();range.selectNodeContents(child);var tr=range.getBoundingClientRect(),tb=bounds(tr,el);if(!tb)continue;
 if(tr.left<area.x-.5||tr.top<area.y-.5||tr.right>area.x+area.width+.5||tr.bottom>area.y+area.height+.5||Math.abs(tb.width-tr.width)>.5||Math.abs(tb.height-tr.height)>.5){add({kind:'image',bounds:tb});warnings.push('被裁切的文字保留为图片。');continue;}
 var text=child.textContent.trim().slice(0,10000);units+=text.length;if(units>500000)break;
 add({kind:'text',bounds:tb,text:text,color:style.color,fontSize:Math.max(1,Math.min(1000,parseFloat(style.fontSize)||16)),fontFamily:style.fontFamily.slice(0,200),fontWeight:Math.max(1,Math.min(1000,parseInt(style.fontWeight)||400)),lineHeight:Math.max(1,Math.min(30000,parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.2)),textAlign:['center','right','justify'].indexOf(style.textAlign)>=0?style.textAlign:'left'});
 }
 }
 if(nodes.length>=2000)warnings.push('已达到 2000 个图层的单段预算，部分内容未转换。');
 var reply={kind:'web_capture',epoch:epoch,requestId:requestId,title:document.title.slice(0,80),viewport:{width:innerWidth,height:innerHeight},selection:area,nodes:nodes,warnings:Array.from(new Set(warnings)).slice(0,30),page:{x:scrollX,y:scrollY,height:Math.min(30000,Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)),width:Math.min(30000,Math.max(document.documentElement.scrollWidth,innerWidth))}};
 if(JSON.stringify(reply).length>1024*1024)throw Error('网页内容过多，请缩小选区。');post(reply);
 }catch(error){post({kind:'capture_error',epoch:epoch,requestId:requestId,message:String(error.message).slice(0,300)});}})();return true;
}
if(mode!=='browse'){
 var overlay=document.createElement('div');overlay.id='w2p-selection-overlay';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;touch-action:none;background:transparent';document.documentElement.appendChild(overlay);state.overlay=overlay;
 var start=null,moved=false;
 function hit(x,y){overlay.style.pointerEvents='none';var el=document.elementFromPoint(x,y);overlay.style.pointerEvents='auto';return el;}
 overlay.addEventListener('touchstart',function(event){event.preventDefault();if(event.touches.length!==1){start=null;return;}var p=event.touches[0];start={x:p.clientX,y:p.clientY};moved=false;if(mode==='rectangle')remember();},{passive:false});
 overlay.addEventListener('touchmove',function(event){event.preventDefault();if(!start)return;var p=event.touches[0];moved=Math.abs(start.x-p.clientX)+Math.abs(start.y-p.clientY)>10;if(mode==='rectangle'){state.items=[];state.excluded=[];state.rect=clip({x:Math.min(start.x,p.clientX),y:Math.min(start.y,p.clientY),width:Math.abs(start.x-p.clientX),height:Math.abs(start.y-p.clientY)});show();}},{passive:false});
 overlay.addEventListener('touchend',function(event){event.preventDefault();if(start&&!moved&&mode!=='rectangle'){var el=hit(start.x,start.y);if(el&&el!==document.documentElement){
 if(mode==='exclude'){if(state.items.some(function(p){return p!==el&&p.contains(el);})){remember();var at=state.excluded.indexOf(el);if(at>=0)state.excluded.splice(at,1);else if(state.excluded.length<20)state.excluded.push(el);}}
 else{remember();state.rect=null;var at=state.items.indexOf(el);if(at>=0)state.items.splice(at,1);else if(!state.multiple)state.items=[el];else if(state.items.length<20){state.items=state.items.filter(function(p){return !el.contains(p);});if(!state.items.some(function(p){return p.contains(el);}))state.items.push(el);}state.excluded=state.excluded.filter(function(p){return state.items.some(function(item){return item.contains(p);});});}
 }}start=null;show();},{passive:false});
 overlay.addEventListener('touchcancel',function(){start=null;});
}
show();return true;
})();true;`;
}
