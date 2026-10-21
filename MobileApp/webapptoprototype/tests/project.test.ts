/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { addCapture, addProject, commit, emptyManifest, parseManifest, removeCapture, type Asset, type Capture } from '../src/core/project.ts';
import { Repository } from '../src/data/repository.ts';
import type { StorageIO } from '../src/data/storage.types.ts';

const now = '2026-10-20T04:00:00.000Z', projectId = 'p-project01';
const asset: Asset = { id: 'a'.repeat(64), width: 100, height: 200, bytes: 1000, mediaType: 'image/png' };
function capture(id = 'c-capture01'): Capture { return { id, projectId, title: '画面', createdAt: now, sourceKind: 'imported_image',
  platform: 'ios', assetId: asset.id, width: 100, height: 200, logicalWidth: 100, logicalHeight: 200,
  coordinateSpace: 'image_pixels', observations: [], webNodes: [], warnings: [], redacted: false }; }
test('manifest rejects out-of-frame observations and source-kind URL mismatch', () => {
  const valid = addCapture(addProject(emptyManifest(), projectId, '基准', now), capture(), asset);
  for (const change of [
    (value: typeof valid) => { value.captures[0].observations = [{ text: '越界', bounds: { x: 95, y: 0, width: 20, height: 10 }, confidence: null, provenance: 'ocr' }]; },
    (value: typeof valid) => { value.captures[0].webNodes = [{ id: 'bad', kind: 'shape', bounds: { x: 0, y: 199, width: 10, height: 10 } }]; },
    (value: typeof valid) => { value.captures[0].sourceUrl = 'https://example.com'; },
    (value: typeof valid) => { value.captures[0].sourceKind = 'web'; },
  ]) { const next = JSON.parse(JSON.stringify(valid)); change(next); assert.throws(() => parseManifest(JSON.stringify(next))); }
});
function memory() {
  const slots: (string | null)[] = [null, null];
  let fail = false;
  const io: StorageIO = { async readSlots() { return [...slots]; },
    async writeSlot(slot, data) { if (fail) throw new Error('disk full'); slots[slot] = data; },
    async putAsset() {}, async readAsset() { return new Uint8Array(); }, async assetUri() { return ''; },
    async createExport() { throw new Error('not used'); }, async shareExport() {} };
  return { io, slots, fail: (value: boolean) => { fail = value; } };
}
test('adding and removing captures preserves previous revisions and shared assets', () => {
  const initial = addProject(emptyManifest(), projectId, '项目', now);
  const next = addCapture(initial, capture(), asset);
  assert.equal(initial.captures.length, 0);
  assert.deepEqual(next.projects[0].captureIds, ['c-capture01']);
  const two = addCapture(next, capture('c-capture02'), asset);
  assert.equal(two.assets.length, 1);
  const removed = removeCapture(two, 'c-capture01');
  assert.equal(removed.assets.length, 1);
  assert.equal(removed.captures[0].id, 'c-capture02');
});
test('rejects dangling references, wrong dimensions, duplicate IDs and non-finite bounds', () => {
  const valid = addCapture(addProject(emptyManifest(), projectId, '项目', now), capture(), asset);
  for (const mutate of [
    (value: typeof valid) => { value.projects[0].captureIds = []; },
    (value: typeof valid) => { value.captures[0].width = 101; },
    (value: typeof valid) => { value.projects.push(value.projects[0]); },
    (value: typeof valid) => { value.captures[0].observations = [{ text: 'Bad', bounds: { x: 0, y: 0, width: NaN, height: 1 }, confidence: null, provenance: 'ocr' }]; },
  ]) {
    const changed = JSON.parse(JSON.stringify(valid)) as typeof valid;
    mutate(changed);
    assert.throws(() => parseManifest(JSON.stringify(changed)));
  }
});
test('the twenty-state limit rejects a new capture without mutating successful work', () => {
  let state = addProject(emptyManifest(), projectId, '项目', now);
  for (let index = 0; index < 20; index++) state = addCapture(state, capture(`c-capture${index.toString().padStart(2, '0')}`), asset);
  assert.throws(() => addCapture(state, capture('c-overflow1'), asset));
  assert.equal(state.captures.length, 20);
});
test('serialization survives reopening and loads the latest complete revision', async () => {
  const backend = memory(), repository = new Repository(backend.io);
  await repository.load();
  await repository.update((state) => addProject(state, projectId, '持久项目', now));
  await repository.update((state) => addCapture(state, capture(), asset));
  const loaded = await new Repository(backend.io).load();
  assert.equal(loaded.state.revision, 2);
  assert.equal(loaded.state.captures.length, 1);
});
test('a corrupt latest slot recovers the last successful snapshot', async () => {
  const backend = memory();
  backend.slots[1] = JSON.stringify(addProject(emptyManifest(), projectId, '保留项目', now));
  backend.slots[0] = '{partial';
  const recovered = await new Repository(backend.io).load();
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.projects[0].name, '保留项目');
});
test('corrupting both slots blocks writes instead of silently replacing saved work', async () => {
  const backend = memory(); backend.slots[0] = '{'; backend.slots[1] = 'null';
  const repository = new Repository(backend.io);
  await assert.rejects(() => repository.load());
  await assert.rejects(() => repository.update((state) => addProject(state, projectId, '新项目', now)));
  assert.deepEqual(backend.slots, ['{', 'null']);
});
test('failed writes preserve the old state and do not poison the mutation queue', async () => {
  const backend = memory(), repository = new Repository(backend.io);
  await repository.load();
  await repository.update((state) => addProject(state, projectId, '项目', now));
  backend.fail(true);
  await assert.rejects(() => repository.update((state) => addCapture(state, capture(), asset)));
  backend.fail(false);
  const next = await repository.update((state) => addCapture(state, capture('c-capture02'), asset));
  assert.equal(next.revision, 2);
  assert.equal(next.captures[0].id, 'c-capture02');
});
test('concurrent edits serialize and cannot overwrite each other', async () => {
  const backend = memory(), repository = new Repository(backend.io);
  await repository.load();
  await repository.update((state) => addProject(state, projectId, '项目', now));
  await Promise.all([repository.update((state) => addCapture(state, capture('c-capture01'), asset)),
    repository.update((state) => addCapture(state, capture('c-capture02'), asset))]);
  const loaded = await new Repository(backend.io).load();
  assert.equal(loaded.state.captures.length, 2);
  assert.equal(loaded.state.revision, 3);
});
test('project deletion releases capture references without deleting recoverable assets', () => {
  const state = addCapture(addProject(emptyManifest(), projectId, '项目', now), capture(), asset);
  const next = commit(state, (draft) => { draft.projects = []; draft.captures = []; });
  assert.equal(next.assets.length, 1);
  assert.equal(state.captures.length, 1);
});
