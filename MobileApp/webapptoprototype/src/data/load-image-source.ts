import type { ImageManipulator } from 'expo-image-manipulator';

export type LoadedImage = { source: Parameters<typeof ImageManipulator.manipulate>[0]; release(): void };
export async function loadImageSource(uri: string): Promise<LoadedImage> {
  return { source: uri, release() {} };
}
