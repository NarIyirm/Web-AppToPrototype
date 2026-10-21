/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { allowedWebUrl, parseWebObservation, sanitizeUrl } from '../src/core/web-capture.ts';
import { selectionScript } from '../src/features/capture/web-script.ts';

const observation = () => ({ kind: 'web_capture', epoch: 'e-current01', requestId: 'r-request01', title: '网页',
  viewport: { width: 390, height: 700 }, selection: { x: 10, y: 20, width: 100, height: 100 },
  nodes: [{ id: 'node-0', kind: 'text', bounds: { x: 5, y: 5, width: 90, height: 20 }, text: '标题', fontSize: 16, color: 'rgb(0, 0, 0)' }], warnings: [] });
const parse = (value: unknown) => parseWebObservation(JSON.stringify(value), 'e-current01', 'r-request01');
test('web observation retains selection-relative CSS geometry', () => {
  const result = parse(observation());
  assert.equal(result.nodes[0].bounds.x, 5);
  assert.equal(result.selection.x, 10);
});
test('web observation rejects stale pages, wrong requests and native command messages', () => {
  for (const value of [{ ...observation(), epoch: 'old' }, { ...observation(), requestId: 'wrong' },
    { ...observation(), kind: 'native_capture' }, null]) assert.throws(() => parse(value));
});
test('untrusted webpage attributes are not forwarded into saved nodes', () => {
  const value = observation();
  const result = parse({ ...value, cookies: 'secret', nodes: [{ ...value.nodes[0], imageUrl: 'https://example.com/?secret=1', script: 'alert(1)' }] });
  assert.equal('cookies' in result, false);
  assert.equal('imageUrl' in result.nodes[0], false);
  assert.equal('script' in result.nodes[0], false);
});
test('web geometry rejects non-finite, out-of-selection and duplicate nodes', () => {
  const value = observation();
  assert.throws(() => parse({ ...value, viewport: { width: 0, height: 700 } }));
  assert.throws(() => parse({ ...value, nodes: [value.nodes[0], value.nodes[0]] }));
  assert.throws(() => parse({ ...value, selection: { x: 380, y: 0, width: 100, height: 100 } }));
  assert.throws(() => parse({ ...value, nodes: [{ ...value.nodes[0], bounds: { x: 90, y: 0, width: 20, height: 20 } }] }));
});
test('browser entry rejects active/local schemes and credentials; source export strips query and fragment', () => {
  for (const url of ['javascript:alert(1)', 'file:///secret', 'data:text/html,test', 'https://user:pass@example.com']) assert.equal(allowedWebUrl(url), false);
  assert.equal(allowedWebUrl('https://example.com/page'), true);
  assert.equal(sanitizeUrl('https://example.com/page?token=secret#password'), 'https://example.com/page');
});
test('script identities cannot inject executable code', () => {
  assert.throws(() => selectionScript('x";alert(1)', 'browse'));
  assert.throws(() => selectionScript('e-current01', 'browse', '</script>'));
  assert.doesNotThrow(() => new Function(selectionScript('e-current01', 'rectangle', 'r-request01')));
});
