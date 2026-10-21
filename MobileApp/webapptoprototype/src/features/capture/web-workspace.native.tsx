import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { WebView } from 'react-native-webview';

import { allowedWebUrl, parseWebObservation, sanitizeUrl, type WebObservation } from '@/core/web-capture';
import { PAGE_LIMITS, PageComposer, planPage } from '@/core/web-page';
import { LIMITS } from '@/core/project';
import { newId, useAppState } from '@/data/app-state';
import { sha256 } from '@/data/media';
import { readImage } from '@/data/read-image';
import { storage } from '@/data/storage';
import { saveWebImage } from '@/data/web-image';
import { Button, Label, Screen, ui, usePalette, useTask } from '@/ui/kit';
import { SafeAreaSurface } from '@/ui/safe-area';

import { selectionScript, type SelectionMode, type WebCommand } from './web-script';

type Pending = { epoch: string; id: string; resolve(value: WebObservation): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
const emptySelection = { count: 0, excluded: 0, canParent: false, canExclude: false, canUndo: false, width: 0, height: 0 };
export function WebWorkspace({ url, projectId }: { url: string; projectId: string }) {
  const { saveCapture, state } = useAppState();
  const web = useRef<WebView<unknown>>(null), frame = useRef<ComponentRef<typeof View>>(null);
  const pending = useRef<Pending | null>(null), epoch = useRef(newId('e'));
  const currentUrl = useRef(url), layout = useRef({ width: 0, height: 0 }), cancelled = useRef(false), running = useRef(false);
  const [mode, setMode] = useState<SelectionMode>('browse'), [multiple, setMultiple] = useState(false);
  const [loading, setLoading] = useState(true), [selection, setSelection] = useState(emptySelection);
  const [address, setAddress] = useState(url);
  const [canBack, setCanBack] = useState(false), [canForward, setCanForward] = useState(false);
  const [message, setMessage] = useState('浏览网页，或选择需要保存的内容。');
  const task = useTask(), palette = usePalette();
  useEffect(() => { web.current?.injectJavaScript(selectionScript(epoch.current, mode, undefined, { multiple })); }, [mode, multiple]);
  useEffect(() => () => {
    cancelled.current = true;
    if (pending.current) { clearTimeout(pending.current.timer); pending.current.reject(new Error('采集已取消。')); pending.current = null; }
  }, []);
  function invalidate() {
    cancelled.current = true; epoch.current = newId('e'); setSelection(emptySelection); setMode('browse');
    if (pending.current) { clearTimeout(pending.current.timer); pending.current.reject(new Error('网页或尺寸已变化，请重新选择。')); pending.current = null; }
  }
  function command(value: WebCommand) { web.current?.injectJavaScript(selectionScript(epoch.current, mode, undefined, value)); }
  function observe(startedEpoch: string, captureMode: SelectionMode, value: WebCommand = {}) {
    const requestId = newId('r');
    return new Promise<WebObservation>((resolve, reject) => {
      const timer = setTimeout(() => { pending.current = null; reject(new Error('网页读取超时，请重新尝试。')); }, 8000);
      pending.current = { epoch: startedEpoch, id: requestId, resolve, reject, timer };
      web.current?.injectJavaScript(selectionScript(startedEpoch, captureMode, requestId, value));
    });
  }
  function assertCurrent(startedEpoch: string) {
    if (cancelled.current || startedEpoch !== epoch.current) throw new Error('采集已取消，之前保存的画面不受影响。');
  }
  async function capture(long = false) {
    if (running.current) return;
    running.current = true;
    try { await task.run(async () => {
      if (!state.projects.some((item) => item.id === projectId)) throw new Error('请先选择有效项目。');
      if ((state.projects.find((item) => item.id === projectId)?.captureIds.length ?? 0) >= LIMITS.states) throw new Error('项目已满，请新建项目后继续采集。');
      cancelled.current = false;
      const startedEpoch = epoch.current;
      let uri: string | null = null;
      try {
        const observation = await observe(startedEpoch, long ? 'browse' : mode, long ? { action: 'start', y: 0 } : {});
        assertCurrent(startedEpoch);
        let asset, nodes = observation.nodes, warnings = observation.warnings;
        let logicalWidth = observation.selection.width, logicalHeight = observation.selection.height;
        if (long) {
          const plan = planPage(observation.page?.width ?? observation.viewport.width, observation.page?.height ?? observation.viewport.height, observation.viewport);
          const composer = new PageComposer(plan), started = Date.now(); let next = observation, grew = false;
          for (const [index, cell] of plan.tiles.entries()) {
            assertCurrent(startedEpoch);
            if (index > 0) next = await observe(startedEpoch, 'browse', { action: 'step', x: cell.x, y: cell.y });
            setMessage(`正在转换整页 · ${index + 1}/${plan.tiles.length} 块`);
            uri = await captureRef(frame, { format: 'png', result: 'tmpfile', width: Math.min(1024, Math.round(next.viewport.width)), height: Math.max(1, Math.round(next.viewport.height * Math.min(1, 1024 / next.viewport.width))) });
            assertCurrent(startedEpoch);
            composer.add(await readImage(uri), next); releaseCapture(uri); uri = null;
            grew ||= (next.page?.width ?? 0) > (observation.page?.width ?? 0) + 1 || (next.page?.height ?? 0) > (observation.page?.height ?? 0) + 1;
            if (Date.now() - started >= PAGE_LIMITS.milliseconds) break;
          }
          assertCurrent(startedEpoch); setMessage('正在合成整页…');
          const image = composer.finish();
          asset = { id: await sha256(image.bytes), bytes: image.bytes.length, width: image.width, height: image.height, mediaType: 'image/png' as const };
          await storage.putAsset(asset.id, image.bytes);
          logicalWidth = image.logicalWidth; logicalHeight = image.logicalHeight; nodes = image.nodes;
          warnings = [...composer.warnings, `整页转换 ${Math.round(logicalWidth)} × ${Math.round(logicalHeight)} CSS px，预览按图片上限缩小；固定及已出现的吸顶内容只保留一次。`,
            ...(image.partial ? ['达到整页范围、分块或耗时上限，只保存已完成的矩形范围。'] : []),
            ...(grew ? ['采集中网页又加载了新内容，本次覆盖开始时的页面范围；可再次转换整页获取新增内容。'] : []),
            '内嵌滚动区、虚拟列表和持续变化的页面可能不完整。'].slice(0, 100);
        } else {
          uri = await captureRef(frame, { format: 'png', result: 'tmpfile' });
          assertCurrent(startedEpoch);
          asset = await saveWebImage(uri, observation.selection, observation.viewport);
        }
        assertCurrent(startedEpoch);
        const id = await saveCapture(projectId, asset, { title: (observation.title || '网页状态').slice(0, long ? 75 : 80) + (long ? ' · 整页' : ''), sourceKind: 'web',
          sourceUrl: sanitizeUrl(currentUrl.current), webNodes: nodes, warnings,
          coordinateSpace: 'css_pixels', logicalWidth, logicalHeight });
        setMode('browse'); setSelection(emptySelection); setMessage('画面已保存，可以继续采集下一状态。');
        router.push({ pathname: '/captures/[id]', params: { id } });
      } finally {
        if (uri) releaseCapture(uri);
        if (long && startedEpoch === epoch.current) { web.current?.injectJavaScript(selectionScript(startedEpoch, 'browse', undefined, { action: 'finish' })); setMode('browse'); setSelection(emptySelection); }
        else if (startedEpoch === epoch.current) web.current?.injectJavaScript(selectionScript(startedEpoch, mode, undefined, { multiple }));
      }
    }); } finally { running.current = false; }
  }
  if (!allowedWebUrl(url)) return <Screen title="网页地址无效" back><Label>请返回重新输入网页地址。</Label></Screen>;
  return <SafeAreaSurface style={{ backgroundColor: palette.bg }}>
    <View style={s.header}><View style={ui.spread}><Button small icon="back" label="返回" quiet disabled={task.busy} onPress={() => router.back()} />
      <View style={ui.row}><Button small label="后退" quiet disabled={!canBack || task.busy} onPress={() => web.current?.goBack()} />
        <Button small label="前进" quiet disabled={!canForward || task.busy} onPress={() => web.current?.goForward()} /></View></View>
      <Label size={12} muted numberOfLines={1}>{address}</Label>
    </View>
    <View ref={frame} collapsable={false} pointerEvents={task.busy ? 'none' : 'auto'} style={{ flex: 1 }} onLayout={({ nativeEvent }) => {
      const next = nativeEvent.layout;
      if (layout.current.width && (Math.abs(next.width - layout.current.width) > 1 || Math.abs(next.height - layout.current.height) > 1)) invalidate();
      layout.current = { width: next.width, height: next.height };
    }}><WebView<unknown> ref={web} source={{ uri: url }} style={{ flex: 1 }}
      contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      originWhitelist={['*']} onShouldStartLoadWithRequest={({ url: next }) => allowedWebUrl(next)}
      onLoadStart={() => { invalidate(); setLoading(true); setMessage('正在加载网页…'); }}
      onLoadEnd={() => { setLoading(false); setMessage('浏览网页，或选择需要保存的内容。'); web.current?.injectJavaScript(selectionScript(epoch.current, mode, undefined, { multiple })); }}
      onNavigationStateChange={(navigation) => { currentUrl.current = navigation.url; setAddress(navigation.url); setCanBack(navigation.canGoBack); setCanForward(navigation.canGoForward); }}
      onMessage={({ nativeEvent }) => {
        if (nativeEvent.data.length > 1024 * 1024) return;
        try {
          const value = JSON.parse(nativeEvent.data) as { kind?: string; epoch?: string; requestId?: string; message?: string; count?: number; excluded?: number; canParent?: boolean; canExclude?: boolean; canUndo?: boolean; rect?: { width?: number; height?: number } };
          if (value.epoch !== epoch.current) return;
          if (value.kind === 'capture_changed') { invalidate(); setMessage('页面位置或内容已变化，请重新选择。'); return; }
          if (value.kind === 'selection') { setSelection({ count: Math.max(0, Math.min(20, Number(value.count) || 0)), excluded: Math.max(0, Math.min(20, Number(value.excluded) || 0)), canParent: value.canParent === true, canExclude: value.canExclude === true, canUndo: value.canUndo === true, width: Math.max(0, Number(value.rect?.width) || 0), height: Math.max(0, Number(value.rect?.height) || 0) }); return; }
          const request = pending.current;
          if (!request || value.requestId !== request.id) return;
          clearTimeout(request.timer); pending.current = null;
          if (value.kind === 'capture_error') request.reject(new Error(typeof value.message === 'string' ? value.message.slice(0, 300) : '网页无法读取。'));
          else request.resolve(parseWebObservation(nativeEvent.data, request.epoch, request.id));
        } catch { const request = pending.current; if (request) { clearTimeout(request.timer); request.reject(new Error('网页返回结果无效。')); pending.current = null; } }
      }}
      onError={() => { invalidate(); setLoading(false); setMessage('页面加载失败，请检查地址或网络。'); }}
      onContentProcessDidTerminate={() => { invalidate(); setMessage('网页进程已停止，请重新打开。'); }}
      onRenderProcessGone={() => { invalidate(); setMessage('网页进程已停止，请重新打开。'); }}
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
      javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false} mixedContentMode="never"
      thirdPartyCookiesEnabled={false} sharedCookiesEnabled={false} geolocationEnabled={false} incognito />
    </View>
    <View style={[s.tools, { borderTopColor: palette.line, backgroundColor: palette.surface }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolRow}>
        {([['browse', '浏览'], ['element', '选元素'], ['rectangle', '画矩形']] as const).map(([key, label]) => <Button small key={key} label={label} secondary={mode === key} quiet={mode !== key} disabled={task.busy || loading} onPress={() => { setMode(key); setMessage(key === 'browse' ? '可正常滚动与操作网页。' : key === 'element' ? '点选内容；需要更大范围可点“选父级”。' : '拖出需要保存的矩形。'); }} />)}
      </ScrollView>
      <ScrollView horizontal accessibilityLabel="选择工具，可左右滑动查看更多" contentContainerStyle={s.toolRow}>
        <Button small label={multiple ? '多选：开' : '多选：关'} quiet disabled={task.busy || mode !== 'element'} onPress={() => setMultiple((value) => !value)} />
        <Button small label="选父级" quiet disabled={task.busy || !selection.canParent || mode === 'browse'} onPress={() => command({ action: 'parent' })} />
        <Button small label="排除" quiet={mode !== 'exclude'} disabled={task.busy || !selection.canExclude || mode === 'browse'} onPress={() => { setMode(mode === 'exclude' ? 'element' : 'exclude'); setMessage('点选已选区块内部的内容，红框内容不生成图层。'); }} />
        <Button small label="撤销" quiet disabled={task.busy || !selection.canUndo} onPress={() => command({ action: 'undo' })} />
        <Button small label="清空" quiet disabled={task.busy || !selection.count} onPress={() => command({ action: 'clear' })} />
      </ScrollView>
      <View style={s.feedback}><Label size={12} muted numberOfLines={2}>{task.error ?? (task.busy ? message : mode !== 'browse' && selection.count ? `已选 ${selection.count} 处 · 排除 ${selection.excluded} 处 · ${Math.round(selection.width)} × ${Math.round(selection.height)}` : message)}</Label></View>
      <View style={s.toolRow}><View style={{ flex: 1 }}><Button small label={mode === 'browse' ? '保存当前视口' : '保存所选范围'} busy={task.busy} disabled={loading || (mode !== 'browse' && (!selection.count || !selection.width || !selection.height))} onPress={() => void capture()} /></View>
        {task.busy ? <Button small label="取消" quiet onPress={() => { cancelled.current = true; setMessage('正在取消…'); }} /> : <Button small label="一键转换整页" quiet disabled={loading} onPress={() => void capture(true)} />}
      </View>
    </View>
  </SafeAreaSurface>;
}
const s = StyleSheet.create({ header: { paddingHorizontal: 12, paddingBottom: 6 }, tools: { padding: 8, gap: 2, borderTopWidth: 1 }, toolRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, feedback: { minHeight: 38, paddingVertical: 4, paddingHorizontal: 8, justifyContent: 'center' } });
