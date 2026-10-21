import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytesAsync } from 'expo-crypto';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { LanClient } from '@/core/lan-client';
import { lanKeyInfo } from '@/core/lan-wire';
import type { PairingOffer } from '@/core/pairing';

const hexBytes = (value: string) => Uint8Array.from(value.match(/../g)!, (byte) => parseInt(byte, 16));
export async function createLanTransport(offer: Extract<PairingOffer, { protocol: 'w2p-mobile-2' }>) {
  const secret = hexBytes(offer.lan.key), salt = hexBytes(offer.lan.id);
  const incoming = await AESEncryptionKey.import(hkdf(sha256, secret, salt, lanKeyInfo('response'), 32));
  const outgoing = await AESEncryptionKey.import(hkdf(sha256, secret, salt, lanKeyInfo('request'), 32));
  secret.fill(0);
  const client = new LanClient(offer.lan.endpoint, offer.lan.id, {
    async randomId() { return Array.from(await getRandomBytesAsync(16), (byte) => byte.toString(16).padStart(2, '0')).join(''); },
    async seal(bytes, additionalData) {
      const sealed = await aesEncryptAsync(bytes, outgoing, { additionalData });
      return sealed.combined('base64');
    },
    async open(body, additionalData) { return aesDecryptAsync(AESSealedData.fromCombined(body), incoming, { additionalData }); },
  }, async (url, body, signal) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal, redirect: 'error' });
    if (response.url && response.url !== url || Number(response.headers.get('content-length')) > 32 * 1024) throw Error('M_RESPONSE_FORMAT');
    const reader = response.body?.getReader();
    if (!reader) throw Error('M_CONNECTION');
    let text = '', size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length; if (size > 32 * 1024) { await reader.cancel(); throw Error('M_BODY_LIMIT'); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { reader.releaseLock(); }
    return { status: response.status, body: text };
  });
  return {
    request: (path: string, method: string, token: string, body: string) => client.request(path, method, token, new TextEncoder().encode(body)),
    async chunk(path: string, token: string, uri: string, offset: number, length: number) {
      const handle = new File(uri).open();
      try {
        handle.offset = offset;
        const bytes = handle.readBytes(length);
        if (bytes.length !== length) throw Error('素材包读取不完整，请重新发送。');
        return await client.request(path, 'PUT', token, bytes);
      } finally { handle.close(); }
    },
  };
}
