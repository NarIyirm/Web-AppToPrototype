import { digest, CryptoDigestAlgorithm } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { type Asset, type Region } from '@/core/project';

import { readImage } from './read-image';
import { loadBoundedImage } from './bounded-image';
import { storage } from './storage';

export async function sha256(bytes: Uint8Array): Promise<string> {
  const value = await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function normalizeImage(uri: string, crop?: Region, rotation = 0): Promise<Asset> {
  const source = await loadBoundedImage(uri);
  const context = ImageManipulator.manipulate(source);
  try {
    if (crop) context.crop({ originX: crop.x, originY: crop.y, width: crop.width, height: crop.height });
    if (rotation) context.rotate(rotation);
    const image = await context.renderAsync();
    try {
      const output = await image.saveAsync({ format: SaveFormat.PNG });
      const bytes = await readImage(output.uri);
      const asset: Asset = { id: await sha256(bytes), bytes: bytes.length,
        width: output.width, height: output.height, mediaType: 'image/png' };
      await storage.putAsset(asset.id, bytes);
      return asset;
    } finally { image.release(); }
  } finally { context.release(); source.release(); }
}
export async function pickImage(): Promise<Asset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'],
    allowsEditing: false, allowsMultipleSelection: false, exif: false, quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  const source = result.assets[0];
  if ((source.fileSize ?? 0) > 32 * 1024 * 1024 || source.width * source.height > 100_000_000) throw new Error('源图片过大，请先在相册中裁切。');
  return normalizeImage(source.uri);
}
export async function pickAppImages(): Promise<Asset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false,
    allowsMultipleSelection: true, selectionLimit: 5, orderedSelection: true, exif: false, quality: 1 });
  if (result.canceled) return [];
  if (result.assets.length > 5) throw new Error('每次最多导入 5 张 App 截图。');
  const assets: Asset[] = [];
  for (const source of result.assets) {
    if ((source.fileSize ?? 0) > 32 * 1024 * 1024 || source.width * source.height > 100_000_000) throw new Error('截图过大，请先在相册中裁切。');
    const asset = await normalizeImage(source.uri);
    if (!assets.some(item => item.id === asset.id)) assets.push(asset);
  }
  return assets;
}
