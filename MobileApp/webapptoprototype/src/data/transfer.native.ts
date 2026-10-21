import * as Device from 'expo-device';
import { File } from 'expo-file-system';
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';

import { parseTransferReceipt, type PairingOffer, type TransferReceipt } from '@/core/pairing';

import { newId } from './app-state';
import { fileDigest } from './file-digest';
import { createLanTransport } from './lan-transport.native';

type Transport = { request(endpoint: string, pin: string, path: string, method: string, token: string, body: string): Promise<string>;
  chunk(endpoint: string, pin: string, path: string, token: string, uri: string, offset: number, length: number): Promise<string> };
const native = isRunningInExpoGo() ? null : requireOptionalNativeModule<Transport>('MobileTransfer');
type Wire = { request(path: string, method: string, token: string, body: string): Promise<string>;
  chunk(path: string, token: string, uri: string, offset: number, length: number): Promise<string> };
let session: { offer: PairingOffer; token: string; expiresAt: number; wire: Wire } | null = null;
let generation = 0;
export const transferAvailable = true;
export async function pairDesktop(offer: PairingOffer): Promise<string> {
  const attempt = ++generation;
  session = null;
  const wire: Wire = native ? {
    request: (path, method, token, body) => native.request(offer.endpoint, offer.certificateSha256, path, method, token, body),
    chunk: (path, token, uri, offset, length) => native.chunk(offer.endpoint, offer.certificateSha256, path, token, uri, offset, length),
  } : offer.protocol === 'w2p-mobile-2' ? await createLanTransport(offer) : (() => { throw Error('请更新电脑端并重新生成二维码，再用手机扫码连接。'); })();
  const result = JSON.parse(await wire.request('/mobile/pair', 'POST', '',
    JSON.stringify({ code: offer.code, deviceId: newId('d'), deviceName: (Device.modelName ?? '我的手机').slice(0, 80) }))) as { sessionToken: string; expiresAt: number; chunkBytes: number };
  if (!/^[a-f0-9]{64}$/.test(result.sessionToken) || !Number.isSafeInteger(result.expiresAt) || result.expiresAt <= Date.now()
    || result.expiresAt > Date.now() + 15 * 60_000 || result.chunkBytes !== 262144) throw new Error('配对回执无效。');
  if (attempt !== generation) throw Error('连接操作已取消。');
  session = { offer, token: result.sessionToken, expiresAt: result.expiresAt, wire };
  return offer.desktopName;
}
export async function transferBundle(bundle: { uri: string; packageId: string }, progress: (value: number) => void, cancelled: () => boolean): Promise<TransferReceipt> {
  const selected = session;
  if (!selected || selected.expiresAt <= Date.now()) throw new Error('电脑连接已过期，请重新扫码配对。');
  const file = new File(bundle.uri), bytes = file.size, hash = await fileDigest(file);
  if (!file.exists || bytes < 1 || bytes > 64 * 1024 * 1024) throw new Error('素材包缺失或超过 64 MiB。');
  const { wire, token } = selected;
  const check = () => { if (cancelled() || session !== selected) throw new Error('传输已暂停。可保留当前素材包并重试。'); };
  check();
  const request = async (path: string, method = 'GET', body = '') => wire.request(path, method, token, body);
  let receipt = parseTransferReceipt(await request('/mobile/uploads', 'POST', JSON.stringify({ packageId: bundle.packageId, sha256: hash, bytes })), hash, bytes);
  while (receipt.nextOffset < bytes) {
    check(); const offset = receipt.nextOffset, length = Math.min(262144, bytes - offset);
    try {
      receipt = parseTransferReceipt(await wire.chunk(`/mobile/uploads/${hash}/${offset}`, token, bundle.uri, offset, length), hash, bytes);
      if (receipt.nextOffset < offset + length) throw new Error('电脑没有确认当前分块。');
    } catch (cause) {
      check();
      // A lost acknowledgement may have committed the chunk. Query before retrying.
      try { receipt = parseTransferReceipt(await request(`/mobile/uploads/${hash}`), hash, bytes); }
      catch { throw new Error(`连接中断，素材包仍保留，可点击重试续传。${cause instanceof Error ? cause.message.slice(0, 100) : ''}`); }
      if (receipt.nextOffset <= offset) throw new Error('连接未完成当前分块，请点击重试续传。');
    }
    progress(receipt.nextOffset / bytes);
  }
  check();
  receipt = parseTransferReceipt(await request(`/mobile/uploads/${hash}/commit`, 'POST', '{}'), hash, bytes);
  if (receipt.status !== 'received') throw new Error('电脑尚未确认完整素材包。');
  progress(1); return receipt;
}
export async function disconnectDesktop() {
  const previous = session; session = null; generation++;
  if (previous) { try { await previous.wire.request('/mobile/disconnect', 'POST', previous.token, '{}'); } catch { /* Local disconnect must work while offline. */ } }
}
export function connectedDesktop() { return session && session.expiresAt > Date.now() ? session.offer.desktopName : null; }
export async function checkDesktopConnection(): Promise<boolean> {
  const selected = session;
  if (!selected || selected.expiresAt <= Date.now()) { if (session === selected) session = null; return false; }
  try {
    const value = JSON.parse(await selected.wire.request('/mobile/session', 'GET', selected.token, ''));
    if (value.connected !== true || value.expiresAt !== selected.expiresAt) throw Error('M_SESSION_REQUIRED');
    return session === selected;
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes('M_SESSION_REQUIRED')) { if (session === selected) session = null; return false; }
    throw cause;
  }
}
