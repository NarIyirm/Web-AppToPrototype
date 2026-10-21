import { LIMITS } from '@/core/project';

export async function readImage(uri: string): Promise<Uint8Array> {
  if (!uri.startsWith('blob:') && !uri.startsWith('data:image/png;base64,')) throw new Error('图片必须来自本机选择或处理结果。');
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size > LIMITS.imageBytes) throw new Error('处理后图片超过 10 MiB，请进一步裁切。');
  return new Uint8Array(await blob.arrayBuffer());
}
