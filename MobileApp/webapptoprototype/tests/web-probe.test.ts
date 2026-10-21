/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { isProbeNavigationAllowed, parseWebProbe } from '../src/core/web-probe.ts';

const epoch = 'attempt-1';
const message = () => ({ kind: 'web_probe', epoch, text: '标题 Hello',
  viewport: { width: 390, height: 300, dpr: 3 },
  target: { x: 16, y: 24, width: 180, height: 48 },
  image: { width: 1, height: 1, loaded: true } });
const parse = (value: unknown, current = epoch) => parseWebProbe(JSON.stringify(value), current);

test('preserves CSS geometry independently from physical density', () => {
  const result = parse(message());
  assert.equal(result?.target.x, 16);
  assert.equal(result?.viewport.dpr, 3);
  assert.equal(result?.text, '标题 Hello');
});
test('navigation/restart invalidates observations from an older page', () => {
  assert.equal(parse(message(), 'attempt-2'), null);
  assert.equal(parse(message(), ''), null);
});
test('rejects malformed, oversized and non-object messages', () => {
  for (const raw of ['{', 'null', '[]', 'x'.repeat(4097)]) assert.equal(parseWebProbe(raw, epoch), null);
});
test('rejects permission requests and unknown fields rather than dispatching commands', () => {
  assert.equal(parse({ ...message(), kind: 'request_screen_capture' }), null);
  assert.equal(parse({ ...message(), path: '../secret' }), null);
  assert.equal(parse({ ...message(), image: { ...message().image, cookie: 'secret' } }), null);
});
test('rejects missing fields, wrong types and non-finite dimensions', () => {
  assert.equal(parse({ ...message(), viewport: { width: null, height: 300, dpr: 3 } }), null);
  assert.equal(parse({ ...message(), viewport: { width: '390', height: 300, dpr: 3 } }), null);
  assert.equal(parse({ ...message(), target: { x: 0, y: 0, width: -1, height: 10 } }), null);
  assert.equal(parse({ ...message(), image: { width: 0, height: 1, loaded: true } }), null);
  assert.equal(parse({ ...message(), text: 'x'.repeat(257) }), null);
});
test('records an unloaded image without inventing successful resource access', () => {
  const result = parse({ ...message(), image: { width: 0, height: 0, loaded: false } });
  assert.equal(result?.image.loaded, false);
});
test('allows only the embedded fixture and denies external schemes and lookalikes', () => {
  assert.equal(isProbeNavigationAllowed('about:blank'), true);
  for (const url of ['https://example.com', 'file:///secret', 'javascript:alert(1)',
    'about:blank.evil', 'intent://capture', 'data:text/html,test']) {
    assert.equal(isProbeNavigationAllowed(url), false);
  }
});
