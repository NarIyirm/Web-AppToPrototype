import type { Region, TextObservation } from '@/core/project';

export const visionAvailable = false;
export async function recognizeText(_uri: string, _width: number, _height: number): Promise<TextObservation[]> {
  throw new Error('网页预览不提供本机 OCR，请使用包含文字识别模块的手机构建。');
}
export async function redactImage(uri: string, regions: Region[]): Promise<string> {
  const image = new window.Image(); image.src = uri;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法处理此图片。');
  context.drawImage(image, 0, 0); context.fillStyle = '#000000';
  for (const rect of regions) context.fillRect(rect.x, rect.y, rect.width, rect.height);
  return canvas.toDataURL('image/png');
}
