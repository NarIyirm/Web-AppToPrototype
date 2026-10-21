import { nativeImage, type Session } from 'electron';
import { createHash } from 'node:crypto';
import { LIMITS, inspectImage, decodeBase64 } from '../../../packages/contracts/src/resources';
import type { CapturePackage } from '../../../packages/contracts/src/index';
import type { DomCapture } from './capture-data';
import { imageRect } from './visual';
import { normalizeSvg, svgForImageSize, type NormalizedSvg } from '../../../packages/contracts/src/svg';
import {normalizeExtraRaster} from './raster';
const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
export async function resolveAssets(capture: DomCapture, session: Session, assertCurrent: () => void,signal?:AbortSignal): Promise<CapturePackage['assets']> {
  const assets = new Map<string, CapturePackage['assets'][number]>();
  const cache = new Map<string, CapturePackage['assets'][number] | null>();
  const svgCache=new Map<string,NormalizedSvg>();
  let total = 0, pixels = 0;
  const source = new URL(capture.url);
  const warn = (nodeId: string, message: string) => capture.warnings.push({ code: 'E_ASSET_UNAVAILABLE', severity: 'warning', message, nodeId });
  for (const request of capture.images) {
    assertCurrent();
    const node = capture.nodes.find(n => n.id === request.nodeId)!;
    const place = (asset: CapturePackage['assets'][number]) => {
      node.assetId = asset.assetId;
      if (request.layout) {
        try {
          const rect=imageRect(request.layout,asset),clip=capture.nodes.find(n=>n.id===node.parentId)!;
          const repeat=request.layout.repeat;
          if(repeat&&repeat!=='no-repeat'){
            const axes=repeat.split(' '),rx=axes[0]==='repeat',ry=(axes[1]??axes[0])==='repeat';
            if(rx&&(rect.x>.01||rect.x+rect.width<clip.rect.width-.01)||ry&&(rect.y>.01||rect.y+rect.height<clip.rect.height-.01)){
              node.type='SHAPE';node.fidelity='missing';delete node.assetId;
              const owner=capture.nodes.find(n=>n.id===request.ownerNodeId);if(owner)owner.fidelity='approximated';
              capture.warnings.push({code:'W_BACKGROUND_UNSUPPORTED',severity:'warning',nodeId:owner?.id??node.id,message:'此背景需要平铺多次，暂保留底色和原生内容。',fallback:'base-color-and-native-content',details:{property:'background-repeat',editability:'native remainder; repeated image omitted'}});return;
            }
          }
          node.rect = rect; node.imageSizing = 'stretch'; node.fidelity = 'native';
        }
        catch { node.type = 'SHAPE'; node.fidelity = 'missing'; delete node.assetId; delete node.imageSizing;
          capture.warnings.push({code:'W_IMAGE_LAYOUT_UNSUPPORTED',severity:'warning',nodeId:node.id,message:'图片定位或尺寸表达式暂不支持，保留可编辑占位框。',fallback:'placeholder',details:{property:'object/background size-position'}});
        }
      }
    };
    const key = request.url ?? request.base64!;
    const placeSvg=(vector:NormalizedSvg)=>{
      // Object-fit is evaluated against the browser's intrinsic image dimensions
      // when available, while the SVG keeps its own viewport for vector scaling.
      const natural=request.layout?.natural??vector;
      try{
        const rect=request.layout?imageRect(request.layout,natural):node.rect;
        if(request.layout?.repeat&&request.layout.repeat!=='no-repeat'){
          const clip=capture.nodes.find(n=>n.id===node.parentId)!,axes=request.layout.repeat.split(' '),rx=axes[0]==='repeat',ry=(axes[1]??axes[0])==='repeat';
          if(rx&&(rect.x>.01||rect.x+rect.width<clip.rect.width-.01)||ry&&(rect.y>.01||rect.y+rect.height<clip.rect.height-.01)){
            node.type='SHAPE';node.fidelity='missing';delete node.assetId;
            capture.warnings.push({code:'W_BACKGROUND_UNSUPPORTED',severity:'warning',nodeId:request.ownerNodeId??node.id,message:'SVG背景需要平铺多次，暂保留底色和原生内容。',fallback:'base-color-and-native-content'});return;
          }
        }
        // SVG images negotiate a viewport at their concrete object size. Their
        // own viewBox/preserveAspectRatio still applies (even for object-fit:fill),
        // unlike stretching an already-rasterized PNG of the intrinsic viewport.
        node.rect=rect;node.type='VECTOR';node.svg=svgForImageSize(vector.svg,rect.width,rect.height);node.fidelity='native';delete node.assetId;delete node.imageSizing;
      }catch{
        node.type='SHAPE';node.fidelity='missing';delete node.assetId;
        capture.warnings.push({code:'W_IMAGE_LAYOUT_UNSUPPORTED',severity:'warning',nodeId:node.id,message:'SVG尺寸或定位暂不支持，保留可编辑占位框。',fallback:'placeholder'});
      }
    };
    if(svgCache.has(key)){placeSvg(svgCache.get(key)!);continue;}
    if (cache.has(key)) { const asset = cache.get(key); if (asset) place(asset); else { node.type = 'SHAPE'; node.fidelity = 'missing'; delete node.assetId; warn(node.id, '重复图片资源不可用。'); } continue; }
    try {
      let bytes: Uint8Array;
      if (request.base64) { if (request.base64.length > Math.ceil(LIMITS.assetBytes / 3) * 4) throw Error('图片超过 10 MiB'); bytes = decodeBase64(request.base64); }
      else if (request.url?.startsWith('data:')) {
        const svg=request.url.match(/^data:image\/svg\+xml(?:;charset=[\w-]+)?(;base64)?,([\s\S]*)$/i);
        if(svg){if(svg[2].length>LIMITS.assetBytes*3)throw Error('SVG data budget');bytes=svg[1]?decodeBase64(svg[2]):new TextEncoder().encode(decodeURIComponent(svg[2]));}
        else{const match = request.url.match(/^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
          if (!match || match[1].length > Math.ceil(LIMITS.assetBytes / 3) * 4) throw Error('仅支持有界 PNG/JPEG/WebP/GIF/SVG data 图片');
          bytes = decodeBase64(match[1]);}
      } else {
        let url = new URL(request.url!); let response: Response | undefined;
        const control = new AbortController(); const timeout = setTimeout(() => control.abort(), 8000);
        try {
          for (let redirects = 0; redirects <= 4; redirects++) {
            if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback(url.hostname))) || url.username || url.password || (!loopback(source.hostname) && loopback(url.hostname))) throw Error('图片地址或重定向不在允许范围');
            const result = await session.fetch(url.href, { redirect: 'manual', signal: signal?AbortSignal.any([control.signal,signal]):control.signal });
            if (result.status >= 300 && result.status < 400) { const location = result.headers.get('location'); await result.body?.cancel(); if (!location) throw Error('图片重定向缺少目标'); url = new URL(location, url); continue; }
            response = result as unknown as Response; break;
          }
          if (!response?.ok || !response.body) throw Error('图片下载失败');
          if (Number(response.headers.get('content-length')) > LIMITS.assetBytes) { await response.body.cancel(); throw Error('图片超过 10 MiB'); }
          const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
          try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > LIMITS.assetBytes) { await reader.cancel(); throw Error('图片超过 10 MiB'); } chunks.push(chunk.value); } }
          finally { reader.releaseLock(); }
          bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        } finally { clearTimeout(timeout); }
      }
      if (bytes.length > LIMITS.assetBytes) throw Error('图片超过 10 MiB');
      const prefix=new TextDecoder().decode(bytes.subarray(0,256)).replace(/^\uFEFF/,'').trimStart();
      if(prefix.startsWith('<')){
        const vector=normalizeSvg(new TextDecoder('utf-8',{fatal:true}).decode(bytes),request.layout?.natural);
        svgCache.set(key,vector);placeSvg(vector);continue;
      }
      const normalized=await normalizeExtraRaster(bytes,signal);if(normalized){bytes=normalized.bytes;capture.warnings.push({code:normalized.animated?'I_ANIMATION_FLATTENED':'I_IMAGE_NORMALIZED',severity:'info',nodeId:node.id,message:normalized.animated?'动画图片已固化为当前解码静态帧，动画不迁移。':'WebP已固化为可替换PNG图片。'});}
      const metadata = inspectImage(bytes);
      if (metadata.width > LIMITS.dimension || metadata.height > LIMITS.dimension || !metadata.width || !metadata.height) throw Error('图片单边超过 4096px 或尺寸无效');
      const bitmap = nativeImage.createFromBuffer(Buffer.from(bytes));
      const size = bitmap.getSize();
      if (bitmap.isEmpty() || size.width !== metadata.width || size.height !== metadata.height) throw Error('图片解码失败或尺寸不一致');
      const hash = createHash('sha256').update(bytes).digest('hex');
      const asset = { assetId: hash, sha256: hash, ...metadata, byteLength: bytes.length, inlineBase64: Buffer.from(bytes).toString('base64') };
      if (!assets.has(hash)) {
        if (total + bytes.length > LIMITS.totalAssetBytes || pixels + metadata.width * metadata.height > LIMITS.totalPixels) throw new Error('E_LIMIT_EXCEEDED: total image budget');
        total += bytes.length; pixels += metadata.width * metadata.height; assets.set(hash, asset);
      }
      cache.set(key, asset); place(asset);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('E_LIMIT_EXCEEDED: total')) throw error;
      cache.set(key, null); node.type = 'SHAPE'; node.fidelity = 'missing'; delete node.assetId;
      // Do not include remote URLs, query strings or network error text in exported diagnostics.
      if(request.url?.match(/\.svg(?:[?#]|$)|^data:image\/svg\+xml/i)||error instanceof Error&&error.message.startsWith('E_SVG_UNSUPPORTED'))capture.warnings.push({code:'W_SVG_UNSUPPORTED',severity:'warning',nodeId:node.id,message:'SVG无法固化或含暂不支持的元素/引用/效果，保留可编辑占位框；未转为截图。',fallback:'placeholder'});
      else warn(node.id, '图片无法固化（下载、格式、尺寸或解码失败），保留可编辑占位框。支持PNG/JPEG、可固化为PNG的WebP/GIF及有界静态SVG，位图单图 ≤10 MiB、单边 ≤4096px。');
    }
  }
  assertCurrent(); return [...assets.values()];
}

