import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';

import { validRegion, type Region, type TextObservation } from '@/core/project';

type Vision = { recognize(uri: string): Promise<{ width: number; height: number; observations: TextObservation[] }>;
  redact(uri: string, regions: Region[]): Promise<string> };
const native = isRunningInExpoGo() ? null : requireOptionalNativeModule<Vision>('MobileVision');
export const visionAvailable = native !== null;
export async function recognizeText(uri: string, width: number, height: number): Promise<TextObservation[]> {
  if (!native) throw new Error('此安装包未包含本机文字识别模块，请使用更新后的手机构建。');
  const result = await native.recognize(uri);
  if (result.width !== width || result.height !== height || !Array.isArray(result.observations)
    || result.observations.length > 5000) throw new Error('文字识别结果与画面尺寸不一致。');
  for (const item of result.observations) {
    if (typeof item.text !== 'string' || item.text.length > 10000 || !validRegion(item.bounds)
      || item.bounds.x + item.bounds.width > width + 1 || item.bounds.y + item.bounds.height > height + 1
      || item.provenance !== 'ocr' || (item.confidence !== null && (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1))) throw new Error('文字识别结果格式不正确。');
  }
  return result.observations;
}
export async function redactImage(uri: string, regions: Region[]) {
  if (!native) throw new Error('此安装包未包含画面遮挡模块，请使用更新后的手机构建。');
  return native.redact(uri, regions);
}
