import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { type Asset, type Region } from '@/core/project';

import { sha256 } from './media';
import { readImage } from './read-image';
import { storage } from './storage';
import { loadBoundedImage } from './bounded-image';

export async function saveWebImage(uri: string, region: Region, viewport: { width: number; height: number }): Promise<Asset> {
  const image = await loadBoundedImage(uri);
  const x = Math.max(0, Math.round(region.x / viewport.width * image.width));
  const y = Math.max(0, Math.round(region.y / viewport.height * image.height));
  const width = Math.min(image.width - x, Math.round(region.width / viewport.width * image.width));
  const height = Math.min(image.height - y, Math.round(region.height / viewport.height * image.height));
  const crop = ImageManipulator.manipulate(image).crop({ originX: x, originY: y, width, height });
  try {
    const result = await crop.renderAsync();
    try {
      const output = await result.saveAsync({ format: SaveFormat.PNG });
      const bytes = await readImage(output.uri);
      const asset: Asset = { id: await sha256(bytes), bytes: bytes.length, width: output.width, height: output.height, mediaType: 'image/png' };
      await storage.putAsset(asset.id, bytes);
      return asset;
    } finally { result.release(); }
  } finally { crop.release(); image.release(); }
}
