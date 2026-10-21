import { sha256 } from '@noble/hashes/sha2.js';

const CHUNK = 256 * 1024;
/** SDK 57 has synchronous FileHandle reads, so yield between bounded chunks. */
export async function sha256Stream(size: number, read: (length: number) => Uint8Array,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0))): Promise<string> {
  if (!Number.isSafeInteger(size) || size < 0 || size > 64 * 1024 * 1024) throw new Error('文件超过摘要校验预算。');
  const hash = sha256.create();
  try {
    for (let offset = 0; offset < size;) {
      const wanted = Math.min(CHUNK, size - offset), bytes = read(wanted);
      if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > wanted) throw new Error('文件读取中断或已变化。');
      hash.update(bytes); offset += bytes.length;
      await pause();
    }
    return Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } finally { hash.destroy(); }
}
