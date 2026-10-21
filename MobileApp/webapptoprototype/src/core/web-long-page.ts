import { unzlibSync, zlibSync } from 'fflate';

import { crc32 } from './archive.ts';
import { LIMITS, type WebNode } from './project.ts';
import type { WebObservation } from './web-capture.ts';

export const LONG_PAGE = { height: 12000, steps: 20, milliseconds: 45000, nodes: 5000 } as const;
type Pixels = { width: number; height: number; rgba: Uint8Array };
const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
};
/** Decode only the bounded, non-interlaced PNGs returned by view-shot. */
export function readCapturePng(bytes: Uint8Array): Pixels {
  const fail = () => { throw new Error('网页截图格式无法合成，请改用当前视口。'); };
  if (bytes.length < 45 || bytes.length > LIMITS.imageBytes
    || [137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v)) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = view.getUint32(16), height = view.getUint32(20);
  const color = bytes[25], channels = color === 6 ? 4 : color === 2 ? 3 : color === 0 ? 1 : color === 4 ? 2 : 0;
  if (!width || !height || width > 2048 || height > 4096 || width * height > 4_000_000 || bytes[24] !== 8 || !channels || bytes[28]) return fail();
  let compressedSize = 0, position = 8;
  const parts: Uint8Array[] = [];
  while (position + 12 <= bytes.length) {
    const length = view.getUint32(position);
    if (position + length + 12 > bytes.length) return fail();
    if (crc32(bytes.subarray(position + 4, position + 8 + length)) !== view.getUint32(position + 8 + length)) return fail();
    if (String.fromCharCode(...bytes.subarray(position + 4, position + 8)) === 'IDAT') { parts.push(bytes.subarray(position + 8, position + 8 + length)); compressedSize += length; }
    position += length + 12;
  }
  const packed = new Uint8Array(compressedSize); let offset = 0;
  for (const part of parts) { packed.set(part, offset); offset += part.length; }
  const stride = width * channels, expected = (stride + 1) * height;
  const raw = unzlibSync(packed, { out: new Uint8Array(expected) });
  if (raw.length !== expected) return fail();
  const scan = new Uint8Array(stride * height), rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) return fail();
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? scan[y * stride + x - channels] : 0, b = y ? scan[(y - 1) * stride + x] : 0;
      const c = y && x >= channels ? scan[(y - 1) * stride + x - channels] : 0;
      scan[y * stride + x] = raw[y * (stride + 1) + x + 1] + (filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c));
    }
    for (let x = 0; x < width; x++) {
      const from = y * stride + x * channels, to = (y * width + x) * 4;
      rgba[to] = scan[from]; rgba[to + 1] = channels <= 2 ? scan[from] : scan[from + 1];
      rgba[to + 2] = channels <= 2 ? scan[from] : scan[from + 2]; rgba[to + 3] = color === 6 ? scan[from + 3] : color === 4 ? scan[from + 1] : 255;
    }
  }
  return { width, height, rgba };
}
export function writeCapturePng(image: Pixels): Uint8Array {
  const raw = new Uint8Array((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y++) raw.set(image.rgba.subarray(y * image.width * 4, (y + 1) * image.width * 4), y * (image.width * 4 + 1) + 1);
  const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, image.width); view.setUint32(4, image.height); header[8] = 8; header[9] = 6;
  const chunks = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])];
  for (const [type, data] of [['IHDR', header], ['IDAT', zlibSync(raw, { level: 6 })], ['IEND', new Uint8Array()]] as const) {
    const chunk = new Uint8Array(data.length + 12), v = new DataView(chunk.buffer); v.setUint32(0, data.length);
    chunk.set(Array.from(type, (s) => s.charCodeAt(0)), 4); chunk.set(data, 8); v.setUint32(data.length + 8, crc32(chunk.subarray(4, data.length + 8))); chunks.push(chunk);
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; } return out;
}
/** One bounded preview buffer; each viewport is released before the next screenshot. */
export class LongPageComposer {
  readonly width: number; readonly scale: number; readonly rgba: Uint8Array;
  readonly logicalWidth: number; readonly limitHeight: number;
  covered = 0; nodes: WebNode[] = []; warnings = new Set<string>();
  constructor(logicalWidth: number, limitHeight: number) {
    this.logicalWidth = logicalWidth; this.limitHeight = limitHeight;
    if (!Number.isFinite(logicalWidth) || logicalWidth < 1 || logicalWidth > 16384 || !Number.isFinite(limitHeight) || limitHeight < 1 || limitHeight > LONG_PAGE.height) throw new Error('长页尺寸超出范围。');
    this.scale = Math.min(1, 1024 / logicalWidth, 4096 / limitHeight);
    this.width = Math.max(1, Math.floor(logicalWidth * this.scale));
    this.rgba = new Uint8Array(this.width * Math.ceil(limitHeight * this.scale) * 4);
  }
  add(bytes: Uint8Array, observation: WebObservation) {
    const y = observation.page?.y ?? 0, viewport = observation.viewport;
    if (Math.abs(viewport.width - this.logicalWidth) > 1 || y > this.covered + 1) throw new Error('长页位置或宽度发生变化，请重试。');
    const end = Math.min(this.limitHeight, y + viewport.height, observation.page?.height ?? Infinity);
    if (end <= this.covered) return;
    const image = readCapturePng(bytes);
    for (let row = Math.round(this.covered * this.scale); row < Math.round(end * this.scale); row++) {
      const sy = Math.min(image.height - 1, Math.max(0, Math.floor((row / this.scale - y) / viewport.height * image.height)));
      for (let col = 0; col < this.width; col++) {
        const sx = Math.min(image.width - 1, Math.floor(col / this.width * image.width));
        this.rgba.set(image.rgba.subarray((sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4), (row * this.width + col) * 4);
      }
    }
    for (const node of observation.nodes) {
      const top = y + node.bounds.y, bottom = top + node.bounds.height;
      const clippedTop = Math.max(this.covered, top), clippedBottom = Math.min(end, bottom);
      if (clippedBottom <= clippedTop || this.nodes.length >= LONG_PAGE.nodes - 1) continue;
      const bounds = { ...node.bounds, y: clippedTop, height: clippedBottom - clippedTop };
      // Keep the remaining pixels when overlap splits a complete text node.
      this.nodes.push(node.kind === 'text' && (clippedTop > top + .5 || clippedBottom < bottom - .5)
        ? { id: `long-${this.nodes.length}`, kind: 'image', bounds }
        : { ...node, id: `long-${this.nodes.length}`, bounds });
    }
    for (const warning of observation.warnings) this.warnings.add(warning);
    this.covered = end;
  }
  finish() {
    if (!this.covered) throw new Error('没有可保存的长页内容。');
    const height = Math.max(1, Math.round(this.covered * this.scale));
    const bytes = writeCapturePng({ width: this.width, height, rgba: this.rgba.subarray(0, this.width * height * 4) });
    if (bytes.length > LIMITS.imageBytes) throw new Error('长页图片超过 10 MiB，请缩小范围。');
    if (this.nodes.length >= LONG_PAGE.nodes - 1) this.warnings.add('长页达到 5000 个图层上限，部分内容未转换。');
    return { bytes, width: this.width, height };
  }
}
