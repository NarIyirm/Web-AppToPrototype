/** MOB-00a diagnostic messages only; this is not the capture bundle protocol. */
export type ProbeRect = { x: number; y: number; width: number; height: number };
export type WebProbe = {
  kind: 'web_probe';
  epoch: string;
  viewport: { width: number; height: number; dpr: number };
  target: ProbeRect;
  image: { width: number; height: number; loaded: boolean };
  text: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function parseWebProbe(raw: string, expectedEpoch: string): WebProbe | null {
  if (!expectedEpoch || raw.length > 4096) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!record(value) || !keys(value, ['kind', 'epoch', 'viewport', 'target', 'image', 'text'])
    || value.kind !== 'web_probe' || value.epoch !== expectedEpoch
    || typeof value.text !== 'string' || value.text.length > 256) return null;
  const { viewport, target, image } = value;
  if (!record(viewport) || !keys(viewport, ['width', 'height', 'dpr'])
    || !finite(viewport.width, 1, 16384) || !finite(viewport.height, 1, 16384)
    || !finite(viewport.dpr, 0.1, 16)) return null;
  if (!record(target) || !keys(target, ['x', 'y', 'width', 'height'])
    || !finite(target.x, -16384, 16384) || !finite(target.y, -16384, 16384)
    || !finite(target.width, 1, 16384) || !finite(target.height, 1, 16384)) return null;
  if (!record(image) || !keys(image, ['width', 'height', 'loaded'])
    || !finite(image.width, 0, 4096) || !finite(image.height, 0, 4096)
    || typeof image.loaded !== 'boolean'
    || (image.loaded && (image.width === 0 || image.height === 0))) return null;
  // Reconstruct the allowlisted observation rather than returning the untrusted object.
  return { kind: 'web_probe', epoch: expectedEpoch, text: value.text,
    viewport: { width: viewport.width, height: viewport.height, dpr: viewport.dpr },
    target: { x: target.x, y: target.y, width: target.width, height: target.height },
    image: { width: image.width, height: image.height, loaded: image.loaded } };
}

/** Only the embedded fixture may load. Other URLs are cancelled in native code. */
export function isProbeNavigationAllowed(url: string): boolean {
  return url === 'about:blank';
}
