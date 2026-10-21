import { validRegion, type Region, type WebNode } from './project.ts';

export type WebObservation = { kind: 'web_capture'; epoch: string; requestId: string; title: string;
  viewport: { width: number; height: number }; selection: Region; nodes: WebNode[]; warnings: string[];
  page?: { x: number; y: number; width: number; height: number } };
export function allowedWebUrl(value: string): boolean {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function sanitizeUrl(value: string): string {
  if (!allowedWebUrl(value)) throw new Error('网页地址不正确。');
  const url = new URL(value); url.search = ''; url.hash = ''; return url.href;
}
export function parseWebObservation(raw: string, epoch: string, requestId: string): WebObservation {
  const fail = () => { throw new Error('网页返回了无效或过期的采集结果，请重新选择。'); };
  if (raw.length > 1024 * 1024) return fail();
  const value = JSON.parse(raw) as WebObservation;
  if (!value || value.kind !== 'web_capture' || value.epoch !== epoch || value.requestId !== requestId
    || typeof value.title !== 'string' || value.title.length > 80 || !value.viewport
    || !Number.isFinite(value.viewport.width) || value.viewport.width < 1 || value.viewport.width > 16384
    || !Number.isFinite(value.viewport.height) || value.viewport.height < 1 || value.viewport.height > 16384
    || !validRegion(value.selection) || value.selection.x + value.selection.width > value.viewport.width + 1
    || value.selection.y + value.selection.height > value.viewport.height + 1
    || !Array.isArray(value.nodes) || value.nodes.length > 2000 || !Array.isArray(value.warnings)
    || value.warnings.length > 30 || !value.warnings.every((warning) => typeof warning === 'string' && warning.length <= 500)
    || (value.page !== undefined && (!validRegion(value.page) || value.page.x > 30000 || value.page.y > 30000))) return fail();
  let textUnits = 0;
  const ids = new Set<string>();
  const nodes = value.nodes.map((node): WebNode => {
    if (!node || typeof node.id !== 'string' || node.id.length > 80 || ids.has(node.id)
      || !['text', 'shape', 'image'].includes(node.kind) || !validRegion(node.bounds)
      || node.bounds.x + node.bounds.width > value.selection.width + 1 || node.bounds.y + node.bounds.height > value.selection.height + 1
      || (node.text !== undefined && (typeof node.text !== 'string' || node.text.length > 10000))
      || (node.fontSize !== undefined && (!Number.isFinite(node.fontSize) || node.fontSize <= 0 || node.fontSize > 1000))
      || (node.radius !== undefined && (!Number.isFinite(node.radius) || node.radius < 0 || node.radius > 30000))
      || (node.fontFamily !== undefined && (typeof node.fontFamily !== 'string' || node.fontFamily.length > 200))
      || (node.fontWeight !== undefined && (!Number.isFinite(node.fontWeight) || node.fontWeight < 1 || node.fontWeight > 1000))
      || (node.lineHeight !== undefined && (!Number.isFinite(node.lineHeight) || node.lineHeight < 1 || node.lineHeight > 30000))
      || (node.textAlign !== undefined && !['left', 'center', 'right', 'justify'].includes(node.textAlign))
      || (node.color !== undefined && (typeof node.color !== 'string' || node.color.length > 100))
      || (node.background !== undefined && (typeof node.background !== 'string' || node.background.length > 100))) return fail();
    ids.add(node.id); textUnits += node.text?.length ?? 0;
    if (textUnits > 500000) return fail();
    return { id: node.id, kind: node.kind,
      bounds: { x: node.bounds.x, y: node.bounds.y, width: node.bounds.width, height: node.bounds.height },
      ...(node.text !== undefined ? { text: node.text } : {}), ...(node.fontSize !== undefined ? { fontSize: node.fontSize } : {}),
      ...(node.color !== undefined ? { color: node.color } : {}), ...(node.background !== undefined ? { background: node.background } : {}),
      ...(node.radius !== undefined ? { radius: node.radius } : {}),
      ...(node.fontFamily !== undefined ? { fontFamily: node.fontFamily } : {}),
      ...(node.fontWeight !== undefined ? { fontWeight: node.fontWeight } : {}),
      ...(node.lineHeight !== undefined ? { lineHeight: node.lineHeight } : {}),
      ...(node.textAlign !== undefined ? { textAlign: node.textAlign } : {}) };
  });
  return { kind: 'web_capture', epoch, requestId, title: value.title,
    viewport: { width: value.viewport.width, height: value.viewport.height },
    selection: { x: value.selection.x, y: value.selection.y, width: value.selection.width, height: value.selection.height },
    nodes, warnings: [...value.warnings], ...(value.page ? { page: { x: value.page.x, y: value.page.y, width: value.page.width, height: value.page.height } } : {}) };
}
