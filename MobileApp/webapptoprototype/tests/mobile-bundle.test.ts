/// <reference types="node" />
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { writeMobileZip } from '../src/core/archive.ts';
import { readMobileBundle, type MobileMeta } from '../src/core/mobile-bundle.ts';
import { addCapture, addProject, emptyManifest, type Capture } from '../src/core/project.ts';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const hash = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const assetId = await hash(png), now = '2026-10-20T05:00:00.000Z';
const asset = { id: assetId, bytes: png.length, width: 1, height: 1, mediaType: 'image/png' as const };
const capture: Capture = { id: 'c-capture01', projectId: 'p-project01', title: '固定样例', createdAt: now,
  sourceKind: 'imported_image', platform: 'ios', assetId, width: 1, height: 1, logicalWidth: 1, logicalHeight: 1,
  coordinateSpace: 'image_pixels', observations: [], webNodes: [], warnings: ['图片素材'], redacted: false };
const state = addCapture(addProject(emptyManifest(), 'p-project01', '传输样例', now), capture, asset);
const meta: MobileMeta = { artifactKind: 'mobile_capture', formatVersion: '0.1.0-alpha.1', packageId: 'b-bundle001',
  revision: state.revision, createdAt: now, producer: { appVersion: '1.0.0', adapterVersion: 'mobile-1' },
  project: { id: 'p-project01', name: '传输样例' }, captures: [{ id: capture.id, snapshotPath: `captures/${capture.id}/snapshot.json` }],
  assets: [{ ...asset, path: `assets/${assetId}.png` }] };
async function zip(metadata: unknown = meta, snapshot: unknown = capture, extra = false) {
  const chunks: Uint8Array[] = [], encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  async function* entries() {
    yield { name: 'mobile.json', bytes: encode(metadata) };
    yield { name: `captures/${capture.id}/snapshot.json`, bytes: encode(snapshot) };
    yield { name: `assets/${assetId}.png`, bytes: png };
    if (extra) yield { name: 'captures/c-unknown01/snapshot.json', bytes: encode({}) };
  }
  await writeMobileZip(entries(), { write(bytes) { chunks.push(new Uint8Array(bytes)); } });
  return new Uint8Array(Buffer.concat(chunks));
}
test('raw material producer/consumer agree on source kind, dimensions and exact resources', async () => {
  const result = await readMobileBundle(await zip(), hash);
  assert.equal(result.state.captures[0].sourceKind, 'imported_image');
  assert.equal(result.state.assets[0].id, assetId);
  assert.equal(result.files.size, 3);
});
test('rejects wrong versions, unexpected metadata and missing asset references', async () => {
  for (const value of [{ ...meta, formatVersion: '1.0.0' }, { ...meta, token: 'secret' },
    { ...meta, captures: [{ id: capture.id, snapshotPath: 'captures/c-unknown01/snapshot.json' }] }]) {
    await assert.rejects(() => zip(value).then((bytes) => readMobileBundle(bytes, hash)));
  }
});
test('requires verified digest and real PNG dimensions', async () => {
  await assert.rejects(() => zip().then((bytes) => readMobileBundle(bytes, async () => '0'.repeat(64))));
  await assert.rejects(() => zip({ ...meta, assets: [{ ...meta.assets[0], width: 2 }] }).then((bytes) => readMobileBundle(bytes, hash)));
});
test('rejects undeclared files and hidden source credentials', async () => {
  await assert.rejects(() => zip(meta, capture, true).then((bytes) => readMobileBundle(bytes, hash)));
  await assert.rejects(() => zip(meta, { ...capture, sourceUrl: 'https://example.com/?token=secret' }).then((bytes) => readMobileBundle(bytes, hash)));
});
test('snapshot schema rejects cookies and code instead of forwarding them', async () => {
  await assert.rejects(() => zip(meta, { ...capture, cookies: 'secret' }).then((bytes) => readMobileBundle(bytes, hash)));
  await assert.rejects(() => zip(meta, { ...capture, webNodes: [{ id: 'node', kind: 'image', bounds: { x: 0, y: 0, width: 1, height: 1 }, script: 'code' }] }).then((bytes) => readMobileBundle(bytes, hash)));
});
