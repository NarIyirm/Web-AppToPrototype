import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { LIMITS, validHash } from '@/core/project';

import type { StorageIO } from './storage.types';
import { fileDigest } from './file-digest';

const root = () => {
  const dir = new Directory(Paths.document, 'mobile-captures');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
};
const assetFile = (id: string) => {
  if (!validHash(id)) throw new Error('无效资源标识。');
  const dir = new Directory(root(), 'assets');
  dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${id}.png`);
};
export const storage: StorageIO = {
  async readSlots() {
    return Promise.all([0, 1].map(async (slot) => {
      const file = new File(root(), `manifest-${slot}.json`);
      if (!file.exists) return null;
      if (file.size > 2 * 1024 * 1024) throw new Error('本地项目清单过大，已停止写入以保留原数据。');
      return file.text();
    }));
  },
  async writeSlot(slot, data) {
    const destination = new File(root(), `manifest-${slot}.json`);
    const temp = new File(root(), `manifest-${slot}.pending`);
    if (temp.exists) temp.delete();
    temp.create();
    await temp.write(data);
    if (await temp.text() !== data) throw new Error('项目写入校验失败。');
    if (destination.exists) destination.delete();
    await temp.move(destination);
  },
  async putAsset(id, bytes) {
    if (bytes.length > LIMITS.imageBytes) throw new Error('图片超过 10 MiB。');
    const file = assetFile(id);
    if (file.exists && file.size === bytes.length && await fileDigest(file) === id) return;
    const occupied = file.parentDirectory.list().reduce((sum, entry) => sum + (entry instanceof File ? entry.size : 0), 0);
    if (occupied + bytes.length > LIMITS.storageBytes) throw new Error('本机素材超过 256 MiB，请先导出并整理存储。');
    const temp = new File(`${file.uri}.pending`);
    if (temp.exists) temp.delete();
    temp.create(); await temp.write(bytes);
    if (await fileDigest(temp) !== id) { temp.delete(); throw new Error('图片写入摘要校验失败。'); }
    if (file.exists) file.delete();
    await temp.move(file);
  },
  async readAsset(id) {
    const file = assetFile(id);
    if (!file.exists || file.size > LIMITS.imageBytes) throw new Error('图片资源缺失或过大。');
    return file.bytes();
  },
  async assetUri(id) { return assetFile(id).uri; },
  async createExport(name) {
    if (!/^[a-z0-9_-]+\.w2pm\.zip$/.test(name)) throw new Error('导出文件名不正确。');
    const directory = new Directory(Paths.cache, 'mobile-exports');
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, name);
    if (file.exists) file.delete();
    file.create();
    const handle = file.open();
    let size = 0;
    let closed = false;
    return {
      write(bytes) {
        size += bytes.length;
        if (closed || size > LIMITS.bundleBytes) throw new Error('素材包超过 64 MiB，请拆分发送。');
        handle.writeBytes(bytes);
      },
      async finish() { handle.close(); closed = true; return file.uri; },
      abort() { if (!closed) handle.close(); closed = true; if (file.exists) file.delete(); },
    };
  },
  async shareExport(uri) {
    if (!await Sharing.isAvailableAsync()) throw new Error('此设备当前无法打开文件分享。素材仍保存在本机。');
    await Sharing.shareAsync(uri, { mimeType: 'application/zip', UTI: 'public.zip-archive', dialogTitle: '导出采集素材包，在电脑转换' });
  },
};
