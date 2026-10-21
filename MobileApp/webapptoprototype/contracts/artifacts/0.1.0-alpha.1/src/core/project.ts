export const LIMITS = { projects: 50, states: 20, imageBytes: 10 * 1024 * 1024,
  imageEdge: 4096, storageBytes: 256 * 1024 * 1024, bundleBytes: 64 * 1024 * 1024, batch: 5 } as const;
export type SourceKind = 'web' | 'imported_image' | 'android_native' | 'ios_native';
export type Region = { x: number; y: number; width: number; height: number };
export type TextObservation = { text: string; bounds: Region; confidence: number | null; provenance: 'ocr' | 'dom' | 'user' };
export type WebNode = { id: string; kind: 'text' | 'shape' | 'image'; bounds: Region;
  text?: string; color?: string; background?: string; fontSize?: number; radius?: number;
  fontFamily?: string; fontWeight?: number; lineHeight?: number; textAlign?: 'left' | 'center' | 'right' | 'justify' };
export type Asset = { id: string; bytes: number; width: number; height: number; mediaType: 'image/png' };
export type Capture = { id: string; projectId: string; title: string; createdAt: string; sourceKind: SourceKind;
  platform: string; sourceUrl?: string; assetId: string; width: number; height: number;
  logicalWidth: number; logicalHeight: number; coordinateSpace: 'image_pixels' | 'css_pixels';
  observations: TextObservation[]; webNodes: WebNode[]; warnings: string[]; redacted: boolean };
export type Project = { id: string; name: string; createdAt: string; updatedAt: string; captureIds: string[] };
export type Manifest = { version: 1; revision: number; projects: Project[]; captures: Capture[]; assets: Asset[] };
export const emptyManifest = (): Manifest => ({ version: 1, revision: 0, projects: [], captures: [], assets: [] });
export const cloneManifest = (state: Manifest): Manifest => JSON.parse(JSON.stringify(state));
export const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_-]{7,80}$/.test(value);
export const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const allowedKeys = (value: Record<string, unknown>, names: string[]) => Object.keys(value).every((key) => names.includes(key));
export const validRegion = (value: unknown): value is Region => object(value)
  && Object.keys(value).length === 4 && allowedKeys(value, ['x', 'y', 'width', 'height'])
  && finite(value.x, 30_000) && finite(value.y, 30_000) && finite(value.width, 30_000)
  && finite(value.height, 30_000) && Number(value.width) > 0 && Number(value.height) > 0;
