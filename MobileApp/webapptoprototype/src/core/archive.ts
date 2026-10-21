import { LIMITS } from './project.ts';

const table = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  table[index] = value >>> 0;
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const validPath = (path: string) => path === 'mobile.json'
  || /^captures\/[a-z][a-z0-9_-]{7,80}\/snapshot.json$/.test(path)
  || /^assets\/[a-f0-9]{64}\.png$/.test(path);
type Entry = { name: string; bytes: Uint8Array };
type Sink = { write(bytes: Uint8Array): void };

/** Store-only ZIP streams bounded chunks to native disk; it never joins the package in JS. */
export async function writeMobileZip(entries: AsyncIterable<Entry>, sink: Sink) {
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let total = 0;
  for await (const entry of entries) {
    if (!validPath(entry.name) || seen.has(entry.name) || seen.size >= 16) throw new Error('M_PACKAGE_INVALID: ZIP 条目不正确。');
    seen.add(entry.name);
    total += entry.bytes.length;
    if (total > LIMITS.bundleBytes) throw new Error('M_LIMIT_EXCEEDED: 素材包过大。');
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x800, true);
    header.setUint32(14, crc, true); header.setUint32(18, entry.bytes.length, true);
    header.setUint32(22, entry.bytes.length, true); header.setUint16(26, name.length, true); local.set(name, 30);
    const directory = new Uint8Array(46 + name.length);
    const record = new DataView(directory.buffer);
    record.setUint32(0, 0x02014b50, true); record.setUint16(4, 20, true); record.setUint16(6, 20, true);
    record.setUint16(8, 0x800, true); record.setUint32(16, crc, true);
    record.setUint32(20, entry.bytes.length, true); record.setUint32(24, entry.bytes.length, true);
    record.setUint16(28, name.length, true); record.setUint32(42, offset, true); directory.set(name, 46);
    central.push(directory);
    sink.write(local);
    for (let index = 0; index < entry.bytes.length; index += 256 * 1024) {
      sink.write(entry.bytes.subarray(index, index + 256 * 1024));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    offset += local.length + entry.bytes.length;
  }
  if (!seen.has('mobile.json')) throw new Error('M_PACKAGE_INVALID: 缺少素材清单。');
  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  if (offset + centralSize + 22 > LIMITS.bundleBytes) throw new Error('M_LIMIT_EXCEEDED: 素材包过大。');
  for (const entry of central) sink.write(entry);
  const end = new Uint8Array(22);
  const record = new DataView(end.buffer);
  record.setUint32(0, 0x06054b50, true); record.setUint16(8, central.length, true);
  record.setUint16(10, central.length, true); record.setUint32(12, centralSize, true);
  record.setUint32(16, offset, true); sink.write(end);
}

/** Minimal strict consumer for alpha.1. Reject unsupported encodings instead of unbounded inflation. */
export function readMobileZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const reject = () => { throw new Error('M_PACKAGE_INVALID: ZIP 格式、路径、摘要或预算不正确。'); };
  if (bytes.length < 22 || bytes.length > LIMITS.bundleBytes) return reject();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 4, true)
    || view.getUint16(end + 6, true) || view.getUint16(end + 20, true)) return reject();
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true);
  if (count < 1 || count > 16 || view.getUint16(end + 8, true) !== count
    || start + view.getUint32(end + 12, true) !== end) return reject();
  let position = start, total = 0;
  const files = new Map<string, Uint8Array>();
  const ranges: [number, number][] = [];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) return reject();
    const flags = view.getUint16(position + 8, true), method = view.getUint16(position + 10, true);
    const packed = view.getUint32(position + 20, true), size = view.getUint32(position + 24, true);
    const length = view.getUint16(position + 28, true), local = view.getUint32(position + 42, true);
    if (flags !== 0x800 || method !== 0 || packed !== size || view.getUint16(position + 30, true)
      || view.getUint16(position + 32, true) || view.getUint16(position + 34, true)
      || view.getUint32(position + 38, true) || position + 46 + length > end) return reject();
    const name = decoder.decode(bytes.subarray(position + 46, position + 46 + length));
    total += size;
    if (!validPath(name) || files.has(name) || total > LIMITS.bundleBytes || size > 16 * 1024 * 1024
      || local + 30 > start || view.getUint32(local, true) !== 0x04034b50
      || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method
      || view.getUint32(local + 14, true) !== view.getUint32(position + 16, true)
      || view.getUint32(local + 18, true) !== packed || view.getUint32(local + 22, true) !== size
      || view.getUint16(local + 26, true) !== length || view.getUint16(local + 28, true)) return reject();
    const content = local + 30 + length, finish = content + packed;
    if (finish > start || decoder.decode(bytes.subarray(local + 30, content)) !== name
      || ranges.some(([from, to]) => local < to && finish > from)) return reject();
    const data = bytes.subarray(content, finish);
    if (crc32(data) !== view.getUint32(position + 16, true)) return reject();
    files.set(name, data); ranges.push([local, finish]); position += 46 + length;
  }
  ranges.sort((a, b) => a[0] - b[0]);
  if (position !== end || ranges[0]?.[0] !== 0 || ranges.at(-1)?.[1] !== start
    || ranges.some(([from], index) => index > 0 && ranges[index - 1][1] !== from)
    || !files.has('mobile.json')) return reject();
  return files;
}
