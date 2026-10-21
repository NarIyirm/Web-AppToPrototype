import { LIMITS, validHash } from '@/core/project';

import type { StorageIO } from './storage.types';

let dbPromise: Promise<IDBDatabase> | undefined;
const urls = new Map<string, string>();
function database() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('w2p-mobile-v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('data'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(new Error('无法打开本地项目，请检查浏览器存储权限。')); };
  });
}
async function read<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('data').objectStore('data').get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}
async function write(key: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('本地保存失败，请检查剩余存储空间。'));
    tx.onabort = () => reject(new Error('本地保存已中断，之前的成功项目仍保留。'));
  });
}
export const storage: StorageIO = {
  async readSlots() { return Promise.all([0, 1].map(async (slot) => await read<string>(`manifest-${slot}`) ?? null)); },
  async writeSlot(slot, data) { await write(`manifest-${slot}`, data); },
  async putAsset(id, bytes) {
    if (!validHash(id) || bytes.length > LIMITS.imageBytes) throw new Error('图片超过资源限制。');
    await write(`asset-${id}`, bytes);
  },
  async readAsset(id) {
    if (!validHash(id)) throw new Error('无效资源标识。');
    const bytes = await read<Uint8Array>(`asset-${id}`);
    if (!bytes || bytes.length > LIMITS.imageBytes) throw new Error('图片资源缺失。');
    return bytes;
  },
  async assetUri(id) {
    const existing = urls.get(id);
    if (existing) return existing;
    const bytes = await storage.readAsset(id);
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    // Bound temporary preview URLs; persistent assets remain in IndexedDB.
    if (urls.size >= 40) {
      const oldest = urls.entries().next().value;
      if (oldest) { URL.revokeObjectURL(oldest[1]); urls.delete(oldest[0]); }
    }
    urls.set(id, url);
    return url;
  },
  async createExport() {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    return {
      write(bytes) {
        size += bytes.length;
        if (size > LIMITS.bundleBytes) throw new Error('素材包超过 64 MiB，请拆分发送。');
        chunks.push(new Uint8Array(bytes));
      },
      async finish() { return URL.createObjectURL(new Blob(chunks, { type: 'application/zip' })); },
      abort() { chunks.length = 0; },
    };
  },
  async shareExport(uri) {
    const anchor = document.createElement('a');
    anchor.href = uri; anchor.download = 'mobile-capture.w2pm.zip'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(uri), 60_000);
  },
};
