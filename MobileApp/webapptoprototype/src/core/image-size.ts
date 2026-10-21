export function fitImageSize(width: number, height: number, edge = 4096) {
  if (![width, height, edge].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error('图片尺寸无效。');
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