const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
const date = (value: unknown) => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value));
const unique = (values: string[]) => new Set(values).size === values.length;
export function parseManifest(raw: string): Manifest {
  if (raw.length > 2 * 1024 * 1024) throw new Error('项目清单超过大小限制。');
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0
    || !allowedKeys(value, ['version', 'revision', 'projects', 'captures', 'assets'])
    || !Array.isArray(value.projects) || value.projects.length > LIMITS.projects
    || !Array.isArray(value.captures) || value.captures.length > LIMITS.projects * LIMITS.states
    || !Array.isArray(value.assets) || value.assets.length > 2000) throw new Error('项目清单格式不正确。');
  for (const asset of value.assets) {
    if (!object(asset) || !validHash(asset.id) || asset.mediaType !== 'image/png'
      || !allowedKeys(asset, ['id', 'bytes', 'width', 'height', 'mediaType'])
      || !finite(asset.bytes, LIMITS.imageBytes) || Number(asset.bytes) < 1
      || !Number.isInteger(asset.width) || !Number.isInteger(asset.height)
      || !finite(asset.width, LIMITS.imageEdge) || !finite(asset.height, LIMITS.imageEdge)
      || Number(asset.width) < 1 || Number(asset.height) < 1) throw new Error('图片资源记录不正确。');
  }
  for (const project of value.projects) {
    if (!object(project) || !validId(project.id) || !text(project.name, 80) || !String(project.name).trim()
      || !allowedKeys(project, ['id', 'name', 'createdAt', 'updatedAt', 'captureIds'])
      || !date(project.createdAt) || !date(project.updatedAt) || !Array.isArray(project.captureIds)
      || project.captureIds.length > LIMITS.states || !project.captureIds.every(validId)
      || !unique(project.captureIds)) throw new Error('项目记录不正确。');
  }
  for (const capture of value.captures) {
    if (!object(capture) || !validId(capture.id) || !validId(capture.projectId)
      || !allowedKeys(capture, ['id', 'projectId', 'title', 'createdAt', 'sourceKind', 'platform', 'sourceUrl', 'assetId',
        'width', 'height', 'logicalWidth', 'logicalHeight', 'coordinateSpace', 'observations', 'webNodes', 'warnings', 'redacted'])
      || !text(capture.title, 80) || !date(capture.createdAt) || !validHash(capture.assetId)
      || !['web', 'imported_image', 'android_native', 'ios_native'].includes(String(capture.sourceKind))
      || !text(capture.platform, 32) || (capture.sourceUrl !== undefined && !text(capture.sourceUrl, 2048))
      || !finite(capture.width, LIMITS.imageEdge) || !finite(capture.height, LIMITS.imageEdge)
      || Number(capture.width) < 1 || Number(capture.height) < 1 || typeof capture.redacted !== 'boolean'
      || !finite(capture.logicalWidth, 30000) || Number(capture.logicalWidth) < 1
      || !finite(capture.logicalHeight, 30000) || Number(capture.logicalHeight) < 1
      || !['image_pixels', 'css_pixels'].includes(String(capture.coordinateSpace))
      || !Array.isArray(capture.observations) || capture.observations.length > 5000
      || !Array.isArray(capture.webNodes) || capture.webNodes.length > 5000
      || !Array.isArray(capture.warnings) || capture.warnings.length > 100
      || !capture.warnings.every((warning) => text(warning, 500))) throw new Error('采集记录不正确。');
    for (const observation of capture.observations) {
      if (!object(observation) || !text(observation.text, 10000) || !validRegion(observation.bounds)
        || !allowedKeys(observation, ['text', 'bounds', 'confidence', 'provenance'])
        || observation.bounds.x + observation.bounds.width > Number(capture.width) + 1
        || observation.bounds.y + observation.bounds.height > Number(capture.height) + 1
        || !['ocr', 'dom', 'user'].includes(String(observation.provenance))
        || (observation.confidence !== null && !finite(observation.confidence, 1))) throw new Error('文字观察不正确。');
    }
    for (const node of capture.webNodes) {
      if (!object(node) || !text(node.id, 80) || !['text', 'shape', 'image'].includes(String(node.kind))
        || !allowedKeys(node, ['id', 'kind', 'bounds', 'text', 'color', 'background', 'fontSize', 'radius', 'fontFamily', 'fontWeight', 'lineHeight', 'textAlign'])
        || !validRegion(node.bounds) || node.bounds.x + node.bounds.width > Number(capture.logicalWidth) + 1
        || node.bounds.y + node.bounds.height > Number(capture.logicalHeight) + 1
        || (node.text !== undefined && !text(node.text, 10000))
        || (node.fontSize !== undefined && !finite(node.fontSize, 1000))
        || (node.radius !== undefined && !finite(node.radius, 30000))
        || (node.fontFamily !== undefined && !text(node.fontFamily, 200))
        || (node.fontWeight !== undefined && (!finite(node.fontWeight, 1000) || Number(node.fontWeight) < 1))
        || (node.lineHeight !== undefined && (!finite(node.lineHeight, 30000) || Number(node.lineHeight) < 1))
        || (node.textAlign !== undefined && !['left', 'center', 'right', 'justify'].includes(String(node.textAlign)))
        || (node.color !== undefined && !text(node.color, 100))
        || (node.background !== undefined && !text(node.background, 100))) throw new Error('网页观察不正确。');
    }
    if (capture.sourceKind === 'web' ? capture.sourceUrl === undefined : capture.sourceUrl !== undefined) throw new Error('采集来源与网页地址不一致。');
    if (capture.sourceUrl !== undefined) {
      const source = new URL(String(capture.sourceUrl));
      if (!['http:', 'https:'].includes(source.protocol) || source.search || source.hash || source.username || source.password) throw new Error('来源地址必须移除查询参数、片段和凭据。');
    }
  }
  // Recheck references after all entities have been bounded and structurally validated.
  const result = value as Manifest;
  if (!unique(result.projects.map((item) => item.id)) || !unique(result.captures.map((item) => item.id))
    || !unique(result.assets.map((item) => item.id)) || result.assets.reduce((sum, asset) => sum + asset.bytes, 0) > LIMITS.storageBytes) throw new Error('项目存在重复记录或超过容量限制。');
  const referenced = result.projects.flatMap((project) => project.captureIds);
  if (!unique(referenced) || referenced.length !== result.captures.length) throw new Error('项目与画面引用不一致。');
  for (const capture of result.captures) {
    if (!result.projects.some((project) => project.id === capture.projectId && project.captureIds.includes(capture.id))
      || !result.assets.some((asset) => asset.id === capture.assetId && asset.width === capture.width && asset.height === capture.height)) throw new Error('采集资源缺失或尺寸不一致。');
  }
  return result;
}

export function commit(state: Manifest, change: (next: Manifest) => void): Manifest {
  const next = cloneManifest(state);
  change(next);
  next.revision += 1;
  return parseManifest(JSON.stringify(next));
}
export function addProject(state: Manifest, id: string, name: string, now: string): Manifest {
  return commit(state, (next) => next.projects.unshift({ id, name: name.trim(), createdAt: now, updatedAt: now, captureIds: [] }));
}
export function addCapture(state: Manifest, capture: Capture, asset: Asset): Manifest {
  return commit(state, (next) => {
    const project = next.projects.find((item) => item.id === capture.projectId);
    if (!project) throw new Error('项目已不存在，请重新选择。');
    project.captureIds.push(capture.id);
    project.updatedAt = capture.createdAt;
    next.captures.push(capture);
    if (!next.assets.some((item) => item.id === asset.id)) next.assets.push(asset);
  });
}
export function removeCapture(state: Manifest, id: string): Manifest {
  return commit(state, (next) => {
    next.captures = next.captures.filter((item) => item.id !== id);
    for (const project of next.projects) project.captureIds = project.captureIds.filter((captureId) => captureId !== id);
    // Keep unreferenced assets until explicit, recovery-aware cleanup is implemented.
  });
}
