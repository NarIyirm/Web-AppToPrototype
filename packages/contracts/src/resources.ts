// Portable implementation: the Figma plugin sandbox has neither Node crypto nor Web Crypto.
export const LIMITS = Object.freeze({ jsonBytes: 50 * 1024 * 1024, assetBytes: 10 * 1024 * 1024, totalAssetBytes: 30 * 1024 * 1024, dimension: 4096, totalPixels: 64 * 1024 * 1024, nodes: 10000, textUnits: 200000 });
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let crc = i; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); crcTable[i] = crc >>> 0; }
export function decodeBase64(value: string): Uint8Array {
  if (!value || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('E_PACKAGE_INVALID: invalid base64');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(value.length / 4 * 3 - padding);
  let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i]), b = alphabet.indexOf(value[i + 1]);
    const c = value[i + 2] === '=' ? 0 : alphabet.indexOf(value[i + 2]);
    const d = value[i + 3] === '=' ? 0 : alphabet.indexOf(value[i + 3]);
    if (i + 4 === value.length && ((padding === 2 && (b & 15)) || (padding === 1 && (c & 3)))) throw new Error('E_PACKAGE_INVALID: noncanonical base64');
    const bits = (a << 18) | (b << 12) | (c << 6) | d;
    if (offset < bytes.length) bytes[offset++] = (bits >>> 16) & 255;
    if (offset < bytes.length) bytes[offset++] = (bits >>> 8) & 255;
    if (offset < bytes.length) bytes[offset++] = bits & 255;
  }
  return bytes;
}
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
export function sha256(bytes: Uint8Array): string {
  const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64); data.set(bytes); data[bytes.length] = 128;
  const view = new DataView(data.buffer); view.setUint32(data.length - 8, Math.floor(bytes.length / 0x20000000)); view.setUint32(data.length - 4, bytes.length * 8 >>> 0);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Int32Array(64); const rotate = (n: number, s: number) => (n >>> s) | (n << (32 - s));
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rotate(a,7) ^ rotate(a,18) ^ (a >>> 3)) + w[i - 7] + (rotate(b,17) ^ rotate(b,19) ^ (b >>> 10))) | 0; }
    let [a,b,c,d,e,f,g,j] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (j + (rotate(e,6) ^ rotate(e,11) ^ rotate(e,25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotate(a,2) ^ rotate(a,13) ^ rotate(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      j=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,j].forEach((value, i) => { h[i] = (h[i] + value) | 0; });
  }
  return h.map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}
export function utf8Bytes(value: string): number {
  let size = 0;
  for (const char of value) { const point = char.codePointAt(0)!; size += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4; }
  return size;
}
export function inspectImage(bytes: Uint8Array): { mime: 'image/png' | 'image/jpeg'; width: number; height: number } {
  const invalid = () => new Error('E_PACKAGE_INVALID: invalid or truncated PNG/JPEG');
  if (bytes.length < 12) throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if ([137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) {
    let offset = 8, width = 0, height = 0, idat = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset); const end = offset + 12 + length;
      if (end > bytes.length) throw invalid();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      let crc = 0xffffffff;
      for (let i = offset + 4; i < end - 4; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
      if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4)) throw invalid();
      if (offset === 8 && (type !== 'IHDR' || length !== 13)) throw invalid();
      if (type === 'IHDR') { if (offset !== 8) throw invalid(); width = view.getUint32(offset + 8); height = view.getUint32(offset + 12); }
      if (type === 'IDAT') idat = true;
      if (type === 'IEND') { if (length || end !== bytes.length || !idat || !width || !height) throw invalid(); return { mime: 'image/png', width, height }; }
      offset = end;
    }
    throw invalid();
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) throw invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw invalid();
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 8) throw invalid();
        return { mime: 'image/jpeg', height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) };
      }
      offset += length;
    }
  }
  throw invalid();
}
export interface InlineAsset { inlineBase64?: string; byteLength: number; sha256: string; mime: string; width: number; height: number }
export function validateAsset(asset: InlineAsset): Uint8Array {
  if (!asset.inlineBase64) throw new Error('E_PACKAGE_INVALID: only inline assets are supported');
  if (asset.byteLength > LIMITS.assetBytes) throw new Error('E_LIMIT_EXCEEDED: asset bytes');
  const bytes = decodeBase64(asset.inlineBase64);
  if (bytes.length !== asset.byteLength) throw new Error('E_PACKAGE_INVALID: asset byte length mismatch');
  if (sha256(bytes) !== asset.sha256) throw new Error('E_PACKAGE_INVALID: asset SHA-256 mismatch');
  const image = inspectImage(bytes);
  if (image.mime !== asset.mime) throw new Error('E_PACKAGE_INVALID: asset MIME mismatch');
  if (image.width !== asset.width || image.height !== asset.height) throw new Error('E_PACKAGE_INVALID: asset dimensions mismatch');
  if (image.width < 1 || image.height < 1 || image.width > LIMITS.dimension || image.height > LIMITS.dimension) throw new Error('E_LIMIT_EXCEEDED: image dimensions');
  return bytes;
}
