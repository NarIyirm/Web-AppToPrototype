import { normalizeSvg, SVG_PAINT_PROPERTIES, type NormalizedSvg } from '../../../packages/contracts/src/svg';

// Read computed presentation values into a detached serialization. Nothing is
// inserted into, restyled in, or removed from the source document.
export function snapshotSvg(root: SVGSVGElement, width:number, height:number, checkpoint:()=>void, excluded:Element[]=[]):NormalizedSvg {
  const ns='http://www.w3.org/2000/svg',doc=document.implementation.createDocument(ns,'svg');
  const destination=doc.documentElement;let count=0;
  const localUrl=(value:string)=>value.replace(/url\(["']?([^"')]+)["']?\)/g,(_all,url:string)=>{
    const parsed=new URL(url,document.baseURI),current=new URL(document.URL);current.hash='';
    const fragment=parsed.hash;parsed.hash='';return parsed.href===current.href&&fragment?`url(${fragment})`:`url(${url})`;
  });
  function copy(source:Element,target:Element,inDefinition=false){
    if(++count>500)throw Error('E_SVG_UNSUPPORTED: element budget');checkpoint();
    for(const attr of source.attributes){
      if(attr.name.startsWith('on'))throw Error('E_SVG_UNSUPPORTED: event handler');
      if(['style','class'].includes(attr.name))continue;
      target.setAttribute(attr.name,attr.value);
    }
    const css=getComputedStyle(source),definition=inDefinition||['defs','symbol'].includes(source.localName);
    if(css.filter!=='none'||css.maskImage!=='none'||css.mixBlendMode!=='normal'||css.animationName!=='none'||css.getPropertyValue('vector-effect')!=='none'||['marker-start','marker-mid','marker-end'].some(name=>!['','none'].includes(css.getPropertyValue(name)))||!['','normal'].includes(css.getPropertyValue('paint-order')))throw Error('E_SVG_UNSUPPORTED: filter/mask/blend/animation/marker/paint-order/vector-effect');
    for(const property of SVG_PAINT_PROPERTIES){
      const value=css.getPropertyValue(property).trim();
      if(!value)continue;
      // Definition children inherit paint at <use> sites. Only add computed
      // overrides differing from their definition parent, retaining attributes.
      const parentValue=source.parentElement?getComputedStyle(source.parentElement).getPropertyValue(property).trim():'';
      if(definition&&/currentColor/i.test(source.getAttribute(property)??''))continue;
      if(definition&&!['opacity','display','visibility','clip-path'].includes(property)&&value===parentValue)continue;
      if(source===root&&['opacity','display','visibility','clip-path'].includes(property))continue;
      target.setAttribute(property,localUrl(value));
    }
    if(!definition&&source!==root&&css.transform!=='none'){
      const [x,y]=css.transformOrigin.split(' ').map(parseFloat);
      target.setAttribute('transform',`translate(${x||0} ${y||0}) ${css.transform} translate(${-x||0} ${-y||0})`);
    }
    // SVG2 allows CSS geometry. Freeze the common shape geometry in user units.
    if(!definition&&source!==root)for(const name of ['x','y','cx','cy','r','rx','ry','width','height']){
      const value=css.getPropertyValue(name).trim();
      if(value&&value!=='auto'&&/^[-+\d.e]+px$/i.test(value))target.setAttribute(name,value.replace(/px$/,''));
    }
    if(source.localName==='path'&&!definition){
      const d=css.getPropertyValue('d'),path=d.match(/^path\(["']([^"']*)["']\)$/);
      if(path)target.setAttribute('d',path[1]);else if(d==='none')target.removeAttribute('d');else if(d)throw Error('E_SVG_UNSUPPORTED: CSS path geometry');
    }
    for(const child of source.children){
      if(excluded.some(element=>element===child||element.contains(child)))continue;
      const clone=doc.createElementNS(ns,child.localName);target.appendChild(clone);copy(child,clone,definition);
    }
  }
  copy(root,destination);
  // A sprite can live outside this SVG's subtree. Copy just its referenced local
  // definitions; the shared normalizer expands use and detects cycles/budgets.
  const copied=new Set(Array.from(root.querySelectorAll('[id]')).map(e=>e.id));
  const defs=doc.createElementNS(ns,'defs');let iterations=0;
  for(;;){
    let added=false;
    for(const use of Array.from(destination.querySelectorAll('use'))){
      const href=use.getAttribute('href')??use.getAttribute('xlink:href');
      if(!href?.startsWith('#')||copied.has(href.slice(1)))continue;
      if(++iterations>500)throw Error('E_SVG_UNSUPPORTED: reference budget');
      const source=document.getElementById(href.slice(1));if(!source||source.namespaceURI!==ns||excluded.some(e=>e===source||e.contains(source)))throw Error('E_SVG_UNSUPPORTED: missing/excluded use target');
      const clone=doc.createElementNS(ns,source.localName);defs.appendChild(clone);copy(source,clone,true);copied.add(href.slice(1));added=true;
    }
    if(!added)break;if(!defs.parentNode)destination.prepend(defs);
  }
  // CSS opacity/background/border are already represented by the HTML frame.
  destination.removeAttribute('opacity');destination.removeAttribute('style');
  destination.setAttribute('overflow',getComputedStyle(root).overflow);
  destination.setAttribute('width',String(width));destination.setAttribute('height',String(height));
  return normalizeSvg(new XMLSerializer().serializeToString(destination),{width,height});
}
