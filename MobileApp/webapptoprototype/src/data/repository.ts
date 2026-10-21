import { cloneManifest, emptyManifest, parseManifest, type Manifest } from '../core/project.ts';
import type { StorageIO } from './storage.types.ts';

export class Repository {
  private state: Manifest = emptyManifest();
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private io: StorageIO;
  constructor(io: StorageIO) { this.io = io; }
  async load(): Promise<{ state: Manifest; recovered: boolean }> {
    const slots = await this.io.readSlots();
    const candidates: Manifest[] = [];
    let corrupt = false;
    for (const raw of slots) {
      if (raw === null) continue;
      try { candidates.push(parseManifest(raw)); } catch { corrupt = true; }
    }
    if (corrupt && candidates.length === 0) throw new Error('本地项目清单损坏。为保留原数据，已停止写入，请导出诊断后恢复。');
    this.state = candidates.sort((a, b) => b.revision - a.revision)[0] ?? emptyManifest();
    this.loaded = true;
    return { state: cloneManifest(this.state), recovered: corrupt };
  }
  update(change: (current: Manifest) => Manifest): Promise<Manifest> {
    const task = this.queue.then(async () => {
      if (!this.loaded) throw new Error('本地项目尚未加载完成。');
      const next = change(cloneManifest(this.state));
      if (next.revision !== this.state.revision + 1) throw new Error('项目修订号不连续。');
      parseManifest(JSON.stringify(next));
      await this.io.writeSlot(next.revision % 2, JSON.stringify(next));
      this.state = next;
      return cloneManifest(next);
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
