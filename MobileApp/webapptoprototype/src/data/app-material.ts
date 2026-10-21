import type { Asset, Capture, SourceKind, TextObservation } from '@/core/project';
import { storage } from './storage';
import { recognizeText, visionAvailable } from './vision';

export async function prepareAppMaterial(asset: Asset, title: string, sourceKind: SourceKind = 'imported_image') {
  let observations: TextObservation[] = [];
  const warnings = ['App 画面由图片推断，不包含原 App 的代码或业务跳转；点击连线在电脑设置。'];
  if (visionAvailable) {
    try { observations = await recognizeText(await storage.assetUri(asset.id), asset.width, asset.height);
      if (!observations.length) warnings.push('未识别到文字，请检查是否为空白画面；仍可保留图片并添加热点。');
    } catch { warnings.push('手机文字识别未完成，发送电脑后会继续尝试离线识别。'); }
  } else warnings.push('电脑转换时自动尝试识别文字，可靠区域转换为可编辑图层。');
  const extras: Partial<Pick<Capture, 'title' | 'sourceKind' | 'observations' | 'warnings'>> = { title, sourceKind, observations, warnings };
  return { asset, extras };
}
