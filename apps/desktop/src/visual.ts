import type { Color, Fill, Rect } from '../../../packages/contracts/src/index';

/** Split CSS lists without treating commas/spaces inside functions or strings as separators. */
export function cssList(value: string, separator = ','): string[] {
  const parts: string[] = []; let start = 0, depth = 0, quote = '', escaped = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth++; else if (char === ')') depth--;
    else if (!depth && (separator === ' ' ? /\s/.test(char) : char === separator)) {
      if (value.slice(start, i).trim()) parts.push(value.slice(start, i).trim()); start = i + 1;
    }
  }
  if (value.slice(start).trim()) parts.push(value.slice(start).trim());
  return parts;
}
type Length = { percent: number; pixels: number };
function length(value: string): Length {
  if (value === '0') return { percent: 0, pixels: 0 };
  if (/^-?(?:\d*\.)?\d+(?:px|%)$/.test(value)) return { percent: value.endsWith('%') ? parseFloat(value) / 100 : 0, pixels: value.endsWith('px') ? parseFloat(value) : 0 };
  // Chromium serializes edge-offset positions as calc(100% - 12px).
  const calc = value.match(/^calc\((-?[\d.]+)%\s*([+-])\s*([\d.]+)px\)$/);
  if (calc) return { percent: +calc[1] / 100, pixels: +calc[3] * (calc[2] === '-' ? -1 : 1) };
  throw Error('不支持的长度表达式');
}
export function position(value: string, freeWidth: number, freeHeight: number): { x: number; y: number } {
  let tokens = cssList(value, ' ');
  const keyword = (v: string) => ({ left:'0%', top:'0%', center:'50%', right:'100%', bottom:'100%' }[v] ?? v);
  if (tokens.length === 1) tokens = /^(top|bottom)$/.test(tokens[0]) ? ['50%', tokens[0]] : [tokens[0], '50%'];
  if (tokens.length === 2 && (/^(top|bottom)$/.test(tokens[0]) || /^(left|right)$/.test(tokens[1]))) tokens.reverse();
  if (tokens.length !== 2) throw Error('不支持的定位表达式');
  const [x,y] = tokens.map(v => length(keyword(v)));
  return { x: freeWidth * x.percent + x.pixels, y: freeHeight * y.percent + y.pixels };
}
export interface ImageLayout {
  area: Rect; fit?: string; size?: string; position: string; natural?: { width: number; height: number }; repeat?: string;
}
export function imageRect(layout: ImageLayout, intrinsic: { width: number; height: number }): Rect {
  const { area } = layout; const natural = layout.natural ?? intrinsic;
  let width = natural.width, height = natural.height;
  const size = layout.size ?? layout.fit ?? 'fill';
  if (size === 'cover' || size === 'contain' || size === 'scale-down') {
    const scale = size === 'cover' ? Math.max(area.width / width, area.height / height) : Math.min(area.width / width, area.height / height, size === 'scale-down' ? 1 : Infinity);
    width *= scale; height *= scale;
  } else if (size === 'fill') { width = area.width; height = area.height; }
  else if (size !== 'none' && size !== 'auto' && size !== 'auto auto') {
    const tokens = cssList(size, ' '); if (tokens.length > 2) throw Error('不支持的背景尺寸');
    const resolve = (v: string, extent: number) => { const n = length(v); return n.pixels + n.percent * extent; };
    const a = tokens[0], b = tokens[1] ?? 'auto';
    if (a !== 'auto') width = resolve(a, area.width);
    if (b !== 'auto') height = resolve(b, area.height);
    if (a === 'auto' && b !== 'auto') width = height * natural.width / natural.height;
    if (b === 'auto' && a !== 'auto') height = width * natural.height / natural.width;
  }
  if (!(width > 0 && height > 0) || width > 100000 || height > 100000) throw Error('图片显示尺寸无效或超限');
  const offset = position(layout.position, area.width - width, area.height - height);
  const x=area.x+offset.x,y=area.y+offset.y;
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1000000||Math.abs(y)>1000000)throw Error('图片定位超限');
  return { x, y, width, height };
}

/** CSS angle: 0 points up, 90 right; length includes the rectangular magic corners. */
export function gradientGeometry(angle: number, width: number, height: number) {
  const radians = angle * Math.PI / 180, dx = Math.sin(radians), dy = -Math.cos(radians);
  return { dx, dy, length: Math.abs(width * dx) + Math.abs(height * dy) };
}
export function linearGradient(value: string, width: number, height: number, parseColor: (value: string) => Color, validColor: (value: string) => boolean): Fill {
  if (!value.startsWith('linear-gradient(') || !value.endsWith(')')) throw Error('仅支持单层 linear-gradient');
  const args = cssList(value.slice(16,-1)); let angle = 180;
  const direction = args[0];
  const match = direction.match(/^(-?[\d.]+)(deg|turn|rad|grad)$/);
  if (match) { angle = +match[1] * ({ deg:1, turn:360, rad:180/Math.PI, grad:.9 }[match[2]]!); args.shift(); }
  else if (direction.startsWith('to ')) {
    const words = direction.slice(3).split(/\s+/), horizontal = words.includes('right') ? 1 : words.includes('left') ? -1 : 0, vertical = words.includes('bottom') ? 1 : words.includes('top') ? -1 : 0;
    if (!words.every(w => ['left','right','top','bottom'].includes(w)) || !horizontal && !vertical || words.length > 2 || words.includes('left') && words.includes('right') || words.includes('top') && words.includes('bottom')) throw Error('不支持的渐变方向');
    angle = Math.atan2(horizontal * (vertical ? height : 1), -vertical * (horizontal ? width : 1)) * 180 / Math.PI; args.shift();
  }
  const axis = gradientGeometry(angle, width, height);
  const stops: Array<{ position?: number; color: Color }> = [];
  for (const arg of args) {
    const tokens = cssList(arg, ' '); const color = tokens.shift()!;
    if (!validColor(color) || /^(?:color|oklab|oklch|lab|lch|light-dark)\(/i.test(color) || tokens.length > 2) throw Error('不支持的色标、插值空间或过渡提示');
    const parsed = parseColor(color);
    if (!tokens.length) stops.push({ color: parsed });
    else for (const token of tokens) { const n = length(token); stops.push({ color: parsed, position: n.percent + n.pixels / axis.length }); }
  }
  if (stops.length < 2 || stops.length > 32) throw Error('渐变需 2–32 个色标');
  stops[0].position ??= 0; stops[stops.length-1].position ??= 1;
  let previous = stops[0].position;
  for (const stop of stops) if (stop.position !== undefined) { stop.position = Math.max(previous, stop.position); previous = stop.position; }
  for (let i = 1; i < stops.length; i++) if (stops[i].position === undefined) {
    let end = i + 1; while (stops[end].position === undefined) end++;
    const start = stops[i-1].position!, span = stops[end].position! - start;
    for (let j = i; j < end; j++) stops[j].position = start + span * (j-i+1)/(end-i+1);
    i = end;
  }
  // Out-of-range stops require color-space-aware edge interpolation, kept explicit for a later batch.
  if (stops.some(s => s.position! < 0 || s.position! > 1)) throw Error('暂不支持超出 0–100% 的色标');
  return { kind:'linear_gradient', angle:((angle%360)+360)%360, stops:stops as Array<{ position:number; color:Color }> };
}
