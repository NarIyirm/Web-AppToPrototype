import type { PairingWire } from './pairing-wire';

const SESSION_MS = 15 * 60_000;
const LEGACY_CLOCK_TOLERANCE_MS = 2 * 60_000;
type PairingReceipt = { sessionToken: string; expiresAt: number; chunkBytes: number; serverTime?: number };
export type PairedSession = { token: string; expiresAt: number; localExpiresAt: number };

export function parsePairingReceipt(value: unknown, startedAt: number, receivedAt: number): PairedSession {
  if (!value || typeof value !== 'object') throw Error('M_PAIR_RECEIPT_FORMAT');
  const result = value as PairingReceipt;
  if (typeof result.sessionToken !== 'string' || !/^[a-f0-9]{64}$/.test(result.sessionToken)) throw Error('M_PAIR_RECEIPT_TOKEN');
  if (!Number.isSafeInteger(result.expiresAt)) throw Error('M_PAIR_RECEIPT_FORMAT');
  if (result.chunkBytes !== 262144) throw Error('M_PAIR_RECEIPT_CHUNK');
  let localExpiresAt: number;
  if (result.serverTime !== undefined) {
    if (!Number.isSafeInteger(result.serverTime)) throw Error('M_PAIR_RECEIPT_FORMAT');
    const remaining = result.expiresAt - result.serverTime;
    if (remaining <= 0 || remaining > SESSION_MS) throw Error('M_PAIR_RECEIPT_LIFETIME');
    // Use a duration from the authenticated desktop reply, not a comparison of
    // two devices' wall clocks. Charging the whole request time is conservative.
    localExpiresAt = startedAt + remaining;
  } else {
    // Older desktops do not include serverTime. Allow small synchronization
    // differences, but never keep a local session for longer than 15 minutes.
    const remaining = result.expiresAt - receivedAt;
    if (remaining <= 0 || remaining > SESSION_MS + LEGACY_CLOCK_TOLERANCE_MS) throw Error('M_PAIR_RECEIPT_CLOCK');
    localExpiresAt = Math.min(result.expiresAt, startedAt + SESSION_MS);
  }
  if (localExpiresAt <= receivedAt) throw Error('M_PAIR_RECEIPT_LIFETIME');
  return { token: result.sessionToken, expiresAt: result.expiresAt, localExpiresAt };
}

export async function establishPairingSession(wire: PairingWire, body: string,
  current: () => boolean, now = Date.now): Promise<PairedSession> {
  const startedAt = now();
  const raw = await wire.request('/mobile/pair', 'POST', '', body);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error('M_PAIR_RECEIPT_FORMAT'); }
  try {
    const selected = parsePairingReceipt(value, startedAt, now());
    if (!current()) throw Error('连接操作已取消。');
    // Prove the phone accepted the receipt and can use its token before either
    // side reports a completed connection.
    const confirmation = await wire.request('/mobile/session', 'GET', selected.token, '');
    let status: { connected?: unknown; expiresAt?: unknown } | null;
    try { status = JSON.parse(confirmation); } catch { throw Error('M_PAIR_CONFIRMATION'); }
    if (!status || status.connected !== true || status.expiresAt !== selected.expiresAt) throw Error('M_PAIR_CONFIRMATION');
    if (!current()) throw Error('连接操作已取消。');
    if (selected.localExpiresAt <= now()) throw Error('M_PAIR_RECEIPT_LIFETIME');
    return selected;
  } catch (cause) {
    const token = value && typeof value === 'object' ? (value as PairingReceipt).sessionToken : undefined;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      try { await wire.request('/mobile/disconnect', 'POST', token, '{}'); } catch { /* Local pairing must still fail while offline. */ }
    }
    throw cause;
  }
}
