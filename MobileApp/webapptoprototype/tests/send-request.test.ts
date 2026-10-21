import assert from 'node:assert/strict';
import test from 'node:test';
import { SendRequests } from '../src/core/send-request.ts';

test('a deep link cannot authorize an upload; an issued request is scoped and consumed once', () => {
  const requests = new SendRequests();
  assert.equal(requests.claim('external-url', 'p', ['c'], 0), false);
  requests.issue('nonce', 'p', ['c1', 'c2'], 10);
  assert.equal(requests.claim('nonce', 'other', ['c1', 'c2'], 11), false);
  assert.equal(requests.claim('nonce', 'p', ['c1'], 11), false);
  assert.equal(requests.claim('nonce', 'p', ['c2', 'c1'], 11), true);
  assert.equal(requests.claim('nonce', 'p', ['c1', 'c2'], 11), false);
});
test('abandoned send requests expire and are bounded; invalid selections do not create requests', () => {
  const requests = new SendRequests();
  requests.issue('expired', 'p', ['c'], 0);
  assert.equal(requests.has('expired', 'p', ['c'], 15 * 60_000), false);
  for (let index = 0; index < 9; index++) requests.issue(String(index), 'p', ['c'], 20);
  assert.equal(requests.has('0', 'p', ['c'], 21), false);
  assert.equal(requests.has('8', 'p', ['c'], 21), true);
  assert.throws(() => requests.issue('invalid', 'p', []));
  assert.throws(() => requests.issue('invalid', 'p', ['c', 'c']));
});
