import validate from '../generated/validate.js';
import validateMobile from '../generated/validate-mobile.js';
import { LIMITS, utf8Bytes, validateAsset } from './resources';
import { normalizeSvg, SVG_LIMITS } from './svg';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Color { r: number; g: number; b: number; a: number }
export interface Font { family: string; style: string; weight: number; size: number; fallbacks?: string[] }
export interface TextRun { start: number; end: number; font: Font; color?: Color; letterSpacing?: number; decoration?: 'none' | 'underline' | 'line-through' }
export type Fill = { kind: 'solid'; color: Color } | { kind: 'linear_gradient'; angle: number; stops: Array<{ position: number; color: Color }> };
export interface SceneNode {
  id: string; sourceId?: string; name: string; type: 'FRAME' | 'TEXT' | 'SHAPE' | 'IMAGE' | 'VECTOR';
  parentId: string | null; order: number; rect: Rect; fidelity: 'native' | 'approximated' | 'rasterized' | 'missing';
  style: { opacity?: number; fills?: Fill[]; border?: { width: number; color: Color }; radii?: number[]; effects?: Array<{ type: 'drop_shadow'; x: number; y: number; blur: number; spread: number; color: Color }> };
  clipsContent?: boolean; layout?: { mode: 'absolute' } | {mode:'horizontal'|'vertical';gap:number;padding:[number,number,number,number]};
  text?: { characters: string; font: Font; lineHeight: number; letterSpacing: number; align: 'left' | 'center' | 'right' | 'justify'; runs: TextRun[] };
  assetId?: string; svg?: string; imageSizing?: 'stretch';
}
export interface CaptureContext { viewport: { width: number; height: number }; devicePixelRatio: number; zoomFactor: number; scroll: { x: number; y: number } }
export type SourceKind = 'web' | 'imported_image' | 'android_native' | 'ios_native';
export type SourcePlatform = 'ios' | 'android' | 'web' | 'desktop' | 'unknown';
export interface CapturePackage {
  schemaVersion: '1.0.0' | '2.0.0'; artifactKind: 'capture' | 'example'; packageId: string; projectId: string; revision: number; createdAt: string;
  mobileSource?: { formatVersion: '0.1.0-alpha.1'; bundleIds: string[] };
  requiredCapabilities?: string[];
  producer: { appVersion: string; converterVersion: string; adapterVersion: string };
  source: { kind: SourceKind; url?: string; platform?: SourcePlatform; title: string; pageEpoch: string; captureContext: CaptureContext };
  screens: Array<{ id: string; captureId: string; name: string; stateKey: string; rootNodeId: string; selection: { mode: 'viewport' | 'full_page' | 'element' | 'rectangle'; sourceNodeIds: string[]; excludedSourceNodeIds: string[]; originalRect: Rect; boundaryPolicy: 'strict' | 'complete_elements'; contentScope: 'visible' | 'loaded_content' }; sourceOverride?: { url?: string; kind?: SourceKind; platform?: SourcePlatform; mobileBundleId?: string; pageEpoch?: string; captureContext?: CaptureContext; capturedAt?: string }; nodes: SceneNode[] }>;
  assets: Array<{ assetId: string; sha256: string; mime: 'image/png' | 'image/jpeg'; byteLength: number; width: number; height: number; inlineBase64?: string; path?: string }>;
  interactions: Array<{ id: string; fromScreenId: string; triggerNodeId: string; trigger: 'click'; action: 'navigate' | 'open_overlay' | 'close_overlay'; toScreenId?: string; transition: 'instant' }>;
  warnings: Array<{ code: string; severity: 'info' | 'warning' | 'error'; message: string; screenId?: string; nodeId?: string; details?: Record<string, unknown>; fallback?: string }>;
}

