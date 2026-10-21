import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCapturePackage, type CapturePackage } from '../packages/contracts/src/index';
const example = JSON.parse(readFileSync('examples/capture-package.v1.example.json', 'utf8')) as CapturePackage;
const copy = () => structuredClone(example);
test('accepts the full two-screen example in explicit development mode', () => {
  assert.equal(parseCapturePackage(copy(), true).screens.length, 2);
});
test('rejects example packages unless development mode is explicit', () => {
  assert.throws(() => parseCapturePackage(copy()), /DEVELOPMENT_MODE/);
});
test('rejects incompatible version and unknown required capabilities', () => {
  const data = copy(); (data as { schemaVersion: string }).schemaVersion = '2.0.0';
  assert.throws(() => parseCapturePackage(data, true), /E_PACKAGE_INVALID/);
  const next = copy(); next.requiredCapabilities = ['execute-javascript'];
  assert.throws(() => parseCapturePackage(next, true), /E_VERSION_UNSUPPORTED/);
});
test('rejects cyclic parent references independently of node order', () => {
  const data = copy(); const nodes = data.screens[0].nodes;
  nodes[2].parentId = nodes[2].id;
  assert.throws(() => parseCapturePackage(data, true), /cyclic/);
});
test('rejects dangling parent and prototype destination before writing', () => {
  const data = copy(); data.screens[0].nodes[1].parentId = 'unknown';
  assert.throws(() => parseCapturePackage(data, true), /invalid parent/);
  const next = copy(); next.interactions[0].toScreenId = 'missing';
  assert.throws(() => parseCapturePackage(next, true), /E_LINK_TARGET_MISSING/);
});
test('rejects duplicated node and screen identifiers', () => {
  const data = copy(); data.screens[0].nodes.push(data.screens[0].nodes[0]);
  assert.throws(() => parseCapturePackage(data, true), /duplicate node/);
  const next = copy(); next.screens.push(next.screens[0]);
  assert.throws(() => parseCapturePackage(next, true), /duplicate screen/);
});
test('rejects negative dimensions and invalid color values', () => {
  const data = copy(); data.screens[0].nodes[0].rect.width = -1;
  assert.throws(() => parseCapturePackage(data, true), /E_PACKAGE_INVALID/);
  const next = copy(); const fill = next.screens[0].nodes[0].style.fills![0]; if (fill.kind === 'solid') fill.color.a = 2;
  assert.throws(() => parseCapturePackage(next, true), /E_PACKAGE_INVALID/);
});
test('rejects text runs that split UTF-16 surrogate pairs', () => {
  const data = copy(); const text = data.screens[0].nodes[1].text!;
  text.characters = 'A😀B'; text.runs = [{ start: 1, end: 2, font: text.font }];
  assert.throws(() => parseCapturePackage(data, true), /invalid text run/);
});
test('rejects path traversal and inline byte-length mismatch', () => {
  const asset = { assetId: 'asset', sha256: '0'.repeat(64), mime: 'image/png' as const, byteLength: 1, width: 1, height: 1 };
  const data = copy(); data.assets.push({ ...asset, path: '../secret.png' });
  assert.throws(() => parseCapturePackage(data, true), /unsafe asset path/);
  const next = copy(); next.assets.push({ ...asset, inlineBase64: 'AAAA' });
  assert.throws(() => parseCapturePackage(next, true), /byte length mismatch/);
});
test('validates the self-contained probe image and round-trip links', () => {
  const data = JSON.parse(readFileSync('examples/figma-m0-probe.json', 'utf8'));
  const parsed = parseCapturePackage(data, true);
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.interactions.length, 2);
});
