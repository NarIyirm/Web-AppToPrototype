import { validateMeta, validateSnapshot } from '../../contracts/generated/validate.cjs';
import { readMobileZip } from './archive.ts';
import { LIMITS, parseManifest, type Asset, type Capture, type Manifest } from './project.ts';

export type MobileMeta = { artifactKind: 'mobile_capture'; formatVersion: '0.1.0-alpha.1'; packageId: string;
  revision: number; createdAt: string; producer: { appVersion: string; adapterVersion: string };
  project: { id: string; name: string }; captures: { id: string; snapshotPath: string }[];
  assets: (Asset & { path: string })[] };
export async function readMobileBundle(bytes: Uint8Array, sha256: (bytes: Uint8Array) => Promise<string>) {
  const files = readMobileZip(bytes);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const manifestBytes = files.get('mobile.json')!;
  if (manifestBytes.length > 256 * 1024) throw new Error('M_LIMIT_EXCEEDED: 素材清单过大。');
  const value: unknown = JSON.parse(decoder.decode(manifestBytes));
  if (!validateMeta(value)) throw new Error('M_PACKAGE_INVALID: 素材清单不匹配。');
  const meta = value as MobileMeta;
  if (!Number.isFinite(Date.parse(meta.createdAt))) throw new Error('M_PACKAGE_INVALID: 时间不正确。');
  const used = new Set(['mobile.json']);
  const captures: Capture[] = [];
  let snapshotBytes = 0;
  for (const ref of meta.captures) {
    if (ref.snapshotPath !== `captures/${ref.id}/snapshot.json` || used.has(ref.snapshotPath)) throw new Error('M_PACKAGE_INVALID: 捕获路径不正确。');
    const snapshot = files.get(ref.snapshotPath);
    if (!snapshot || snapshot.length > 8 * 1024 * 1024 || (snapshotBytes += snapshot.length) > 16 * 1024 * 1024) throw new Error('M_LIMIT_EXCEEDED: 捕获文件缺失或过大。');
    const capture: unknown = JSON.parse(decoder.decode(snapshot));
    if (!validateSnapshot(capture) || (capture as Capture).id !== ref.id || (capture as Capture).projectId !== meta.project.id) throw new Error('M_PACKAGE_INVALID: 捕获记录不匹配。');
    captures.push(capture as Capture); used.add(ref.snapshotPath);
  }
  for (const asset of meta.assets) {
    if (asset.path !== `assets/${asset.id}.png` || used.has(asset.path)) throw new Error('M_PACKAGE_INVALID: 资源路径不正确。');
    const data = files.get(asset.path);
    if (!data || data.length !== asset.bytes || data.length > LIMITS.imageBytes || await sha256(data) !== asset.id) throw new Error('M_ASSET_INVALID: 图片摘要不匹配。');
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (data.length < 33 || signature.some((byte, index) => data[index] !== byte)
      || decoder.decode(data.subarray(12, 16)) !== 'IHDR') throw new Error('M_ASSET_INVALID: 图片编码不正确。');
    const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (header.getUint32(16) !== asset.width || header.getUint32(20) !== asset.height) throw new Error('M_ASSET_INVALID: 图片尺寸不匹配。');
    used.add(asset.path);
  }
  if (used.size !== files.size) throw new Error('M_PACKAGE_INVALID: 包含未声明文件。');
  const state: Manifest = { version: 1, revision: meta.revision,
    projects: [{ ...meta.project, createdAt: meta.createdAt, updatedAt: meta.createdAt, captureIds: meta.captures.map((ref) => ref.id) }],
    captures, assets: meta.assets.map(({ path: _path, ...asset }) => asset) };
  parseManifest(JSON.stringify(state));
  if (state.assets.some((asset) => !captures.some((capture) => capture.assetId === asset.id))) throw new Error('M_PACKAGE_INVALID: 包含未引用资源。');
  return { meta, state, files };
}
