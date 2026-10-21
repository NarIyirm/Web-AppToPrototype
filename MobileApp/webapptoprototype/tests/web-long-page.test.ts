/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { LongPageComposer, readCapturePng, writeCapturePng } from '../src/core/web-long-page.ts';
import { parseWebObservation, type WebObservation } from '../src/core/web-capture.ts';

const image = (red: number, height = 4) => writeCapturePng({ width: 4, height, rgba: new Uint8Array(Array.from({ length: 4 * height }, () => [red, 0, 0, 255]).flat()) });
const observation = (y: number): WebObservation => ({ kind: 'web_capture', epoch: 'e-current01', requestId: 'r-request01', title: 'long', viewport: { width: 4, height: 4 }, selection: { x: 0, y: 0, width: 4, height: 4 }, page: { x: 0, y, width: 4, height: 6 }, nodes: [{ id: 'text', kind: 'text', bounds: { x: 0, y: 2, width: 4, height: 2 }, text: 'row' }], warnings: [] });
test('long page joins overlapping final viewport once and normalizes node positions', () => {
  const composer = new LongPageComposer(4, 6); composer.add(image(10), observation(0)); composer.add(image(20), observation(2));
  const result = composer.finish(), pixels = readCapturePng(result.bytes);
  assert.equal(pixels.height, 6); assert.equal(pixels.rgba[(3 * 4) * 4], 10); assert.equal(pixels.rgba[(4 * 4) * 4], 20);
  assert.deepEqual(composer.nodes.map(n => n.bounds.y), [2, 4]); assert.equal(composer.covered, 6);
});
test('long page refuses gaps/width changes and has a bounded output', () => {
  const composer = new LongPageComposer(390, 12000); assert.ok(composer.rgba.length <= 4096 * 1024 * 4);
  assert.throws(() => composer.add(image(10), observation(0)), /宽度/);
  assert.throws(() => new LongPageComposer(0, 6)); assert.throws(() => new LongPageComposer(390, 30000));
  const small = new LongPageComposer(4, 6); assert.throws(() => small.add(image(10), observation(2)), /位置/);
});
test('PNG input validates CRC and never treats an unsupported format as successful', () => {
  const png = image(50); assert.equal(readCapturePng(png).rgba[0], 50); png[30] ^= 1; assert.throws(() => readCapturePng(png));
});
test('DOM font measurements are allowlisted and reject invalid metrics', () => {
  const o = observation(0); o.nodes[0] = { ...o.nodes[0], fontFamily: 'Arial', fontWeight: 700, lineHeight: 20, textAlign: 'center' };
  assert.equal(parseWebObservation(JSON.stringify(o), o.epoch, o.requestId).nodes[0].fontWeight, 700);
  o.nodes[0].lineHeight = -1; assert.throws(() => parseWebObservation(JSON.stringify(o), o.epoch, o.requestId));
});
