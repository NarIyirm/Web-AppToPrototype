export const LAN_WIRE_LIMIT = 512 * 1024;
export const LAN_CHUNK = 256 * 1024;
export type LanEnvelope = { id: string; body: string };
export const encode64 = (bytes: Uint8Array): string => {
  let value = '';
  for (let index = 0; index < bytes.length; index += 8192) value += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(value);
};
export function decode64(value: string, max: number): Uint8Array {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 || value.length % 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error('M_WIRE_FORMAT');
  const decoded = atob(value);
  if (decoded.length > max) throw Error('M_BODY_LIMIT');
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}
export function parseEnvelope(raw: string): LanEnvelope {
  if (raw.length > LAN_WIRE_LIMIT) throw Error('M_BODY_LIMIT');
  const value = JSON.parse(raw) as LanEnvelope;
  if (!value || Object.keys(value).sort().join(',') !== 'body,id' || !/^[a-f0-9]{32}$/.test(value.id)
    || typeof value.body !== 'string' || value.body.length < 40 || value.body.length > LAN_WIRE_LIMIT - 64) throw Error('M_WIRE_FORMAT');
  return value;
}
export const lanAad = (direction: 'request' | 'response', pairingId: string, requestId: string) =>
  new TextEncoder().encode(`w2p-mobile-2/${direction}/${pairingId}/${requestId}`);
export const lanKeyInfo = (direction: 'request' | 'response') => new TextEncoder().encode(`w2p-mobile-2/${direction}`);
export function allowedLanRequest(method: string, path: string): boolean {
  return method === 'POST' && ['/mobile/pair', '/mobile/uploads', '/mobile/disconnect'].includes(path)
    || method === 'GET' && path === '/mobile/session'
    || method === 'GET' && /^\/mobile\/uploads\/[a-f0-9]{64}$/.test(path)
    || method === 'PUT' && /^\/mobile\/uploads\/[a-f0-9]{64}\/\d{1,8}$/.test(path)
    || method === 'POST' && /^\/mobile\/uploads\/[a-f0-9]{64}\/commit$/.test(path);
}
