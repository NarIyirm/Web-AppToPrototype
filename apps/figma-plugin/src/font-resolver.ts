import type { Font } from '../../../packages/contracts/src/index';
export interface AvailableFont { family: string; style: string }
const generic:Record<string,string[]>={
  'sans-serif':['Segoe UI','SF Pro Text','Helvetica Neue','Arial','Inter','PingFang SC','Microsoft YaHei'], 'system-ui':['Segoe UI','SF Pro Text','Helvetica Neue','Arial','Inter','PingFang SC','Microsoft YaHei'],
  '-apple-system':['SF Pro Text','SF Pro Display','Helvetica Neue','PingFang SC','Arial','Inter'],
  blinkmacsystemfont:['SF Pro Text','SF Pro Display','Helvetica Neue','PingFang SC','Arial','Inter'],
  serif:['Times New Roman','Times','Georgia'],monospace:['Consolas','SF Mono','Menlo','Monaco','Courier New'],emoji:['Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji']
};
function styleWeight(style:string){
  const value=style.toLowerCase().replace(/[ -]/g,'');
  if(/thin/.test(value))return 100;if(/extralight|ultralight/.test(value))return 200;if(/light/.test(value))return 300;
  if(/extrabold|ultrabold/.test(value))return 800;if(/semibold|demibold/.test(value))return 600;if(/black|heavy/.test(value))return 900;if(/bold/.test(value))return 700;if(/medium/.test(value))return 500;return 400;
}
export function resolveFont(font:Font,available:AvailableFont[]):{font:AvailableFont;reason:string}{
  const names=[font.family,...font.fallbacks??[]];
  const candidates=names.flatMap(name=>generic[name.toLowerCase()]??[name]);
  for(const family of candidates){
    const matches=available.filter(f=>f.family.toLowerCase()===family.toLowerCase());
    if(!matches.length)continue;
    const exact=matches.find(f=>f.style.toLowerCase()===font.style.toLowerCase());
    const italic=/italic|oblique/i.test(font.style);
    const ranked=[...matches].sort((a,b)=>{
      const score=(f:AvailableFont)=>Math.abs(styleWeight(f.style)-font.weight)+(/italic|oblique/i.test(f.style)===italic?0:1000);
      return score(a)-score(b)||a.style.localeCompare(b.style);
    });
    return {font:exact??ranked[0],reason:family.toLowerCase()===font.family.toLowerCase()?(exact?'exact':'nearest-style'):'css-fallback'};
  }
  for(const family of ['Microsoft YaHei','PingFang SC','Arial','Inter']){
    const found=available.find(f=>f.family===family&&f.style==='Regular');if(found)return {font:found,reason:'fallback-default'};
  }
  if(!available.length)throw Error('没有可用字体');
  const first=[...available].sort((a,b)=>(a.family+'/'+a.style).localeCompare(b.family+'/'+b.style))[0];
  return {font:first,reason:'fallback-default'};
}
