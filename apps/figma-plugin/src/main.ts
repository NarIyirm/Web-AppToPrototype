import { parseCapturePackage, type CapturePackage, type SceneNode, type Font } from '../../../packages/contracts/src/index';
import probe from '../../../examples/figma-m0-probe.json';
import { scenePaint, sceneImagePaint } from './paints';
import { resolveFont } from './font-resolver';
import { svgForSize } from '../../../packages/contracts/src/svg';
import {sameTarget,type BridgeTarget,type BridgeDelivery,type ImportReport} from '../../../packages/contracts/src/bridge';
import {fidelityCounts} from '../../../packages/contracts/src/quality';

figma.showUI(__html__, { width: 420, height: 590, themeColors: true });
let busy = false;
let cancelled = false;
const bindingId=`plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let activeBridgeTarget:BridgeTarget|undefined;
function context():BridgeTarget{return {bindingId,documentName:figma.root.name.slice(0,256)||'Untitled',pageId:figma.currentPage.id,pageName:figma.currentPage.name.slice(0,256)||'Page'};}
function assertTarget(target?:BridgeTarget){if(target&&!sameTarget(target,context()))throw Error('E_TARGET_CHANGED: 当前页面与配对目标不同');}
figma.on('currentpagechange',()=>{if(activeBridgeTarget&&!sameTarget(activeBridgeTarget,context()))cancelled=true;post('bridge-context',context());});
const OWNER = 'webtoprototype-m0';
function post(type: string, data: unknown) { figma.ui.postMessage({ type, data }); }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function importPackage(input: unknown, allowExample: boolean,delivery?:BridgeDelivery):Promise<ImportReport> {
  assertTarget(delivery?.job.target);
  const data = parseCapturePackage(input, allowExample);
  const importId=delivery?.job.importId??`m0-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  if(delivery){
    if(!/^bridge-[a-zA-Z0-9-]{1,100}$/.test(importId)||delivery.job.packageId!==data.packageId||delivery.job.revision!==data.revision)throw Error('E_JOB_INVALID');
    const saved=await figma.clientStorage.getAsync(`receipt:${importId}`) as ImportReport|undefined;
    if(saved){
      if(saved.packageId!==data.packageId||saved.revision!==data.revision||saved.targetPageId!==figma.currentPage.id)throw Error('E_RECEIPT_CONFLICT');
      const roots=await Promise.all(saved.rootNodeIds.map(id=>figma.getNodeByIdAsync(id)));
      if(!roots.every(node=>node&&!node.removed&&node.getPluginData('owner')===OWNER&&node.getPluginData('importId')===importId&&node.getPluginData('state')==='committed'))throw Error('E_IMPORT_INTERRUPTED: 旧任务未确认完成，请核对临时根或被删除的结果');
      post('report',saved);return saved;
    }
    if(figma.currentPage.children.some(node=>node.getPluginData('importId')===importId))throw Error('E_IMPORT_INTERRUPTED: 已存在同一任务的图层，不会重复创建');
  }
  if (data.assets.some(a => !a.inlineBase64)) throw new Error('M0 仅支持自包含 JSON 资源，ZIP 将在 M2 实现。');
  const available = await figma.listAvailableFontsAsync();
  const fontWarnings = new Map<string,{code:string;severity:'warning';message:string;details:Record<string,unknown>}>();
  const loaded = new Map<string, FontName>();
  const findFont = async (font: Font): Promise<FontName> => {
    const key = JSON.stringify([font.family,font.style,font.weight,font.fallbacks]);
    if (loaded.has(key)) return loaded.get(key)!;
    const result=resolveFont(font,available.map(f=>f.fontName)),chosen=result.font;
    if(result.reason!=='exact')fontWarnings.set(key,{code:'E_FONT_MISSING',severity:'warning',message:`${font.family}/${font.style} → ${chosen.family}/${chosen.style}`,details:{requested:font,chosen,reason:result.reason,glyphCoverage:'unverified'}});
    await figma.loadFontAsync(chosen); loaded.set(key, chosen); return chosen;
  };
  for (const screen of data.screens) for (const node of screen.nodes) if (node.text) {
    await findFont(node.text.font);
    for (const run of node.text.runs) await findFont(run.font);
  }
  const images = new Map<string, Image>();
  for (const asset of data.assets) {
    if (cancelled) throw new Error('E_CANCELLED');
    const bytes = figma.base64Decode(asset.inlineBase64!);
    if (bytes.length !== asset.byteLength) throw new Error('图片字节长度不一致');
    const image = figma.createImage(bytes);
    const size = await image.getSizeAsync();
    if (size.width !== asset.width || size.height !== asset.height) throw new Error('E_PACKAGE_INVALID: decoded image dimensions mismatch');
    images.set(asset.assetId, image); await pause();
  }
  const startedAt = new Date().toISOString();
  assertTarget(delivery?.job.target);if(cancelled)throw Error('E_CANCELLED');
  const target = figma.currentPage;
  const residuals = target.children.filter(n => n.getPluginData('owner') === OWNER && n.getPluginData('state') === 'staging');
  if (residuals.length) throw new Error('存在上次中断的临时根，请先点击清理本插件残留。');
  const bottoms = target.children.map(n => n.y + n.height);
  figma.commitUndo();
  const root = figma.createSection();
  target.appendChild(root); root.name = 'WebToPrototype / M0 导入中'; root.visible = false;
  root.x = 0; root.y = Math.max(0, ...bottoms) + 80; root.fills = [];
  root.setPluginData('owner', OWNER); root.setPluginData('state', 'staging'); root.setPluginData('importId', importId);
  const mapping = new Map<string, Map<string, SceneNodeMap>>();
  const screenRoots = new Map<string, FrameNode>();
  const nodeMap: Array<{ screenId: string; sceneNodeId: string; figmaNodeId: string }> = [];
  let cursor = 0;
  let completed = 0;
  let committed=false;
  const total = data.screens.reduce((sum, screen) => sum + screen.nodes.length, 0);
  try {
    for (const screen of data.screens) {
      const local = new Map<string, SceneNodeMap>(); mapping.set(screen.id, local);
      const pending = [...screen.nodes].sort((a, b) => a.order - b.order);
      while (pending.length) {
        assertTarget(delivery?.job.target);if (cancelled) throw new Error('E_CANCELLED');
        const index = pending.findIndex(n => n.parentId === null || local.has(n.parentId));
        if (index < 0) throw new Error('节点父级无法解析');
        const node = pending.splice(index, 1)[0];
        const output = await createNode(node, findFont, images);
        const parent = node.parentId === null ? root : local.get(node.parentId)!;
        if (parent.type !== 'FRAME' && parent.type !== 'SECTION') throw new Error('父级不是 Frame 或 Section');
        parent.appendChild(output);
        output.x = node.parentId === null ? cursor : node.rect.x;
        output.y = node.parentId === null ? 0 : node.rect.y;
        output.name = node.name;
        local.set(node.id, output); nodeMap.push({ screenId: screen.id, sceneNodeId: node.id, figmaNodeId: output.id });
        if (node.parentId === null) { screenRoots.set(screen.id, output as FrameNode); cursor += node.rect.width + 40; }
        completed++; post('progress', { completed, total }); await pause();
      }
    }
    for(const screen of data.screens)for(const node of [...screen.nodes].reverse())if(node.layout&&node.layout.mode!=='absolute'){
      const frame=mapping.get(screen.id)!.get(node.id) as FrameNode,l=node.layout;
      frame.layoutMode=l.mode==='horizontal'?'HORIZONTAL':'VERTICAL';frame.primaryAxisSizingMode='FIXED';frame.counterAxisSizingMode='FIXED';frame.primaryAxisAlignItems='MIN';frame.counterAxisAlignItems='MIN';frame.itemSpacing=l.gap;[frame.paddingTop,frame.paddingRight,frame.paddingBottom,frame.paddingLeft]=l.padding;
      for(const child of frame.children){if('layoutSizingHorizontal'in child)child.layoutSizingHorizontal='FIXED';if('layoutSizingVertical'in child)child.layoutSizingVertical='FIXED';}frame.resize(node.rect.width,node.rect.height);
    }
    // Native NAVIGATE requires page-level destination frames in this runtime.
    for (const frame of screenRoots.values()) {
      const position = { x: root.x + frame.x, y: root.y + frame.y };
      frame.visible=false;
      target.appendChild(frame); frame.x = position.x; frame.y = position.y;
      frame.setPluginData('owner', OWNER); frame.setPluginData('state', 'staging'); frame.setPluginData('importId', importId);
    }
    for (const link of data.interactions) {
      assertTarget(delivery?.job.target);if (cancelled) throw new Error('E_CANCELLED');
      const node = mapping.get(link.fromScreenId)!.get(link.triggerNodeId)!;
      if (link.action === 'close_overlay') await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'CLOSE' }] }]);
      else await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: screenRoots.get(link.toScreenId!)!.id, navigation: link.action === 'navigate' ? 'NAVIGATE' as const : 'OVERLAY' as const, transition: null, preserveScrollPosition: false }] }]);
    }
    assertTarget(delivery?.job.target);if (cancelled) throw new Error('E_CANCELLED');
    const warnings = [...data.warnings, ...fontWarnings.values()];
    const report:ImportReport = { reportKind: 'actual_import', inputKind: data.artifactKind, importId, packageId: data.packageId, revision: data.revision, startedAt, finishedAt: new Date().toISOString(), status: warnings.length ? 'succeeded_with_warnings' : 'succeeded', targetPageId: target.id, fidelity:fidelityCounts(data), rootNodeIds: [...screenRoots.values()].map(frame => frame.id), nodeMap, counts: { nodes: completed, screens: data.screens.length, images: images.size, interactions: data.interactions.length }, warnings, errors: [], versions: { plugin: '0.1.0', schema: data.schemaVersion } };
    // Persist the receipt before the synchronous commit. Replays verify live roots,
    // so a stored receipt alone can never claim an interrupted staging tree succeeded.
    if(delivery){
      const index=(await figma.clientStorage.getAsync('receipt-index')??[]) as string[];
      if(!index.includes(importId))index.push(importId);
      while(index.length>3){const oldest=index.shift()!;await figma.clientStorage.deleteAsync(`receipt:${oldest}`);}
      await figma.clientStorage.setAsync('receipt-index',index);
      await figma.clientStorage.setAsync(`receipt:${importId}`,report);
    }
    assertTarget(delivery?.job.target);if(cancelled)throw Error('E_CANCELLED');
    root.remove();for (const frame of screenRoots.values()) {frame.visible=true;frame.setPluginData('state','committed');}
    committed=true;figma.commitUndo();
    try{figma.currentPage.selection=[...screenRoots.values()];figma.viewport.scrollAndZoomIntoView([...screenRoots.values()]);}
    catch{post('info','图层已完成；自动定位未成功，请按报告中的根图层查找。');}
    try{await figma.clientStorage.setAsync('last-report',report);}catch{post('info','图层已完成；上次报告缓存未更新，请保留当前报告。');}
    post('report', report);return report;
  } catch (error) {
    if(committed)throw error;
    for (const frame of screenRoots.values()) if (!frame.removed && frame.getPluginData('importId') === importId) frame.remove();
    if (!root.removed) root.remove();
    figma.commitUndo(); throw error;
  }
}

