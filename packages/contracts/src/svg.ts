// Restricted, self-contained SVG profile shared by capture, file validation and
// the plugin. No DOM, fetch, CSS engine or entity expansion is used here.
export const SVG_LIMITS = { bytes: 256 * 1024, elements: 500, depth: 32, totalElements: 5000 };
const tags = new Set('svg g defs symbol use path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath title desc'.split(' '));
const attributes = new Set(('id xmlns xmlns:xlink viewBox preserveAspectRatio width height x y x1 y1 x2 y2 cx cy r rx ry d points transform fill stroke color opacity fill-opacity stroke-opacity fill-rule clip-rule stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset clip-path clipPathUnits gradientUnits gradientTransform spreadMethod offset stop-color stop-opacity fx fy fr href xlink:href display visibility overflow').split(' '));
export const SVG_PAINT_PROPERTIES = 'fill stroke color fill-opacity stroke-opacity fill-rule clip-rule stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity display visibility clip-path stop-color stop-opacity'.split(' ');
type Element = { tag: string; attrs: Record<string,string>; children: Element[] };
const escape = (value: string) => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function fail(detail: string): never { throw Error('E_SVG_UNSUPPORTED: '+detail); }
function decode(value: string): string {
  const decoded=value.replace(/&([^;]*);/g,(_all,entity:string)=>{
    const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(entity in named)return named[entity];
    const n=/^#x[\da-f]+$/i.test(entity)?parseInt(entity.slice(2),16):/^#\d+$/.test(entity)?Number(entity.slice(1)):NaN;
    if(!Number.isInteger(n)||n<32||n>0x10ffff||n>=0xd800&&n<=0xdfff)fail('entity');return String.fromCodePoint(n);
  });
  if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoded))fail('invalid XML character');
  return decoded;
}
function parse(source: string): Element {
  if(source.length>SVG_LIMITS.bytes||new TextEncoderFallback().length(source)>SVG_LIMITS.bytes)fail('byte budget');
  source=source.replace(/^\uFEFF/,'').replace(/^\s*<\?xml\s[^?]*\?>/,'').replace(/<!--[\s\S]*?-->/g,'');
  const stack:Element[]=[],roots:Element[]=[];let at=0,count=0;
  while(at<source.length){
    const next=source.indexOf('<',at),text=source.slice(at,next<0?source.length:next);
    if(text.trim()&& !['title','desc'].includes(stack[stack.length-1]?.tag??''))fail('text requires a separate text capture');
    if(next<0)break;
    const token=source.slice(next).match(/^<\s*(\/?)\s*([A-Za-z][\w:-]*)([^<>]*?)>/);
    if(!token)fail('XML markup');at=next+token[0].length;
    const [,closing,tag,body]=token;
    if(!tags.has(tag))fail('element '+tag);
    if(closing){if(body.trim()||stack.pop()?.tag!==tag)fail('unbalanced XML');continue;}
    if(++count>SVG_LIMITS.elements||stack.length>=SVG_LIMITS.depth)fail('element/depth budget');
    const attrs:Record<string,string>={},seen=new Set<string>(),styles:Record<string,string>={},selfClosing=/\/\s*$/.test(body);let rest=body.replace(/\/\s*$/,'');
    while(rest.trim()){
      const attr=rest.match(/^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/);if(!attr)fail('XML attribute');
      const name=attr[1],value=decode(attr[2]??attr[3]);rest=rest.slice(attr[0].length);
      if(seen.has(name))fail('duplicate attribute');seen.add(name);
      if(name==='style'){
        for(const declaration of value.split(';').filter(v=>v.trim())){const colon=declaration.indexOf(':');if(colon<1)fail('style');const property=declaration.slice(0,colon).trim();if(!SVG_PAINT_PROPERTIES.includes(property)&&property!=='transform')fail('style '+property);styles[property]=declaration.slice(colon+1).trim();}
      }else if(attributes.has(name))attrs[name]=value;
      else if(!['class','role','focusable','version'].includes(name)&&!name.startsWith('aria-')&&!name.startsWith('data-'))fail('attribute '+name);
    }
    Object.assign(attrs,styles);
    if(attrs.xmlns&&attrs.xmlns!=='http://www.w3.org/2000/svg'||attrs['xmlns:xlink']&&attrs['xmlns:xlink']!=='http://www.w3.org/1999/xlink')fail('namespace');
    const element={tag,attrs,children:[]} as Element;
    if(stack.length)stack[stack.length-1].children.push(element);else roots.push(element);
    if(!selfClosing)stack.push(element);
  }
  if(stack.length||roots.length!==1||roots[0].tag!=='svg')fail('SVG root');return roots[0];
}
// Figma's plugin sandbox has no TextEncoder.
class TextEncoderFallback { length(value:string){return value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'xxxx').replace(/[\u0080-\u07ff]/g,'xx').replace(/[^\x00-\x7f]/g,'xxx').length;} }
const number=(value:string|undefined,fallback:number):number=>{if(value===undefined)return fallback;if(!/^\s*[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:px)?\s*$/i.test(value))return fail('length '+value);const n=parseFloat(value);if(!Number.isFinite(n)||Math.abs(n)>100000)fail('length range');return n;};
export interface NormalizedSvg { svg:string; width:number; height:number; elements:number }
export function normalizeSvg(source:string, viewport?:{width:number;height:number}):NormalizedSvg {
  const root=parse(source),ids=new Map<string,Element>();
  const scan=(e:Element)=>{if(e.attrs.id){if(!/^[A-Za-z_][\w.:-]*$/.test(e.attrs.id)||ids.has(e.attrs.id))fail('duplicate/invalid ID');ids.set(e.attrs.id,e);}e.children.forEach(scan);};scan(root);
  let viewBox:number[]|undefined;
  if(root.attrs.viewBox){viewBox=root.attrs.viewBox.trim().split(/[\s,]+/).map(Number);if(viewBox.length!==4||viewBox.some(n=>!Number.isFinite(n)||Math.abs(n)>100000)||viewBox[2]<=0||viewBox[3]<=0)fail('viewBox');}
  const width=viewport?.width??number(root.attrs.width,viewBox?.[2]??300),height=viewport?.height??number(root.attrs.height,viewBox?.[3]??150);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>100000||height>100000)fail('viewport');
  root.attrs.width=String(width);root.attrs.height=String(height);root.attrs.xmlns='http://www.w3.org/2000/svg';delete root.attrs['xmlns:xlink'];
  let elements=0,instance=0;
  function render(e:Element,chain:Set<Element>,inheritedColor='black',insideDefs=false):string {
    if(chain.has(e)||chain.size>=SVG_LIMITS.depth)fail('cyclic/deep reference');
    if(++elements>SVG_LIMITS.elements)fail('expanded element budget');
    const path=new Set(chain);path.add(e);
    if(e.tag==='title'||e.tag==='desc')return '';
    const attrs={...e.attrs},color=attrs.color==='currentColor'?inheritedColor:attrs.color??inheritedColor;
    if(attrs['xlink:href']&&!attrs.href)attrs.href=attrs['xlink:href'];delete attrs['xlink:href'];
    delete attrs['xmlns:xlink'];
    const references:Element[]=[];
    for(const [name,value]of Object.entries(attrs)){
      if(/[<>]|[\u0000-\u001f]|[\\]/.test(value))fail('attribute value');
      if(/(?:var|env|calc|expression)\s*\(|!important|@|(?:https?|data|javascript):/i.test(value)&&name!=='xmlns')fail('dynamic/external value');
      if(name==='href'||name==='xlink:href'){
        if(!/^#[A-Za-z_][\w.:-]*$/.test(value)||!ids.has(value.slice(1)))fail('external/missing reference');references.push(ids.get(value.slice(1))!);
      }else if(/url\s*\(/i.test(value)){
        const ref=value.match(/^url\(\s*["']?#([A-Za-z_][\w.:-]*)["']?\s*\)$/);if(!ref||!ids.has(ref[1]))fail('external/missing paint');
        const target=ids.get(ref[1])!;if(!['linearGradient','radialGradient','clipPath'].includes(target.tag))fail('paint target');
        attrs[name]=`url(#${ref[1]})`;references.push(target);
      }
      if(/currentColor/i.test(value))attrs[name]=value.replace(/currentColor/gi,color);
    }
    // Validate reference graphs even for definitions not visited through <use>.
    for(const reference of references)if(e.tag!=='use')render(reference,path,color,true);
    if(e.tag==='use'){
      const href=attrs.href,target=href?ids.get(href.slice(1)):undefined;if(!target)fail('use reference');
      if(!['symbol','g','path','rect','circle','ellipse','line','polyline','polygon','svg'].includes(target.tag))fail('use target');
      const x=number(attrs.x,0),y=number(attrs.y,0);delete attrs.href;delete attrs['xlink:href'];delete attrs.x;delete attrs.y;
      const prefix=`instance${++instance}-`,localIds=new Map<string,string>();
      const collect=(part:Element)=>{if(part.attrs.id)localIds.set(part.attrs.id,prefix+part.attrs.id);part.children.forEach(collect);};collect(target);
      const clone=(part:Element):Element=>{const copy={tag:part.tag,attrs:{...part.attrs},children:part.children.map(clone)};for(const [key,value]of Object.entries(copy.attrs)){if(key==='id')copy.attrs[key]=localIds.get(value)!;else if((key==='href'||key==='xlink:href')&&localIds.has(value.slice(1)))copy.attrs[key]='#'+localIds.get(value.slice(1));else copy.attrs[key]=value.replace(/url\(\s*["']?#([\w.:-]+)["']?\s*\)/g,(all,id)=>localIds.has(id)?`url(#${localIds.get(id)})`:all);}if(copy.attrs.id)ids.set(copy.attrs.id,copy);return copy;};
      const copied=clone(target);
      const child=target.tag==='symbol'?{tag:'svg',attrs:{...copied.attrs,x:'0',y:'0',width:attrs.width??target.attrs.width??String(width),height:attrs.height??target.attrs.height??String(height)},children:copied.children}:copied;
      delete attrs.width;delete attrs.height;attrs.transform=[attrs.transform,`translate(${x} ${y})`].filter(Boolean).join(' ');
      return `<g${serialize(attrs)}>${render(child,path,color,insideDefs)}</g>`;
    }
    if(e.tag==='symbol')return ''; // Expanded at its use site; never paint the source definition.
    if((attrs.href||attrs['xlink:href'])&&!['linearGradient','radialGradient'].includes(e.tag))fail('unexpected reference');
    delete attrs['xmlns:xlink'];
    if(attrs['xlink:href']){attrs.href=attrs['xlink:href'];delete attrs['xlink:href'];}
    return `<${e.tag}${serialize(attrs)}>${e.children.map(child=>render(child,path,color,insideDefs||e.tag==='defs')).join('')}</${e.tag}>`;
  }
  const svg=render(root,new Set());if(new TextEncoderFallback().length(svg)>SVG_LIMITS.bytes)fail('expanded byte budget');
  return {svg,width,height,elements};
}
function serialize(attrs:Record<string,string>):string {return Object.entries(attrs).map(([name,value])=>` ${name}="${escape(value)}"`).join('');}
export function svgForSize(source:string,width:number,height:number):string {
  const normalized=normalizeSvg(source);
  if(width===normalized.width&&height===normalized.height)return normalized.svg;
  return normalizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${normalized.width} ${normalized.height}" preserveAspectRatio="none">${normalized.svg}</svg>`).svg;
}
export function svgForImageSize(source:string,width:number,height:number):string {
  const normalized=normalizeSvg(source);
  // An explicit viewBox participates in SVG image viewport negotiation. Without
  // one, explicit intrinsic dimensions establish the original coordinate space.
  return /^<svg\b[^>]*\bviewBox=/.test(normalized.svg)?normalizeSvg(normalized.svg,{width,height}).svg:svgForSize(normalized.svg,width,height);
}
