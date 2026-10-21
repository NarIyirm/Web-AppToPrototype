/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { PageComposer, planPage } from '../src/core/web-page.ts';
import { readCapturePng, writeCapturePng } from '../src/core/web-long-page.ts';
import type { WebObservation } from '../src/core/web-capture.ts';
const png = (color: number) => writeCapturePng({ width: 4, height: 4, rgba: new Uint8Array(Array.from({ length: 16 }, () => [color, 0, 0, 255]).flat()) });
const observation = (x: number, y: number): WebObservation => ({ kind: 'web_capture', epoch: 'e-page001', requestId: 'r-page001', title: 'two axes', viewport: { width: 4, height: 4 }, page: { x, y, width: 6, height: 6 }, selection: { x: 0, y: 0, width: 4, height: 4 }, nodes: [{ id: 'tile', kind: 'shape', bounds: { x: 0, y: 0, width: 4, height: 4 }, background: 'rgb(0,0,0)' }], warnings: [] });
test('whole page joins all quadrants with clamped horizontal and vertical final tiles', () => {
  const plan = planPage(6, 6, { width: 4, height: 4 }), composer = new PageComposer(plan);
  for (const [index, [x, y]] of [[0, 0], [2, 0], [0, 2], [2, 2]].entries()) composer.add(png(10 + index), observation(x, y));
  const result = composer.finish(), pixels = readCapturePng(result.bytes);
  assert.equal(result.logicalWidth, 6); assert.equal(result.logicalHeight, 6); assert.equal(result.partial, false);
  assert.equal(pixels.rgba[0], 10); assert.equal(pixels.rgba[5 * 4], 11); assert.equal(pixels.rgba[(5 * 6) * 4], 12); assert.equal(pixels.rgba[(5 * 6 + 5) * 4], 13);
  assert.deepEqual(result.nodes.map(n => [n.bounds.x, n.bounds.y, n.bounds.width, n.bounds.height]), [[0, 0, 4, 4], [4, 0, 2, 4], [0, 4, 4, 2], [4, 4, 2, 2]]);
});
test('interrupted whole page saves complete rows, never a hole-filled success', () => {
  const plan = planPage(6, 6, { width: 4, height: 4 }), composer = new PageComposer(plan);
  composer.add(png(10), observation(0, 0)); assert.throws(() => composer.finish(), /一整行/);
  composer.add(png(11), observation(2, 0)); composer.add(png(12), observation(0, 2));
  const result = composer.finish(); assert.equal(result.logicalHeight, 4); assert.equal(result.partial, true); assert.equal(result.nodes.length, 2);
});
test('tile planner bounds area, axes and work; refuses a browser that did not reach the tile', () => {
  const plan = planPage(30000, 30000, { width: 390, height: 600 }), composer = new PageComposer(plan);
  assert.ok(plan.tiles.length <= 40); assert.ok(plan.width * plan.height <= 18_000_000); assert.ok(composer.rgba.length <= 16_000_000); assert.equal(plan.partial, true);
  const small = new PageComposer(planPage(6, 6, { width: 4, height: 4 }));small.add(png(0), observation(0, 0));assert.throws(() => small.add(png(0), observation(0, 0)), /滚动范围/);
});
