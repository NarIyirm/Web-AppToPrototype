import { createServer, type IncomingMessage, type ServerResponse, type IncomingHttpHeaders } from 'node:http';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { allowedLanRequest, decode64, lanAad, lanKeyInfo, parseEnvelope, LAN_CHUNK, LAN_WIRE_LIMIT } from '../../../packages/mobile-lan/v2/lan-wire';

export type MobileRequest = { method?: string; url?: string; headers: IncomingHttpHeaders;
  remoteAddress: string; readBody(max: number): Promise<Buffer> };
export type MobileReply = { headersSent: boolean; json(status: number, value: unknown): void; destroy(): void };
export async function readRequestBody(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Error('M_BODY_LIMIT'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
export const mobileRequest = (req: IncomingMessage): MobileRequest => ({ method: req.method, url: req.url,
  headers: req.headers, remoteAddress: req.socket.remoteAddress?.replace('::ffff:', '') ?? '',
  readBody: max => readRequestBody(req, max) });
export const mobileReply = (res: ServerResponse): MobileReply => ({ get headersSent() { return res.headersSent; },
  json(status, value) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value)); },
  destroy() { res.destroy(); } });

// The QR supplies the random 256-bit secret out of band. HKDF separates request
// and response keys; AES-GCM authenticates the pairing ID, direction and request
// ID. HTTP carries ciphertext only, including pairing credentials and filenames.
export class EncryptedLanServer {
  private server?: ReturnType<typeof createServer>;
  private seen = new Set<string>();
  private incoming: Buffer;
  private outgoing: Buffer;
  private failures = 0;
  private failureWindow = 0;
  constructor(readonly key: string, readonly id: string, private allowedAddress: (ip: string) => boolean,
    private dispatch: (req: MobileRequest, reply: MobileReply) => Promise<void>) {
    const derive = (direction: 'request' | 'response') => Buffer.from(hkdfSync('sha256', Buffer.from(key, 'hex'), Buffer.from(id, 'hex'), lanKeyInfo(direction), 32));
    this.incoming = derive('request'); this.outgoing = derive('response');
  }
  async start(host = '0.0.0.0') {
    const server = createServer((req, res) => { void this.handle(req, res); });
    this.server = server; server.maxConnections = 8; server.requestTimeout = 30_000; server.headersTimeout = 10_000;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, host, () => { server.off('error', reject); resolve(); }); });
    const address = server.address(); if (!address || typeof address === 'string') throw Error('M_RECEIVER_ADDRESS');
    return address.port;
  }
  async stop() {
    const server = this.server; this.server = undefined;
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    this.seen.clear(); this.incoming.fill(0); this.outgoing.fill(0);
  }
  private async handle(req: IncomingMessage, res: ServerResponse) {
    const reply = mobileReply(res);
    try {
      const remote = req.socket.remoteAddress?.replace('::ffff:', '') ?? '';
      if (!this.server || req.headers.origin || !this.allowedAddress(remote)) return reply.json(403, { error: 'M_ORIGIN' });
      if (req.method !== 'POST' || req.url !== '/mobile/secure' || req.headers['content-type'] !== 'application/json') return reply.json(404, { error: 'M_ROUTE' });
      if (Date.now() - this.failureWindow > 60_000) { this.failures = 0; this.failureWindow = Date.now(); }
      if (this.failures >= 20) return reply.json(429, { error: 'M_PAIR_RATE' });
      const envelope = parseEnvelope((await readRequestBody(req, LAN_WIRE_LIMIT)).toString('utf8'));
      if (this.seen.has(envelope.id) || this.seen.size >= 8192) throw Error('M_REPLAY');
      const sealed = Buffer.from(decode64(envelope.body, LAN_WIRE_LIMIT));
      if (sealed.length < 28) throw Error('M_WIRE_FORMAT');
      const decipher = createDecipheriv('aes-256-gcm', this.incoming, sealed.subarray(0, 12));
      decipher.setAAD(lanAad('request', this.id, envelope.id)); decipher.setAuthTag(sealed.subarray(-16));
      const plain = Buffer.concat([decipher.update(sealed.subarray(12, -16)), decipher.final()]);
      this.seen.add(envelope.id);
      const input = JSON.parse(plain.toString('utf8'));
      if (!input || Object.keys(input).sort().join(',') !== 'body,method,path,token'
        || typeof input.method !== 'string' || typeof input.path !== 'string' || !allowedLanRequest(input.method, input.path)
        || typeof input.token !== 'string' || input.token.length > 64) throw Error('M_ROUTE');
      const body = Buffer.from(decode64(input.body, input.method === 'PUT' ? LAN_CHUNK : 4096));
      let result: { status: number; body: string } | undefined;
      await this.dispatch({ method: input.method, url: input.path, remoteAddress: remote,
        headers: { ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
          'content-type': input.method === 'PUT' ? 'application/octet-stream' : 'application/json' },
        async readBody(max) { if (body.length > max) throw Error('M_BODY_LIMIT'); return body; } }, {
        get headersSent() { return result !== undefined; },
        json(status, value) { result = { status, body: JSON.stringify(value) }; },
        destroy() { throw Error('M_CONNECTION'); },
      });
      if (!result || !this.server) throw Error('M_CONNECTION');
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.outgoing, nonce);
      cipher.setAAD(lanAad('response', this.id, envelope.id));
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(result)), cipher.final()]);
      reply.json(200, { id: envelope.id, body: Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64') });
    } catch {
      this.failures++;
      if (!res.headersSent) reply.json(400, { error: 'M_SECURE_REQUEST' }); else res.destroy();
    }
  }
}