export function parseCapturePackage(input: unknown, allowExample = false): CapturePackage {
  if (utf8Bytes(JSON.stringify(input) ?? '') > LIMITS.jsonBytes) throw new Error('E_LIMIT_EXCEEDED: JSON bytes');
  const validator = input && typeof input === 'object' && (input as {schemaVersion?:unknown}).schemaVersion === '2.0.0' ? validateMobile : validate;
  if (!validator(input)) throw new Error('E_PACKAGE_INVALID: ' + (validator.errors ?? []).slice(0, 4).map(e => `${e.instancePath} ${e.message}`).join('; '));
  const data = input as CapturePackage;
  if (data.artifactKind === 'example' && !allowExample) throw new Error('E_EXAMPLE_REQUIRES_DEVELOPMENT_MODE');
  if (data.requiredCapabilities?.some(c => !['absolute-layout', 'click-navigation', 'inline-images', 'image-placement', 'linear-gradients', 'styled-text', 'inline-svg','auto-layout', ...(data.schemaVersion==='2.0.0'?['mobile-sources']:[])].includes(c))) throw new Error('E_VERSION_UNSUPPORTED: unsupported capability');
  if(data.schemaVersion==='2.0.0'){
    if(data.source.kind==='web'?!data.source.url:data.source.url!==undefined)throw Error('E_PACKAGE_INVALID: source URL/kind mismatch');
    for(const screen of data.screens){const override=screen.sourceOverride,kind=override?.kind??data.source.kind;
      if(kind!=='web'&&override?.url!==undefined)throw Error('E_PACKAGE_INVALID: native source must not claim a webpage URL');
      if(kind==='web'&&!(override?.url??(data.source.kind==='web'?data.source.url:undefined)))throw Error('E_PACKAGE_INVALID: webpage source URL required');
      if(override?.mobileBundleId&&!data.mobileSource?.bundleIds.includes(override.mobileBundleId))throw Error('E_PACKAGE_INVALID: mobile bundle identity mismatch');
    }
  }
  if (Number.isNaN(Date.parse(data.createdAt))) throw new Error('E_PACKAGE_INVALID: invalid date');
  const assets = new Set<string>();
  let totalBytes = 0;
  for (const asset of data.assets) {
    if (assets.has(asset.assetId)) throw new Error('E_PACKAGE_INVALID: duplicate asset');
    assets.add(asset.assetId); totalBytes += asset.byteLength;
    if (asset.path && (asset.path.includes('\\') || asset.path.startsWith('/') || asset.path.split('/').some(p => p === '..' || p === '.') || asset.path.includes(':'))) throw new Error('E_PACKAGE_INVALID: unsafe asset path');
    if (asset.inlineBase64 && (asset.inlineBase64.length % 4 !== 0 || asset.inlineBase64.length / 4 * 3 - (asset.inlineBase64.match(/=*$/)?.[0].length ?? 0) !== asset.byteLength)) throw new Error('E_PACKAGE_INVALID: asset byte length mismatch');
  }
  if (totalBytes > LIMITS.totalAssetBytes) throw new Error('E_LIMIT_EXCEEDED: total asset bytes');
  if (data.assets.reduce((sum, asset) => sum + asset.width * asset.height, 0) > LIMITS.totalPixels) throw new Error('E_LIMIT_EXCEEDED: total image pixels');
  if (data.screens.reduce((sum, screen) => sum + screen.nodes.length, 0) > LIMITS.nodes) throw new Error('E_LIMIT_EXCEEDED: total nodes');
  if (data.screens.reduce((sum, screen) => sum + screen.nodes.reduce((size, node) => size + (node.text?.characters.length ?? 0), 0), 0) > LIMITS.textUnits) throw new Error('E_LIMIT_EXCEEDED: total text');
  for (const asset of data.assets) validateAsset(asset);
  const screens = new Map<string, Map<string, SceneNode>>();
  let vectorElements=0,vectorBytes=0;
  for (const screen of data.screens) {
    if (screens.has(screen.id)) throw new Error('E_PACKAGE_INVALID: duplicate screen');
    const nodes = new Map<string, SceneNode>(); screens.set(screen.id, nodes);
    for (const node of screen.nodes) {
      if (nodes.has(node.id)) throw new Error('E_PACKAGE_INVALID: duplicate node');
      nodes.set(node.id, node);
      if(node.layout&&node.layout.mode!=='absolute'&&(node.type!=='FRAME'||!data.requiredCapabilities?.includes('auto-layout')))throw Error('E_PACKAGE_INVALID: auto-layout capability/frame required');
      if(node.svg&&node.type!=='VECTOR')throw new Error('E_PACKAGE_INVALID: svg on non-vector');
      if(node.type==='VECTOR'){
        if(!data.requiredCapabilities?.includes('inline-svg'))throw new Error('E_PACKAGE_INVALID: inline-svg capability required');
        const vector=normalizeSvg(node.svg!);vectorElements+=vector.elements;vectorBytes+=utf8Bytes(vector.svg);
        if(vectorElements+data.screens.reduce((sum,s)=>sum+s.nodes.length,0)>SVG_LIMITS.totalElements||vectorBytes>2*1024*1024)throw new Error('E_LIMIT_EXCEEDED: total SVG complexity');
      }
      if (node.type !== 'TEXT' && node.text) throw new Error('E_PACKAGE_INVALID: text on non-text node');
      if (node.imageSizing && (node.type !== 'IMAGE' || !data.requiredCapabilities?.includes('image-placement'))) throw new Error('E_PACKAGE_INVALID: image placement capability required');
      for (const fill of node.style.fills ?? []) if (fill.kind === 'linear_gradient') {
        if (!data.requiredCapabilities?.includes('linear-gradients')) throw new Error('E_PACKAGE_INVALID: gradient capability required');
        if (fill.stops.some((stop, index) => index > 0 && stop.position < fill.stops[index - 1].position)) throw new Error('E_PACKAGE_INVALID: unsorted gradient stops');
      }
      if (node.type === 'IMAGE' && !assets.has(node.assetId!)) throw new Error('E_PACKAGE_INVALID: missing asset');
      if (node.text) {
        if ((node.text.font.fallbacks || node.text.runs.some(run=>run.font.fallbacks||run.color||run.letterSpacing!==undefined||run.decoration)) && !data.requiredCapabilities?.includes('styled-text')) throw new Error('E_PACKAGE_INVALID: styled-text capability required');
        let previousEnd = 0;
        for (const run of node.text.runs) {
          const chars = node.text.characters;
          const cutsPair = (i: number) => i > 0 && i < chars.length && /[\uD800-\uDBFF]/.test(chars[i - 1]) && /[\uDC00-\uDFFF]/.test(chars[i]);
          if (run.start < previousEnd || run.end <= run.start || run.end > chars.length || cutsPair(run.start) || cutsPair(run.end)) throw new Error('E_PACKAGE_INVALID: invalid text run');
          previousEnd = run.end;
        }
      }
    }
    const root = nodes.get(screen.rootNodeId);
    if (!root || root.parentId !== null || root.type !== 'FRAME' || root.rect.x !== 0 || root.rect.y !== 0 || root.rect.width <= 0 || root.rect.height <= 0 || screen.nodes.filter(n => n.parentId === null).length !== 1) throw new Error('E_PACKAGE_INVALID: invalid root');
    for (const node of nodes.values()) {
      const seen = new Set<string>(); let current = node;
      while (current.parentId !== null) {
        if (seen.has(current.id)) throw new Error('E_PACKAGE_INVALID: cyclic tree');
        seen.add(current.id);
        const parent = nodes.get(current.parentId);
        if (!parent || parent.type !== 'FRAME') throw new Error('E_PACKAGE_INVALID: invalid parent');
        current = parent;
      }
    }
  }
  const links = new Set<string>();
  const triggers=new Set<string>();
  for (const link of data.interactions) {
    if (links.has(link.id)) throw new Error('E_PACKAGE_INVALID: duplicate interaction');
    links.add(link.id);
    const triggerKey=link.fromScreenId+'\u0000'+link.triggerNodeId;if(triggers.has(triggerKey))throw Error('E_PACKAGE_INVALID: duplicate click action');triggers.add(triggerKey);
    if (!screens.get(link.fromScreenId)?.has(link.triggerNodeId)) throw new Error('E_LINK_TARGET_MISSING: trigger');
    if (link.action !== 'close_overlay' && !screens.has(link.toScreenId!)) throw new Error('E_LINK_TARGET_MISSING: destination');
  }
  return data;
}
