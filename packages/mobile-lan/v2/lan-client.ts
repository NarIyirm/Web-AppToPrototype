import { allowedLanRequest, decode64, encode64, lanAad, parseEnvelope, LAN_CHUNK } from './lan-wire.ts';

export type LanCrypto = {
  randomId(): Promise<string>;
  seal(bytes: Uint8Array, aad: Uint8Array): Promise<string>;
  open(base64: string, aad: Uint8Array): Promise<Uint8Array>;
};
export type LanHttp = (url: string, body: string, signal: AbortSignal) => Promise<{ status: number; body: string }>;
export class LanClient {
  constructor(private endpoint: string, private pairingId: string, private crypto: LanCrypto, private http: LanHttp) {}
  async request(path: string, method: string, token: string, body = new Uint8Array()): Promise<string> {
    if (!allowedLanRequest(method, path) || body.length > (method === 'PUT' ? LAN_CHUNK : 4096)) throw Error('M_ROUTE');
    const id = await this.crypto.randomId();
    const bytes = new TextEncoder().encode(JSON.stringify({ method, path, token, body: encode64(body) }));
    const sealed = await this.crypto.seal(bytes, lanAad('request', this.pairingId, id));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), path === '/mobile/pair' ? 90_000 : 30_000);
    try {
      const response = await this.http(`${this.endpoint}/mobile/secure`, JSON.stringify({ id, body: sealed }), controller.signal);
      if (response.status !== 200 || response.body.length > 32 * 1024) throw Error('M_CONNECTION');
      const envelope = parseEnvelope(response.body);
      if (envelope.id !== id) throw Error('M_RESPONSE_ID');
      const plain = await this.crypto.open(envelope.body, lanAad('response', this.pairingId, id));
      if (plain.length > 8192) throw Error('M_BODY_LIMIT');
      const result = JSON.parse(new TextDecoder().decode(plain)) as { status: number; body: string };
      if (!Number.isInteger(result.status) || typeof result.body !== 'string' || result.body.length > 4096) throw Error('M_RESPONSE_FORMAT');
      if (result.status !== 200) {
        let code = 'M_REQUEST_FAILED';
        try { const value = JSON.parse(result.body); if (typeof value.error === 'string' && /^M_[A-Z_]+$/.test(value.error)) code = value.error; } catch { /* Keep bounded generic error. */ }
        throw Error(code);
      }
      return result.body;
    } finally { clearTimeout(timer); }
  }
}

// Kept here for adapters and cross-platform protocol tests.
export { decode64 };
