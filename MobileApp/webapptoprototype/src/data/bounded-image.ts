import { ImageManipulator, type ImageRef } from 'expo-image-manipulator';

import { fitImageSize } from '@/core/image-size';
import { LIMITS } from '@/core/project';

import { loadImageSource } from './load-image-source';

export async function loadBoundedImage(uri: string): Promise<ImageRef> {
  const source = await loadImageSource(uri);
  try {
    const context = ImageManipulator.manipulate(source.source);
    try {
      const image = await context.renderAsync();
      if (image.width <= LIMITS.imageEdge && image.height <= LIMITS.imageEdge) return image;
      try {
        const size = fitImageSize(image.width, image.height, LIMITS.imageEdge);
        const resize = ImageManipulator.manipulate(image).resize(size);
        try { return await resize.renderAsync(); } finally { resize.release(); }
      } finally { image.release(); }
    } finally { context.release(); }
  } finally { source.release(); }
}
