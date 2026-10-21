import assert from 'node:assert/strict';
import test from 'node:test';

import { dragRegion, dragRegionFromPage, sessionFrames, type SystemFrame } from '../src/core/app-capture.ts';

test('returning from an empty or failed new session never suggests an older capture', () => {
  const frames: SystemFrame[] = [{ id: 'old', uri: 'file://old', createdAt: 100 }];
  assert.deepEqual(sessionFrames(frames, { configured: true, running: false, message: '', startedAt: 200, phase: 'failed' }), []);
  assert.deepEqual(sessionFrames([...frames, { id: 'new', uri: 'file://new', createdAt: 210 }],
    { configured: true, running: false, message: '', startedAt: 200 }).map(frame => frame.id), ['new']);
});
test('recovered frames sort by time without changing the native inbox', () => {
  const frames = [{ id: 'b', uri: 'file://b', createdAt: 20 }, { id: 'a', uri: 'file://a', createdAt: 10 }];
  assert.deepEqual(sessionFrames(frames, { configured: true, running: false, message: '' }).map(frame => frame.id), ['a', 'b']);
  assert.equal(frames[0].id, 'b');
});
test('a reverse drag maps to original screenshot pixels and clamps beyond the image', () => {
  assert.deepEqual(dragRegion({ x: 250, y: 400 }, { x: 50, y: 100 }, { width: 300, height: 600 }, { width: 1200, height: 2400 }),
    { x: 200, y: 400, width: 800, height: 1200 });
  assert.deepEqual(dragRegion({ x: -30, y: -20 }, { x: 900, y: 900 }, { width: 300, height: 600 }, { width: 1179, height: 2556 }),
    { x: 0, y: 0, width: 1179, height: 2556 });
});
test('fractional scaling keeps all selected pixels in bounds; a tap never replaces the chosen region', () => {
  const region = dragRegion({ x: 0.5, y: 0.5 }, { x: 278.9, y: 419.9 }, { width: 279.3, height: 420 }, { width: 1365, height: 2053 })!;
  assert.ok(Number.isInteger(region.x) && Number.isInteger(region.width));
  assert.ok(region.x + region.width <= 1365 && region.y + region.height <= 2053);
  assert.equal(dragRegion({ x: 10, y: 10 }, { x: 12, y: 12 }, { width: 300, height: 600 }, { width: 1200, height: 2400 }), null);
  assert.equal(dragRegion({ x: NaN, y: 0 }, { x: 100, y: 100 }, { width: 300, height: 600 }, { width: 1200, height: 2400 }), null);
});
test('drag size follows fixed page movement even when an overlay changes the touch target', () => {
  const display = { width: 300, height: 600 }, image = { width: 1200, height: 2400 };
  const anchor = { x: 40, y: 80, pageX: 85, pageY: 200 };
  assert.deepEqual(dragRegionFromPage(anchor, { pageX: 285, pageY: 500 }, display, image),
    { x: 160, y: 320, width: 800, height: 1200 });
  // The same finger movement at a different modal/safe-area offset yields identical pixels.
  assert.deepEqual(dragRegionFromPage({ ...anchor, pageX: 125, pageY: 240 }, { pageX: 325, pageY: 540 }, display, image),
    { x: 160, y: 320, width: 800, height: 1200 });
  assert.deepEqual(dragRegionFromPage({ x: 280, y: 580, pageX: 320, pageY: 700 }, { pageX: 60, pageY: 200 }, display, image),
    { x: 80, y: 320, width: 1040, height: 2000 });
});
