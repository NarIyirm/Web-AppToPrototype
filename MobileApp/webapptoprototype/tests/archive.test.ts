/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { crc32, readMobileZip, writeMobileZip } from '../src/core/archive.ts';

const encoder = new TextEncoder();
async function archive(entries = [{ name: 'mobile.json', bytes: encoder.encode('{"artifactKind":"mobile_capture"}') }]) {
  const chunks: Uint8Array[] = [];
  async function* stream() { yield* entries; }
  await writeMobileZip(stream(), { write(bytes) { chunks.push(new Uint8Array(bytes)); } });
  return new Uint8Array(Buffer.concat(chunks));
}
test('store ZIP round trip preserves exact bytes, Unicode and CRC', async () => {
  const content = encoder.encode('中文标题');
  const bytes = await archive([{ name: 'mobile.json', bytes: content },
    { name: 'captures/c-capture01/snapshot.json', bytes: encoder.encode('{}') }]);
  assert.deepEqual(readMobileZip(bytes).get('mobile.json'), content);
  assert.equal(crc32(encoder.encode('123456789')), 0xcbf43926);
});
test('ZIP writer refuses traversal and duplicate paths', async () => {
  await assert.rejects(() => archive([{ name: '../mobile.json', bytes: new Uint8Array() }]));
  await assert.rejects(() => archive([{ name: 'mobile.json', bytes: new Uint8Array() }, { name: 'mobile.json', bytes: new Uint8Array() }]));
});
test('receiver rejects truncated headers, altered content and mismatched local/central metadata', async () => {
  const original = await archive();
  assert.throws(() => readMobileZip(original.subarray(0, original.length - 1)));
  const altered = new Uint8Array(original); altered[42] ^= 1;
  assert.throws(() => readMobileZip(altered));
  const changed = new Uint8Array(original); new DataView(changed.buffer).setUint32(22, 1, true);
  assert.throws(() => readMobileZip(changed));
});
test('receiver rejects encryption, unsupported compression and ZIP64-style extras', async () => {
  const original = await archive();
  const view = new DataView(original.buffer), end = original.length - 22;
  const central = view.getUint32(end + 16, true);
  for (const [offset, value] of [[8, 0x801], [10, 8], [30, 1]]) {
    const changed = new Uint8Array(original);
    new DataView(changed.buffer).setUint16(central + offset, value, true);
    assert.throws(() => readMobileZip(changed));
  }
});
test('writer bounds output chunks rather than emitting a whole image', async () => {
  const sizes: number[] = [];
  async function* entries() { yield { name: 'mobile.json', bytes: new Uint8Array(600_000) }; }
  await writeMobileZip(entries(), { write(bytes) { sizes.push(bytes.length); } });
  assert.ok(Math.max(...sizes) <= 256 * 1024);
});
test('entry budgets reject a declared bomb before parsing any content', async () => {
  const original = await archive();
  const view = new DataView(original.buffer), central = view.getUint32(original.length - 6, true);
  view.setUint32(central + 24, 0xffffffff, true);
  assert.throws(() => readMobileZip(original));
});
