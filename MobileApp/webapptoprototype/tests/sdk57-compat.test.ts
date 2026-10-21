import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { fitImageSize } from '../src/core/image-size.ts';
import { sha256Stream } from '../src/core/stream-digest.ts';

test('streamed file digest matches SHA-256 across chunk boundaries without full-file reads', async () => {
  const source = Uint8Array.from({ length: 1_048_593 }, (_, index) => index % 251);
  let offset = 0, largest = 0, pauses = 0;
  const digest = await sha256Stream(source.length, (length) => {
    largest = Math.max(largest, length);
    const bytes = source.subarray(offset, offset + length); offset += bytes.length; return bytes;
  }, async () => { pauses++; });
  assert.equal(digest, createHash('sha256').update(source).digest('hex'));
  assert.equal(offset, source.length); assert.ok(largest <= 256 * 1024); assert.equal(pauses, 5);
});
test('streamed digest handles short reads and rejects truncation, invalid sizes and oversized chunks', async () => {
  let offset = 0;
  const source = new TextEncoder().encode('中文与 emoji 😀，按块读取');
  const digest = await sha256Stream(source.length, () => source.subarray(offset, offset += 3), async () => {});
  assert.equal(digest, createHash('sha256').update(source).digest('hex'));
  for (const size of [-1, NaN, 1.5, 64 * 1024 * 1024 + 1]) await assert.rejects(sha256Stream(size, () => source));
  await assert.rejects(sha256Stream(10, () => new Uint8Array()), /读取/);
  await assert.rejects(sha256Stream(1, () => source), /读取/);
  assert.equal(await sha256Stream(0, () => { throw Error('must not read'); }), createHash('sha256').digest('hex'));
});
test('SDK 57 image resizing preserves aspect ratio and never grows an already bounded image', () => {
  assert.deepEqual(fitImageSize(8000, 4000), { width: 4096, height: 2048 });
  assert.deepEqual(fitImageSize(4000, 8000), { width: 2048, height: 4096 });
  assert.deepEqual(fitImageSize(640, 960), { width: 640, height: 960 });
  assert.deepEqual(fitImageSize(1, 100000), { width: 1, height: 4096 });
  for (const size of [[0, 10], [NaN, 100], [100, -1]]) assert.throws(() => fitImageSize(...size as [number, number]));
});
