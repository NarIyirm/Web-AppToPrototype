import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { decodeBase64, inspectImage, sha256, utf8Bytes, validateAsset } from '../packages/contracts/src/resources';
import { parseCapturePackage, type CapturePackage } from '../packages/contracts/src/index';
const probe = () => JSON.parse(readFileSync('examples/figma-m0-probe.json', 'utf8')) as CapturePackage;
test('portable SHA-256 matches Node at padding boundaries and for non-ASCII binary data', () => {
  for (const size of [0,1,3,55,56,63,64,65,127,128,1024,10000]) { const bytes = randomBytes(size); assert.equal(sha256(bytes), createHash('sha256').update(bytes).digest('hex')); }
});
test('portable base64 accepts canonical encoding and rejects damaged padding', () => {
  for (const size of [1,2,3,4,1024,1024*1024]) { const bytes = randomBytes(size); assert.deepEqual(Buffer.from(decodeBase64(bytes.toString('base64'))), bytes); }
  for (const value of ['A','AAAA=','AA=A','AB==','AAB=','!!!!','']) assert.throws(() => decodeBase64(value), /base64/);
});
test('counts serialized UTF-8 bytes consistently with Node', () => {
  for (const value of ['abc', '中文', '😀', '\ud800', JSON.stringify({ title:'中文😀' })]) assert.equal(utf8Bytes(value), Buffer.byteLength(value));
});
test('validates actual PNG bytes, CRC, MIME and image dimensions', () => {
  const asset = probe().assets[0]; const bytes = validateAsset(asset);
  assert.deepEqual(inspectImage(bytes), { mime:'image/png', width:32, height:32 });
  const damaged = bytes.slice(); damaged[damaged.length - 5] ^= 1;
  assert.throws(() => inspectImage(damaged), /invalid or truncated/);
  assert.throws(() => inspectImage(bytes.subarray(0, 32)), /invalid or truncated/);
  assert.throws(() => validateAsset({ ...asset, sha256:'0'.repeat(64) }), /SHA-256/);
  assert.throws(() => validateAsset({ ...asset, mime:'image/jpeg' }), /MIME/);
  assert.throws(() => validateAsset({ ...asset, width:33 }), /dimensions/);
});
test('package parser applies resource integrity before import', () => {
  for (const change of [{ sha256:'0'.repeat(64) }, { mime:'image/jpeg' }, { height:31 }]) {
    const data = probe(); Object.assign(data.assets[0], change); assert.throws(() => parseCapturePackage(data, true), /SHA-256|MIME|dimensions/);
  }
  const data = probe(); delete data.assets[0].inlineBase64; data.assets[0].path = 'assets/image.png';
  assert.throws(() => parseCapturePackage(data,true), /only inline/);
});
test('aggregate pixels, decoded bytes and node budgets reject before writing nodes', () => {
  const pixels = probe(); pixels.assets = Array.from({length:5}, (_,i) => ({ ...pixels.assets[0], assetId:`asset-${i}`, width:4096, height:4096 }));
  assert.throws(() => parseCapturePackage(pixels,true), /total image pixels/);
  const bytes = probe(); const asset = bytes.assets[0]; const base64 = Buffer.alloc(8 * 1024 * 1024).toString('base64');
  bytes.assets = Array.from({length:4}, (_,i) => ({ ...asset, assetId:`asset-${i}`, byteLength:8 * 1024 * 1024, inlineBase64:base64 }));
  assert.throws(() => parseCapturePackage(bytes,true), /total asset bytes/);
  const nodes = probe(); nodes.screens = Array.from({length:3}, (_,i) => ({ ...nodes.screens[0], id:`screen-${i}`, nodes:Array(4000).fill(nodes.screens[0].nodes[0]) }));
  assert.throws(() => parseCapturePackage(nodes,true), /total nodes/);
});
test('user acceptance files have the promised valid or rejected contract behavior', () => {
  const file = (name: string) => JSON.parse(readFileSync(`examples/acceptance/${name}.json`, 'utf8'));
  for (const name of ['01-native-Chinese-English','06-missing-font','07-cancel-2000-nodes']) assert.doesNotThrow(() => parseCapturePackage(file(name),true));
  for (const [name, error] of [
    ['02-invalid-sha256', /SHA-256/], ['03-invalid-mime', /MIME/], ['04-invalid-dimensions', /dimensions/],
    ['05-over-dimension-limit', /E_PACKAGE_INVALID/], ['08-over-pixel-budget', /total image pixels/], ['09-corrupt-png', /invalid or truncated/]
  ] as const) assert.throws(() => parseCapturePackage(file(name),true), error);
});
