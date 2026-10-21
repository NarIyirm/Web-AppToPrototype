type OfferBase = { endpoint: string; certificateSha256: string; code: string; expiresAt: number; desktopName: string };
export type PairingOffer = OfferBase & ({ protocol: 'w2p-mobile-1' } | { protocol: 'w2p-mobile-2'; lan: { endpoint: string; key: string; id: string } });
export function parsePairingOffer(raw: string, now = Date.now()): PairingOffer {
  if (raw.length > 4096) throw new Error('配对码过大。');
  let offer: PairingOffer;
  try { offer = JSON.parse(raw) as PairingOffer; } catch { throw Error('这不是电脑配对信息。请扫描电脑“手机收件箱”里的二维码。'); }
  if (!offer || !['w2p-mobile-1', 'w2p-mobile-2'].includes(offer.protocol)
    || Object.keys(offer).sort().join(',') !== (offer.protocol === 'w2p-mobile-2' ? 'certificateSha256,code,desktopName,endpoint,expiresAt,lan,protocol' : 'certificateSha256,code,desktopName,endpoint,expiresAt,protocol')
    || typeof offer.endpoint !== 'string' || !/^[a-f0-9]{64}$/.test(offer.certificateSha256) || !/^[a-f0-9]{64}$/.test(offer.code)
    || typeof offer.desktopName !== 'string' || !offer.desktopName.trim() || offer.desktopName.length > 80
    || !Number.isSafeInteger(offer.expiresAt) || offer.expiresAt <= now || offer.expiresAt > now + 120_000) throw new Error('配对码无效或已过期，请在电脑重新生成。');
  let url: URL;
  try { url = new URL(offer.endpoint); } catch { throw Error('电脑配对地址无效，请重新扫码。'); }
  const ip = url.hostname.split('.').map(Number);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/'
    || !/^https:\/\/(\d{1,3}\.){3}\d{1,3}:\d+$/.test(offer.endpoint) || Number(url.port) < 1024 || Number(url.port) > 65535
    || url.hostname !== offer.endpoint.slice(8).split(':')[0] || ip.length !== 4 || !ip.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    || !(ip[0] === 10 || ip[0] === 192 && ip[1] === 168 || ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)) throw new Error('只支持局域网 HTTPS 配对地址。');
  if (offer.protocol === 'w2p-mobile-2') {
    const lan = offer.lan;
    if (!lan || Object.keys(lan).sort().join(',') !== 'endpoint,id,key' || !/^[a-f0-9]{64}$/.test(lan.key) || !/^[a-f0-9]{32}$/.test(lan.id)
      || typeof lan.endpoint !== 'string' || !/^http:\/\/(\d{1,3}\.){3}\d{1,3}:\d+$/.test(lan.endpoint)) throw Error('局域网配对信息不完整，请重新扫码。');
    const local = new URL(lan.endpoint);
    if (local.hostname !== lan.endpoint.slice(7).split(':')[0] || local.hostname !== url.hostname || Number(local.port) < 1024 || Number(local.port) > 65535) throw Error('局域网配对地址不一致，请重新扫码。');
  }
  return offer;
}
export type TransferReceipt = { uploadId: string; nextOffset: number; bytes: number; status: 'receiving' | 'received'; converted: false; figmaImported: false };
export function parseTransferReceipt(raw: string, hash: string, bytes: number): TransferReceipt {
  const value = JSON.parse(raw) as TransferReceipt;
  if (!value || value.uploadId !== hash || value.bytes !== bytes || !Number.isSafeInteger(value.nextOffset) || value.nextOffset < 0 || value.nextOffset > bytes
    || !['receiving', 'received'].includes(value.status) || value.status === 'received' && value.nextOffset !== bytes
    || value.converted !== false || value.figmaImported !== false) throw new Error('电脑传输回执无效。');
  return value;
}
