import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MobileReceiver } from '../apps/desktop/src/mobile-receiver';
import { LanClient } from '../packages/mobile-lan/v2/lan-client';
import { lanKeyInfo, LAN_CHUNK } from '../packages/mobile-lan/v2/lan-wire';

test('LAN: mobile client pairs, sends encrypted chunks, resumes, commits and disconnects through the real receiver', async () => {
  const receiver = new MobileReceiver(resolve('.runtime/mobile-lan', randomUUID()), async () => true);
  try {
    const { offers } = await receiver.start('127.0.0.1'), offer = JSON.parse(offers[0].payload);
    assert.equal(offer.protocol, 'w2p-mobile-2');
    const derive = (direction: 'request' | 'response') => Buffer.from(hkdfSync('sha256', Buffer.from(offer.lan.key, 'hex'), Buffer.from(offer.lan.id, 'hex'), lanKeyInfo(direction), 32));
    const requestKey = derive('request'), responseKey = derive('response');
    let savedRequest = '';
    const client = new LanClient(offer.lan.endpoint, offer.lan.id, {
      async randomId() { return randomBytes(16).toString('hex'); },
      async seal(bytes, aad) {
        const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', requestKey, nonce);
        cipher.setAAD(aad);
        const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
        return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64');
      },
      async open(base64, aad) {
        const sealed = Buffer.from(base64, 'base64'), decipher = createDecipheriv('aes-256-gcm', responseKey, sealed.subarray(0, 12));
        decipher.setAAD(aad); decipher.setAuthTag(sealed.subarray(-16));
        return Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]);
      },
    }, async (url, body, signal) => {
      if (!savedRequest) savedRequest = body;
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal });
      return { status: response.status, body: await response.text() };
    });
    const call = (path: string, method = 'GET', token = '', body = '') => client.request(path, method, token, new TextEncoder().encode(body));
    const session = JSON.parse(await call('/mobile/pair', 'POST', '', JSON.stringify({ code: offer.code, deviceId: 'd-device0001', deviceName: '我的 iPhone' })));
    assert.match(session.sessionToken, /^[a-f0-9]{64}$/);
    assert.equal(receiver.status().connected, false);
    assert.equal(session.expiresAt - session.serverTime, 15 * 60_000);
    assert.ok(!savedRequest.includes(offer.code) && !savedRequest.includes('我的 iPhone'));
    const replay = await fetch(`${offer.lan.endpoint}/mobile/secure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: savedRequest });
    assert.equal(replay.status, 400);
    const changed = JSON.parse(savedRequest); changed.id = randomBytes(16).toString('hex');
    assert.equal((await fetch(`${offer.lan.endpoint}/mobile/secure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changed) })).status, 400);
    assert.equal((await fetch(`${offer.lan.endpoint}/mobile/secure`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' }, body: savedRequest })).status, 403);
    const token = session.sessionToken;
    assert.equal(JSON.parse(await call('/mobile/session', 'GET', token)).connected, true);
    assert.equal(receiver.status().connected, true);
    // Exercise the largest actual mobile chunk (nested base64 stays below the
    // wire budget), not only the small ZIP fixture used for final conversion.
    const large = Buffer.alloc(LAN_CHUNK + 17, 0x37), largeSha = createHash('sha256').update(large).digest('hex');
    await call('/mobile/uploads', 'POST', token, JSON.stringify({ sha256: largeSha, bytes: large.length, packageId: 'b-largechunk0001' }));
    assert.equal(JSON.parse(await client.request(`/mobile/uploads/${largeSha}/0`, 'PUT', token, large.subarray(0, LAN_CHUNK))).nextOffset, LAN_CHUNK);
    assert.equal(JSON.parse(await client.request(`/mobile/uploads/${largeSha}/${LAN_CHUNK}`, 'PUT', token, large.subarray(LAN_CHUNK))).nextOffset, large.length);
    await assert.rejects(call('/mobile/pair', 'POST', '', JSON.stringify({ code: offer.code, deviceId: 'd-device0002', deviceName: '重复配对' })), /M_PAIR_EXPIRED/);
    const bytes = await readFile('examples/mobile-material.w2pm.zip'), sha = createHash('sha256').update(bytes).digest('hex');
    const packageId = 'b-05492ef9-ccb7-41b9-9455-49bfcc5741ab', path = `/mobile/uploads/${sha}`;
    await call('/mobile/uploads', 'POST', token, JSON.stringify({ sha256: sha, bytes: bytes.length, packageId }));
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = bytes.subarray(offset, offset + LAN_CHUNK);
      const receipt = JSON.parse(await client.request(`${path}/${offset}`, 'PUT', token, chunk));
      assert.equal(JSON.parse(await call(path, 'GET', token)).nextOffset, offset + chunk.length);
      // Re-sending an acknowledged chunk must not append it twice.
      assert.equal(JSON.parse(await client.request(`${path}/${offset}`, 'PUT', token, chunk)).nextOffset, receipt.nextOffset);
      offset = receipt.nextOffset;
    }
    const done = JSON.parse(await call(`${path}/commit`, 'POST', token, '{}'));
    assert.equal(done.status, 'received'); assert.equal(done.figmaImported, false); assert.equal(done.converted, false);
    assert.deepEqual(await readFile(await receiver.path(sha)), bytes);
    assert.equal((await receiver.list()).length, 1);
    await call('/mobile/disconnect', 'POST', token, '{}');
    await assert.rejects(call('/mobile/session', 'GET', token), /M_SESSION_REQUIRED/);
  } finally { await receiver.stop(); }
});

