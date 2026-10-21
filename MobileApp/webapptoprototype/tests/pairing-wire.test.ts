import assert from 'node:assert/strict';
import test from 'node:test';

import type { PairingOffer } from '../src/core/pairing.ts';
import { createPairingWire, type NativeTransfer, type PairingWire } from '../src/core/pairing-wire.ts';

const legacy: PairingOffer = { protocol: 'w2p-mobile-1', endpoint: 'https://192.168.1.25:53515',
  certificateSha256: 'a'.repeat(64), code: 'b'.repeat(64), expiresAt: Date.now() + 120000, desktopName: '电脑' };
const offer: PairingOffer = { ...legacy, protocol: 'w2p-mobile-2',
  lan: { endpoint: 'http://192.168.1.25:53516', key: 'c'.repeat(64), id: 'd'.repeat(32) } };
const unreachableNative: NativeTransfer = {
  async request() { throw Error('native TLS must not be used'); },
  async chunk() { throw Error('native TLS must not be used'); },
};

test('standalone iOS uses the same v2 pairing, session and chunk channel as Expo Go', async () => {
  for (const native of [null, unreachableNative]) {
    const calls: unknown[][] = [];
    const wire: PairingWire = {
      async request(...args) { calls.push(args); return 'encrypted response'; },
      async chunk(...args) { calls.push(args); return 'encrypted receipt'; },
    };
    const selected = await createPairingWire(offer, 'ios', native, async (value) => {
      assert.equal(value.lan.endpoint, offer.lan.endpoint); return wire;
    });
    assert.equal(await selected.request('/mobile/pair', 'POST', '', '{}'), 'encrypted response');
    await selected.request('/mobile/session', 'GET', 'session-token', '');
    assert.equal(await selected.chunk('/mobile/uploads/hash/0', 'session-token', 'file:///bundle', 0, 262144), 'encrypted receipt');
    assert.deepEqual(calls, [['/mobile/pair', 'POST', '', '{}'], ['/mobile/session', 'GET', 'session-token', ''],
      ['/mobile/uploads/hash/0', 'session-token', 'file:///bundle', 0, 262144]]);
  }
});

test('an encrypted authentication failure is not retried on a different channel', async () => {
  await assert.rejects(createPairingWire(offer, 'ios', unreachableNative, async () => {
    throw Error('authenticationFailure');
  }), /authenticationFailure/);
  const selected = await createPairingWire(offer, 'ios', unreachableNative, async () => ({
    async request() { throw Error('M_RESPONSE_ID'); }, async chunk() { throw Error('M_RESPONSE_ID'); },
  }));
  await assert.rejects(selected.request('/mobile/pair', 'POST', '', '{}'), /M_RESPONSE_ID/);
});

test('legacy offers and Android standalone retain pinned HTTPS; Expo Go requires v2', async () => {
  const calls: unknown[][] = [];
  const native: NativeTransfer = {
    async request(...args) { calls.push(args); return 'pinned response'; },
    async chunk(...args) { calls.push(args); return 'pinned receipt'; },
  };
  for (const [value, platform] of [[legacy, 'ios'], [offer, 'android']] as const) {
    const selected = await createPairingWire(value, platform, native, async () => { throw Error('unexpected encrypted channel'); });
    await selected.request('/mobile/pair', 'POST', '', '{}');
    await selected.chunk('/mobile/uploads/hash/0', 'token', 'file:///bundle', 0, 256);
    assert.deepEqual(calls.splice(0), [[value.endpoint, value.certificateSha256, '/mobile/pair', 'POST', '', '{}'],
      [value.endpoint, value.certificateSha256, '/mobile/uploads/hash/0', 'token', 'file:///bundle', 0, 256]]);
  }
  await assert.rejects(createPairingWire(legacy, 'ios', null, async () => { throw Error('unexpected encrypted channel'); }), /更新电脑端/);
});
