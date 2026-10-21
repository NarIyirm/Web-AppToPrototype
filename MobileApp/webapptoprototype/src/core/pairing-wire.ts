import type { PairingOffer } from './pairing';

export type PairingWire = {
  request(path: string, method: string, token: string, body: string): Promise<string>;
  chunk(path: string, token: string, uri: string, offset: number, length: number): Promise<string>;
};
export type NativeTransfer = {
  request(endpoint: string, pin: string, path: string, method: string, token: string, body: string): Promise<string>;
  chunk(endpoint: string, pin: string, path: string, token: string, uri: string, offset: number, length: number): Promise<string>;
};

export async function createPairingWire(offer: PairingOffer, platform: string, native: NativeTransfer | null,
  encrypted: (offer: Extract<PairingOffer, { protocol: 'w2p-mobile-2' }>) => Promise<PairingWire>): Promise<PairingWire> {
  // Use the same authenticated v2 channel in Expo Go and standalone iOS builds.
  // Select before sending a pairing request; never retry a failed authentication on another channel.
  if (offer.protocol === 'w2p-mobile-2' && (platform === 'ios' || !native)) return encrypted(offer);
  if (!native) throw Error('请更新电脑端并重新生成二维码，再用手机扫码连接。');
  return {
    request: (path, method, token, body) => native.request(offer.endpoint, offer.certificateSha256, path, method, token, body),
    chunk: (path, token, uri, offset, length) => native.chunk(offer.endpoint, offer.certificateSha256, path, token, uri, offset, length),
  };
}
