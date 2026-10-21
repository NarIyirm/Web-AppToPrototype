import { File } from 'expo-file-system';

import { LIMITS } from '@/core/project';

export async function readImage(uri: string): Promise<Uint8Array> {
  if (!uri.startsWith('file://')) throw new Error('图片必须是应用处理后的本地文件。');
  const file = new File(uri);
  if (!file.exists || file.size > LIMITS.imageBytes) throw new Error('处理后图片缺失或超过 10 MiB。');
  return file.bytes();
}