type SceneNodeMap = FrameNode | TextNode | RectangleNode | GroupNode;
async function createNode(node: SceneNode, findFont: (font: Font) => Promise<FontName>, images: Map<string, Image>): Promise<SceneNodeMap> {
  let output: SceneNodeMap | undefined;
  try {
  if (node.type === 'TEXT') {
    const text = figma.createText(); output = text;
    const content = node.text!;
    text.fontName = await findFont(content.font); text.fontSize = content.font.size;
    text.characters = content.characters;
    text.lineHeight = { value: content.lineHeight, unit: 'PIXELS' };
    text.letterSpacing = { value: content.letterSpacing, unit: 'PIXELS' };
    text.textAlignHorizontal = content.align.toUpperCase() as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    if (content.align === 'justify') text.textAlignHorizontal = 'JUSTIFIED';
    text.textAutoResize = 'NONE';
  } else if (node.type === 'VECTOR') {
    output = figma.createNodeFromSvg(svgForSize(node.svg!,node.rect.width,node.rect.height));
    output.clipsContent=node.clipsContent??true;
  } else if (node.type === 'FRAME') {
    output = figma.createFrame(); output.clipsContent = node.clipsContent ?? false;
  } else output = figma.createRectangle();
    output.resize(Math.max(0.01, node.rect.width), Math.max(0.01, node.rect.height));
    output.opacity = (node.type==='VECTOR'?output.opacity??1:1)*(node.style.opacity ?? 1);
    if ('fills' in output && node.type !== 'VECTOR') output.fills = (node.style.fills ?? []).map(fill => scenePaint(fill, node.rect.width, node.rect.height));
    if (node.type === 'IMAGE' && 'fills' in output) output.fills = [sceneImagePaint(node, images.get(node.assetId!)!.hash)];
    if (node.style.border && 'strokes' in output) { const b = node.style.border; output.strokes = [{ type: 'SOLID', color: { r: b.color.r, g: b.color.g, b: b.color.b }, opacity: b.color.a }]; output.strokeWeight = b.width; output.strokeAlign = 'INSIDE'; }
    if (node.style.radii && 'topLeftRadius' in output) [output.topLeftRadius, output.topRightRadius, output.bottomRightRadius, output.bottomLeftRadius] = node.style.radii;
    if (node.style.effects) output.effects = node.style.effects.map(effect => ({ type: 'DROP_SHADOW' as const, visible: true, color: effect.color, offset: { x: effect.x, y: effect.y }, radius: effect.blur, spread: effect.spread, blendMode: 'NORMAL' as const, showShadowBehindNode:false }));
    // Apply rich ranges after the node-level fills; setting fills afterwards would
    // overwrite each character's color. UTF-16 ranges were validated before writing.
    if(node.type==='TEXT'&&output.type==='TEXT')for(const run of node.text!.runs){
      output.setRangeFontName(run.start,run.end,await findFont(run.font));output.setRangeFontSize(run.start,run.end,run.font.size);
      if(run.color)output.setRangeFills(run.start,run.end,[scenePaint({kind:'solid',color:run.color},node.rect.width,node.rect.height)]);
      if(run.letterSpacing!==undefined)output.setRangeLetterSpacing(run.start,run.end,{value:run.letterSpacing,unit:'PIXELS'});
      if(run.decoration)output.setRangeTextDecoration(run.start,run.end,run.decoration==='underline'?'UNDERLINE':run.decoration==='line-through'?'STRIKETHROUGH':'NONE');
    }
    return output;
  } catch (error) { if (output && !output.removed) output.remove(); throw error; }
}

