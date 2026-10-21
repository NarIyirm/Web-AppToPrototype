import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const data = JSON.parse(await readFile('examples/capture-package.v1.example.json', 'utf8'));
function chunk(type, bytes) {
  const body = Buffer.concat([Buffer.from(type), bytes]);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, checksum]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(32, 0); header.writeUInt32BE(32, 4); header[8] = 8; header[9] = 6;
const raw = Buffer.alloc(32 * (1 + 32 * 4));
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const i = y * 129 + 1 + x * 4; const alternate = (Math.floor(x / 8) + Math.floor(y / 8)) % 2;
  raw.set(alternate ? [160, 32, 75, 255] : [244, 230, 235, 255], i);
}
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const sha = createHash('sha256').update(png).digest('hex');
data.packageId = 'pkg-figma-m0-probe';
data.assets.push({ assetId: sha, sha256: sha, mime: 'image/png', byteLength: png.length, width: 32, height: 32, inlineBase64: png.toString('base64') });
data.screens[0].nodes.push({ id: 'probe-image', sourceId: 'synthetic-png', name: 'PNG / 内嵌资源验证', type: 'IMAGE', parentId: 'list-root', order: 2, rect: { x: 24, y: 80, width: 48, height: 48 }, fidelity: 'native', style: { opacity: 1 }, assetId: sha });
await writeFile('examples/figma-m0-probe.json', JSON.stringify(data, null, 2) + '\n');
