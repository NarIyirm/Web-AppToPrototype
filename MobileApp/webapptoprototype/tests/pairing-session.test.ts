import assert from 'node:assert/strict';
import test from 'node:test';
import { establishPairingSession, parsePairingReceipt } from '../src/core/pairing-session.ts';
import type { PairingWire } from '../src/core/pairing-wire.ts';
import { transferError } from '../src/core/transfer-error.ts';

const duration = 15 * 60_000, desktopNow = 2_000_000;
const receipt = { sessionToken: 'a'.repeat(64), expiresAt: desktopNow + duration, chunkBytes: 262144, serverTime: desktopNow };

test('authenticated desktop duration works independently of a phone clock ahead or behind', () => {
  for (const skew of [-3 * 60 * 60_000, -1000, 0, 1000, 3 * 60 * 60_000]) {
    const startedAt = desktopNow + skew - 500, receivedAt = desktopNow + skew + 50;
    const parsed = parsePairingReceipt(receipt, startedAt, receivedAt);
    assert.equal(parsed.expiresAt, receipt.expiresAt);
    assert.equal(parsed.localExpiresAt, startedAt + duration);
    assert.ok(parsed.localExpiresAt - receivedAt <= duration);
  }
});

test('legacy receipt tolerates the one-second drift that the previous strict upper bound rejected', () => {
  const { serverTime: _, ...legacy } = receipt;
  const phoneNow = desktopNow - 1000;
  assert.ok(legacy.expiresAt > phoneNow + duration);
  const parsed = parsePairingReceipt(legacy, phoneNow - 50, phoneNow);
  assert.equal(parsed.localExpiresAt, phoneNow - 50 + duration);
  assert.throws(() => parsePairingReceipt(legacy, desktopNow - 121_000, desktopNow - 121_000), /M_PAIR_RECEIPT_CLOCK/);
  assert.throws(() => parsePairingReceipt(legacy, legacy.expiresAt, legacy.expiresAt), /M_PAIR_RECEIPT_CLOCK/);
});

test('receipt errors identify only the failed field, never expose the credential, and reject invalid lifetimes', () => {
  for (const [change, code] of [
    [{ sessionToken: null }, 'TOKEN'], [{ sessionToken: 123 }, 'TOKEN'], [{ sessionToken: 'invalid' }, 'TOKEN'],
    [{ expiresAt: String(receipt.expiresAt) }, 'FORMAT'], [{ expiresAt: 0.5 }, 'FORMAT'],
    [{ chunkBytes: '262144' }, 'CHUNK'], [{ chunkBytes: 65536 }, 'CHUNK'],
    [{ serverTime: null }, 'FORMAT'], [{ serverTime: desktopNow - 1 }, 'LIFETIME'],
    [{ serverTime: receipt.expiresAt }, 'LIFETIME'],
  ] as const) {
    assert.throws(() => parsePairingReceipt({ ...receipt, ...change }, desktopNow, desktopNow + 10),
      (cause: Error) => {
        assert.equal(cause.message, `M_PAIR_RECEIPT_${code}`);
        assert.ok(!transferError(cause).includes(receipt.sessionToken));
        assert.ok(transferError(cause).includes(cause.message));
        return true;
      });
  }
  for (const value of [null, 'text', [], {}]) assert.throws(() => parsePairingReceipt(value, desktopNow, desktopNow));
  assert.throws(() => parsePairingReceipt(receipt, desktopNow - duration, desktopNow), /LIFETIME/);
});

function mockWire(pairValue: unknown = receipt, status: unknown = { connected: true, expiresAt: receipt.expiresAt }) {
  const calls: unknown[][] = [];
  const wire: PairingWire = {
    async request(...args) {
      calls.push(args);
      if (args[0] === '/mobile/pair') return JSON.stringify(pairValue);
      if (args[0] === '/mobile/session') return JSON.stringify(status);
      return '{}';
    },
    async chunk() { throw Error('unexpected chunk'); },
  };
  return { calls, wire };
}

test('pairing uses its returned token to confirm the session before reporting success', async () => {
  const { wire, calls } = mockWire();
  const result = await establishPairingSession(wire, '{"code":"qr"}', () => true, () => desktopNow);
  assert.equal(result.token, receipt.sessionToken);
  assert.deepEqual(calls, [['/mobile/pair', 'POST', '', '{"code":"qr"}'], ['/mobile/session', 'GET', receipt.sessionToken, '']]);
});

test('a rejected receipt, failed confirmation or cancellation revokes the issued session', async () => {
  for (const [pairValue, status, current, error] of [
    [{ ...receipt, chunkBytes: 1 }, {}, () => true, /M_PAIR_RECEIPT_CHUNK/],
    [receipt, { connected: false, expiresAt: receipt.expiresAt }, () => true, /M_PAIR_CONFIRMATION/],
    [receipt, { connected: true, expiresAt: receipt.expiresAt + 1 }, () => true, /M_PAIR_CONFIRMATION/],
    [receipt, null, () => true, /M_PAIR_CONFIRMATION/],
    [receipt, {}, () => false, /已取消/],
  ] as const) {
    const { wire, calls } = mockWire(pairValue, status);
    await assert.rejects(establishPairingSession(wire, '{}', current, () => desktopNow), error);
    assert.deepEqual(calls.at(-1), ['/mobile/disconnect', 'POST', receipt.sessionToken, '{}']);
  }
  const { wire, calls } = mockWire({ ...receipt, sessionToken: 'invalid' });
  await assert.rejects(establishPairingSession(wire, '{}', () => true, () => desktopNow), /M_PAIR_RECEIPT_TOKEN/);
  assert.equal(calls.length, 1);
});

test('confirmation failures and offline cleanup preserve the original failure', async () => {
  const { wire, calls } = mockWire();
  const request = wire.request;
  wire.request = async (...args) => {
    if (args[0] === '/mobile/pair') return request(...args);
    calls.push(args);
    throw Error(args[0] === '/mobile/session' ? 'M_SESSION_REQUIRED' : 'M_CONNECTION');
  };
  await assert.rejects(establishPairingSession(wire, '{}', () => true, () => desktopNow), /M_SESSION_REQUIRED/);
  assert.equal(calls.length, 3);
});

test('malformed pair and confirmation JSON produce bounded diagnostic errors', async () => {
  for (const path of ['/mobile/pair', '/mobile/session']) {
    const { wire, calls } = mockWire();
    const request = wire.request;
    wire.request = async (...args) => args[0] === path ? '{broken' : request(...args);
    await assert.rejects(establishPairingSession(wire, '{}', () => true, () => desktopNow),
      path === '/mobile/pair' ? /M_PAIR_RECEIPT_FORMAT/ : /M_PAIR_CONFIRMATION/);
    if (path === '/mobile/session') assert.deepEqual(calls.at(-1), ['/mobile/disconnect', 'POST', receipt.sessionToken, '{}']);
  }
});

test('cancellation during confirmation revokes the session instead of reconnecting locally', async () => {
  const { wire, calls } = mockWire();
  let active = true;
  const request = wire.request;
  wire.request = async (...args) => {
    if (args[0] === '/mobile/session') active = false;
    return request(...args);
  };
  await assert.rejects(establishPairingSession(wire, '{}', () => active, () => desktopNow), /已取消/);
  assert.deepEqual(calls.at(-1), ['/mobile/disconnect', 'POST', receipt.sessionToken, '{}']);
});