figma.ui.onmessage = async (msg: { type?: string; data?: unknown; allowExample?: boolean }) => {
  if(msg.type==='bridge-context'){post('bridge-context',context());return;}
  if(msg.type==='bridge-stop'){if(activeBridgeTarget)cancelled=true;return;}
  if (msg.type === 'cancel') { cancelled = true; return; }
  if (msg.type === 'get-report') { post('report', await figma.clientStorage.getAsync('last-report') ?? null); return; }
  if (busy) { if(msg.type==='bridge-import'){const job=(msg.data as BridgeDelivery)?.job;if(job)post('bridge-result',{jobId:job.id,importId:job.importId,error:'E_JOB_BUSY: 插件正在处理其他导入'});}post('error', '当前导入正在执行，请等待或取消。'); return; }
  if(msg.type==='bridge-import'){
    const delivery=msg.data as BridgeDelivery;
    if(!delivery?.job||typeof delivery.job.id!=='string'||typeof delivery.job.importId!=='string'){post('error','E_JOB_INVALID');return;}
    if(!delivery.job.target||typeof delivery.job.target.bindingId!=='string'||typeof delivery.job.target.pageId!=='string'){
      post('bridge-result',{jobId:delivery.job.id,importId:delivery.job.importId,error:'E_JOB_INVALID: 缺少接收页面绑定'});return;
    }
    busy=true;cancelled=false;activeBridgeTarget=delivery.job.target;post('busy',true);
    try{const report=await importPackage(delivery.data,false,delivery);post('bridge-result',{jobId:delivery.job.id,importId:delivery.job.importId,report});}
    catch(error){post('bridge-result',{jobId:delivery.job.id,importId:delivery.job.importId,error:message(error).slice(0,1000)});post('error',message(error));}
    finally{busy=false;activeBridgeTarget=undefined;post('busy',false);}return;
  }
  if (msg.type === 'cleanup') {
    const roots = figma.currentPage.children.filter(n => n.getPluginData('owner') === OWNER && n.getPluginData('state') === 'staging');
    roots.forEach(n => n.remove()); post('info', `清理了 ${roots.length} 个本插件未完成临时根。`); return;
  }
  if (msg.type === 'probe' || msg.type === 'import') {
    busy = true; cancelled = false; post('busy', true);
    try { await importPackage(msg.type === 'probe' ? probe : msg.data, msg.type === 'probe' || msg.allowExample === true); }
    catch (error) { post('error', message(error)); }
    finally { busy = false; post('busy', false); }
  }
};
