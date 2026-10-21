import { LIMITS, type Region, type WebNode } from './project.ts';
import { readCapturePng, writeCapturePng } from './web-long-page.ts';
import type { WebObservation } from './web-capture.ts';

export const PAGE_LIMITS = { edge: 12000, area: 18_000_000, tiles: 40, milliseconds: 60000, nodes: 4999 } as const;
export type PagePlan = { width: number; height: number; viewport: { width: number; height: number }; columns: number; rows: number; partial: boolean; tiles: Region[] };
export function planPage(width: number, height: number, viewport: { width: number; height: number }): PagePlan {
  if (![width, height, viewport.width, viewport.height].every(n => Number.isFinite(n) && n >= 1 && n <= 30000)) throw new Error('页面尺寸无法读取。');
  const ratio = Math.min(1, PAGE_LIMITS.edge / width, PAGE_LIMITS.edge / height, Math.sqrt(PAGE_LIMITS.area / (width * height)));
  const w = Math.max(1, Math.floor(width * ratio)), h = Math.max(1, Math.floor(height * ratio));
  const columns = Math.min(PAGE_LIMITS.tiles, Math.ceil(w / viewport.width));
  const rows = Math.min(Math.floor(PAGE_LIMITS.tiles / columns), Math.ceil(h / viewport.height));
  const finalWidth = Math.min(w, columns * viewport.width), finalHeight = Math.min(h, rows * viewport.height);
  const tiles: Region[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const x = col * viewport.width, y = row * viewport.height;
    tiles.push({ x, y, width: Math.min(viewport.width, finalWidth - x), height: Math.min(viewport.height, finalHeight - y) });
  }
  return { width: finalWidth, height: finalHeight, viewport, columns, rows, partial: finalWidth < width || finalHeight < height, tiles };
}
/** Tiles own non-overlapping cells even when the browser clamps the last scroll. */
export class PageComposer {
  readonly plan: PagePlan; readonly width: number; readonly height: number; readonly scale: number; readonly rgba: Uint8Array;
  nodes: WebNode[] = []; warnings = new Set<string>(); completed = 0;
  constructor(plan: PagePlan) {
    this.plan = plan; this.scale = Math.min(1, 4096 / plan.width, 4096 / plan.height, Math.sqrt(4_000_000 / (plan.width * plan.height)));
    this.width = Math.max(1, Math.floor(plan.width * this.scale)); this.height = Math.max(1, Math.floor(plan.height * this.scale));
    this.rgba = new Uint8Array(this.width * this.height * 4);
  }
  add(bytes: Uint8Array, observation: WebObservation) {
    const cell = this.plan.tiles[this.completed]; if (!cell) throw new Error('页面分块已完成。');
    const x = observation.page?.x ?? 0, y = observation.page?.y ?? 0, v = observation.viewport;
    if (Math.abs(v.width - this.plan.viewport.width) > 1 || Math.abs(v.height - this.plan.viewport.height) > 1
      || x > cell.x + 1 || y > cell.y + 1 || x + v.width < cell.x + cell.width - 1 || y + v.height < cell.y + cell.height - 1) throw new Error('页面布局或滚动范围已变化，请重新转换整页。');
    const image = readCapturePng(bytes), right = cell.x + cell.width, bottom = cell.y + cell.height;
    for (let row = Math.round(cell.y * this.scale); row < Math.min(this.height, Math.round(bottom * this.scale)); row++) {
      const sy = Math.max(0, Math.min(image.height - 1, Math.floor((row / this.scale - y) / v.height * image.height)));
      for (let col = Math.round(cell.x * this.scale); col < Math.min(this.width, Math.round(right * this.scale)); col++) {
        const sx = Math.max(0, Math.min(image.width - 1, Math.floor((col / this.scale - x) / v.width * image.width))), source = (sy * image.width + sx) * 4;
        this.rgba.set(image.rgba.subarray(source, source + 4), (row * this.width + col) * 4);
      }
    }
    for (const node of observation.nodes) {
      const left = Math.max(cell.x, x + node.bounds.x), top = Math.max(cell.y, y + node.bounds.y);
      const endX = Math.min(right, x + node.bounds.x + node.bounds.width), endY = Math.min(bottom, y + node.bounds.y + node.bounds.height);
      if (left >= endX || top >= endY || this.nodes.length >= PAGE_LIMITS.nodes) continue;
      const bounds = { x: left, y: top, width: endX - left, height: endY - top }, id = `page-${this.nodes.length}`;
      const clipped = Math.abs(bounds.width - node.bounds.width) > .5 || Math.abs(bounds.height - node.bounds.height) > .5;
      this.nodes.push(node.kind === 'text' && clipped ? { id, kind: 'image', bounds } : { ...node, id, bounds });
    }
    for (const warning of observation.warnings) this.warnings.add(warning);
    this.completed++;
  }
  finish() {
    const completeRows = Math.floor(this.completed / this.plan.columns);
    if (!completeRows) throw new Error('尚未完成一整行页面，未保存不完整画面，请重试。');
    const logicalHeight = Math.min(this.plan.height, completeRows * this.plan.viewport.height), height = Math.min(this.height, Math.max(1, Math.round(logicalHeight * this.scale)));
    const bytes = writeCapturePng({ width: this.width, height, rgba: this.rgba.subarray(0, this.width * height * 4) });
    if (bytes.length > LIMITS.imageBytes) throw new Error('整页图片超过 10 MiB，请分区转换。');
    if (this.nodes.length >= PAGE_LIMITS.nodes) this.warnings.add('整页达到图层数量上限，部分内容未转换。');
    return { bytes, width: this.width, height, logicalWidth: this.plan.width, logicalHeight,
      partial: this.plan.partial || this.completed < this.plan.tiles.length,
      nodes: this.nodes.filter(n => n.bounds.y + n.bounds.height <= logicalHeight + .01) };
  }
}
