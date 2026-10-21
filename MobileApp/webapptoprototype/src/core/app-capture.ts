import type { Region } from './project';

export type SystemFrame = { id: string; uri: string; createdAt: number };
export type SystemCaptureStatus = {
  configured: boolean; running: boolean; message: string;
  guidedCapture?: boolean; overlayGranted?: boolean; startedAt?: number;
  phase?: 'idle' | 'ready' | 'capturing' | 'saved' | 'stopped' | 'failed' | 'paused';
};

/** A failed/new empty session must never silently select a picture from an older session. */
export function sessionFrames(frames: SystemFrame[], status: SystemCaptureStatus): SystemFrame[] {
  return frames.filter(frame => !status.startedAt || frame.createdAt >= status.startedAt).sort((a, b) => a.createdAt - b.createdAt);
}

/** Map a drag in the displayed image to an integer region in the original pixels. */
export function dragRegion(start: { x: number; y: number }, end: { x: number; y: number },
  display: { width: number; height: number }, image: { width: number; height: number }): Region | null {
  if (![start.x, start.y, end.x, end.y, display.width, display.height, image.width, image.height].every(Number.isFinite)
    || display.width <= 0 || display.height <= 0 || image.width < 1 || image.height < 1) return null;
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  const sx = clamp(start.x, display.width), sy = clamp(start.y, display.height);
  const ex = clamp(end.x, display.width), ey = clamp(end.y, display.height);
  if (Math.abs(ex - sx) < 6 || Math.abs(ey - sy) < 6) return null;
  const x = Math.floor(Math.min(sx, ex) * image.width / display.width);
  const y = Math.floor(Math.min(sy, ey) * image.height / display.height);
  const right = Math.min(image.width, Math.ceil(Math.max(sx, ex) * image.width / display.width));
  const bottom = Math.min(image.height, Math.ceil(Math.max(sy, ey) * image.height / display.height));
  return { x, y, width: right - x, height: bottom - y };
}

export type CropAnchor = { x: number; y: number; pageX: number; pageY: number };
/** Touch targets can change as a selection overlay appears. Only use local coordinates
 * once, at grant, then measure movement in the root's fixed coordinate space. */
export function dragRegionFromPage(anchor: CropAnchor, point: { pageX: number; pageY: number },
  display: { width: number; height: number }, image: { width: number; height: number }): Region | null {
  return dragRegion(anchor, { x: anchor.x + point.pageX - anchor.pageX, y: anchor.y + point.pageY - anchor.pageY }, display, image);
}
