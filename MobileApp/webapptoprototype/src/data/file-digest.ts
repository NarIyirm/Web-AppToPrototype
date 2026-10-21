import type { File } from 'expo-file-system';

import { sha256Stream } from '@/core/stream-digest';

export async function fileDigest(file: File): Promise<string> {
  const size = file.size;
  if (!file.exists || size < 1 || size > 64 * 1024 * 1024) throw new Error('文件缺失或超过摘要校验预算。');
  const handle = file.open();
  try {
    const digest = await sha256Stream(size, (length) => handle.readBytes(length));
    if (file.size !== size) throw new Error('校验期间文件大小发生变化。');
    return digest;
  } finally { handle.close(); }
}
