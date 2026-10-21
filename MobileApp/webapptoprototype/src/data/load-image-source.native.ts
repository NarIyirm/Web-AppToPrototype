import { Image } from 'expo-image';

import { LIMITS } from '@/core/project';

import type { LoadedImage } from './load-image-source';

export async function loadImageSource(uri: string): Promise<LoadedImage> {
  // Unlike SDK 58's manipulator options, this decoder constraint exists in SDK 57.
  const source = await Image.loadAsync(uri, { maxWidth: LIMITS.imageEdge, maxHeight: LIMITS.imageEdge });
  return { source, release: () => source.release() };
}
