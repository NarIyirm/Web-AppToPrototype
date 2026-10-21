import { writeMobileZip } from '@/core/archive';
import { LIMITS, parseManifest, type Manifest } from '@/core/project';

import { newId } from './app-state';
import { sha256 } from './media';
import { storage } from './storage';

export async function prepareBundle(state: Manifest, projectId: string, ids: string[]) {
  const frozen = parseManifest(JSON.stringify(state));
  const project = frozen.projects.find((item) => item.id === projectId);
  if (!project || !ids.length || ids.length > LIMITS.batch || new Set(ids).size !== ids.length
    || ids.some((id) => !project.captureIds.includes(id))) throw new Error('请选择同一项目的 1–5 个画面。');
  const captures = ids.map((id) => frozen.captures.find((item) => item.id === id)!);
  const assets = frozen.assets.filter((asset) => captures.some((capture) => capture.assetId === asset.id));
  const packageId = newId('b');
  const meta = { artifactKind: 'mobile_capture', formatVersion: '0.1.0-alpha.1', packageId,
    revision: frozen.revision, createdAt: new Date().toISOString(),
    producer: { appVersion: '1.0.0', adapterVersion: 'mobile-1' }, project: { id: project.id, name: project.name },
    captures: captures.map((capture) => ({ id: capture.id, snapshotPath: `captures/${capture.id}/snapshot.json` })),
    assets: assets.map((asset) => ({ ...asset, path: `assets/${asset.id}.png` })) };
  async function* entries() {
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    yield { name: 'mobile.json', bytes: encode(meta) };
    for (const capture of captures) yield { name: `captures/${capture.id}/snapshot.json`, bytes: encode(capture) };
    for (const asset of assets) {
      const bytes = await storage.readAsset(asset.id);
      if (bytes.length !== asset.bytes || await sha256(bytes) !== asset.id) throw new Error('图片摘要不一致，导出已停止。');
      yield { name: `assets/${asset.id}.png`, bytes };
    }
  }
  const sink = await storage.createExport(`${packageId}.w2pm.zip`);
  try {
    await writeMobileZip(entries(), sink);
    const uri = await sink.finish();
    return { uri, packageId, count: captures.length };
  } catch (error) { sink.abort(); throw error; }
}
export async function exportBundle(state: Manifest, projectId: string, ids: string[]) {
  const result = await prepareBundle(state, projectId, ids);
  await storage.shareExport(result.uri);
  return { packageId: result.packageId, count: result.count };
}
