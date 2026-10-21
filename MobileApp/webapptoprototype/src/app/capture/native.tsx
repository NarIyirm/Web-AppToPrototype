import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';

import { sessionFrames } from '@/core/app-capture';
import { LIMITS, type Asset, type Region, type SourceKind } from '@/core/project';
import { useAppState } from '@/data/app-state';
import { prepareAppMaterial } from '@/data/app-material';
import { requestDirectSend } from '@/data/direct-send';
import { normalizeImage, pickAppImages } from '@/data/media';
import { storage } from '@/data/storage';
import { getSystemStatus, listSystemFrames, removeSystemFrame, requestCaptureOverlay, startSystemCapture, stopSystemCapture,
  systemCaptureAvailable, type SystemCaptureStatus, type SystemFrame } from '@/data/system-capture';
import { ImageRegionPicker } from '@/features/capture/image-region-picker';
import { SystemBroadcastControl } from '@/features/capture/system-broadcast-control';
import { Button, Label, Notice, Screen, Section, Steps, Surface, ui, usePalette, useTask } from '@/ui/kit';

type Draft = { asset: Asset; uri: string; frameId?: string; sourceKind: SourceKind; title: string };
// Two stacked instances (for example a notification deep link) may briefly overlap.
// Serialize previews so the same asset's temporary storage file has a single writer.
let previewQueue: Promise<unknown> = Promise.resolve();
function readPreview(uri: string) {
  const result = previewQueue.then(() => normalizeImage(uri));
  previewQueue = result.catch(() => {});
  return result;
}
export default function NativeCaptureScreen() {
  const focused = useIsFocused();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { state, createProject, saveCaptures } = useAppState();
  const [frames, setFrames] = useState<SystemFrame[]>([]);
  const [status, setStatus] = useState<SystemCaptureStatus>({ configured: false, running: false, message: '' });
  const [loaded, setLoaded] = useState(!systemCaptureAvailable), [readError, setReadError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false), [chosen, setChosen] = useState<string | null>(null);
  const [projectOpen, setProjectOpen] = useState(false), [otherOpen, setOtherOpen] = useState(false), [batchOpen, setBatchOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null), [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null), [region, setRegion] = useState<Region | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false), [previewError, setPreviewError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ key: string; id: string; projectId: string } | null>(null);
  const saving = useRef(false), alive = useRef(true), generation = useRef(0);
  const observedSession = useRef(0), polling = useRef(false);
  const autoSelectedSession = useRef<number | null>(null);
  const previewRequest = useRef<string | null>(null), startWait = useRef({ session: 0, until: 0 });
  const previewPending = useRef(false);
  const [starting, setStarting] = useState(false);
  const [returned, setReturned] = useState(false), wentToBackground = useRef(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const task = useTask(), palette = usePalette();
  const project = state.projects.find(p => p.id === (chosen ?? projectId)) ?? state.projects[0];
  const free = LIMITS.states - (project?.captureIds.length ?? 0);
  const activeFrames = sessionFrames(frames, status);
  const reviewFrame = frames.find(frame => frame.id === reviewId);
  const frameUri = reviewFrame?.uri, frameCreatedAt = reviewFrame?.createdAt;
  const guided = systemCaptureAvailable && status.configured && status.guidedCapture;
  const locked = task.busy || status.running || previewLoading || starting;
  const draftKey = draft ? JSON.stringify([draft.asset.id, draft.sourceKind, region, project?.id ?? 'new']) : '';
  const existing = saved?.key === draftKey && state.captures.some(c => c.id === saved.id) ? saved : null;

  const refresh = useCallback(async () => {
    const nextStatus = await getSystemStatus();
    const nextFrames = nextStatus.configured ? await listSystemFrames() : [];
    if (!alive.current) return;
    setStatus(nextStatus); setFrames(nextFrames); setLoaded(true); setReadError(null);
    setSelected(previous => previous.filter(id => nextFrames.some(frame => frame.id === id)));
    if (nextStatus.running) { setPreparing(false); setPreviewLoading(false); }
    const session = nextStatus.startedAt ?? 0;
    if (nextStatus.running || session !== startWait.current.session || Date.now() > startWait.current.until) setStarting(false);
    if (session && session !== observedSession.current) {
      observedSession.current = session;
      if (!saving.current) { generation.current++; setPreviewLoading(false); setReviewId(null); setDraft(null); setRegion(null); setSaved(null); setNotice(null); }
    }
    if (!nextStatus.running && !saving.current && autoSelectedSession.current !== session) {
      const candidates = sessionFrames(nextFrames, nextStatus);
      // Auto-select only once per session; preserve imports and deliberate choices across polls.
      if (candidates.length) { autoSelectedSession.current = session; setReviewId(candidates.at(-1)!.id); }
    }
  }, []);
  useEffect(() => {
    alive.current = focused;
    if (!focused) return;
    const load = async () => {
      if (!systemCaptureAvailable || AppState.currentState !== 'active' || polling.current) return;
      polling.current = true;
      try { await refresh(); } catch { if (alive.current) { setLoaded(true); setReadError('采集状态暂时无法读取，请刷新后重试。'); } }
      finally { polling.current = false; }
    };
    void load(); const timer = setInterval(() => void load(), 1500);
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'background') wentToBackground.current = true;
      if (value === 'active') {
        if (wentToBackground.current) { setReturned(true); wentToBackground.current = false; }
        void load();
      }
    });
    return () => { alive.current = false; clearInterval(timer); subscription.remove(); };
  }, [refresh, focused]);
  useEffect(() => {
    if (!focused) {
      if (previewPending.current) previewRequest.current = null;
      generation.current++; return;
    }
    if (!reviewId || status.running) { previewRequest.current = null; generation.current++; return; }
    if (!frameUri || frameCreatedAt === undefined || saving.current) return;
    const frame = { id: reviewId, uri: frameUri, createdAt: frameCreatedAt };
    const key = JSON.stringify([frame.id, frame.uri, previewAttempt]);
    if (previewRequest.current === key) return;
    previewRequest.current = key;
    previewPending.current = true;
    const serial = ++generation.current;
    void Promise.resolve().then(async () => {
      if (!alive.current || serial !== generation.current) return;
      setPreviewLoading(true); setPreviewError(null); setDraft(null);
      try {
        const asset = await readPreview(frame.uri), uri = await storage.assetUri(asset.id);
        if (!alive.current || serial !== generation.current) return;
        setDraft({ asset, uri, frameId: frame.id, sourceKind: Platform.OS === 'ios' ? 'ios_native' : 'android_native',
          title: `App 画面 ${new Date(frame.createdAt).toLocaleTimeString()}` });
        setRegion(null); setSaved(null);
      } catch { if (alive.current && serial === generation.current) setPreviewError('画面预览未能读取，请重新选择或刷新。'); }
      finally { if (alive.current && serial === generation.current) { previewPending.current = false; setPreviewLoading(false); } }
    });
  }, [reviewId, status.running, frameUri, frameCreatedAt, previewAttempt, focused]);

  async function targetProject() {
    const target = project?.id ?? await createProject('App 原型');
    if (!project) setChosen(target);
    return target;
  }
  async function importScreenshots() {
    await task.run(async () => {
      const assets = await pickAppImages(); if (!assets.length) return;
      if (assets.length > free) throw new Error(`当前项目还可保存 ${free} 个画面，请减少选择或更换项目。`);
      setPreparing(false); setNotice(null); setReviewId(null); generation.current++; setPreviewLoading(false);
      autoSelectedSession.current = observedSession.current;
      if (assets.length === 1) {
        setDraft({ asset: assets[0], uri: await storage.assetUri(assets[0].id), sourceKind: 'imported_image', title: 'App 截图' }); setRegion(null); setSaved(null); return;
      }
      const target = await targetProject(), items = [];
      try {
        for (const [index, asset] of assets.entries()) { setProgress(`正在整理截图 ${index + 1}/${assets.length}…`); items.push(await prepareAppMaterial(asset, `App 截图 ${index + 1}`)); }
        await saveCaptures(target, items);
        router.push({ pathname: '/projects/[id]', params: { id: target } });
      } finally { setProgress(null); }
    });
  }
  async function saveDraft(send: boolean) {
    await task.run(async () => {
      if (!draft || status.running) return;
      if (systemCaptureAvailable && (await getSystemStatus()).running) throw new Error('请先通过系统入口停止采集，再预览并发送。');
      if (existing) {
        if (send) router.push({ pathname: '/connect', params: { projectId: existing.projectId, captureIds: existing.id, selectionKey: requestDirectSend(existing.projectId, [existing.id]) } });
        else setNotice('画面已保存，可直接发送到电脑。');
        return;
      }
      if (free < 1) throw new Error('当前项目已满，请更换项目或新建项目。');
      saving.current = true;
      try {
        setProgress('正在保存画面并整理文字…');
        const target = await targetProject();
        const asset = region ? await normalizeImage(await storage.assetUri(draft.asset.id), region) : draft.asset;
        const [id] = await saveCaptures(target, [await prepareAppMaterial(asset, draft.title, draft.sourceKind)]);
        // Persist before removing the native source; reuse this receipt if the user returns from Send.
        setSaved({ key: JSON.stringify([draft.asset.id, draft.sourceKind, region, target]), id, projectId: target });
        setNotice('画面已保存到项目。');
        if (draft.frameId) {
          try { await removeSystemFrame(draft.frameId); } catch { setNotice('画面已保存；采集列表清理未完成，可稍后丢弃原帧。'); }
          try { await refresh(); } catch { /* A saved capture is still ready to send. */ }
        }
        if (send) router.push({ pathname: '/connect', params: { projectId: target, captureIds: id, selectionKey: requestDirectSend(target, [id]) } });
      } finally { saving.current = false; setProgress(null); }
    });
  }
  async function saveBatch() {
    await task.run(async () => {
      const batch = frames.filter(frame => selected.includes(frame.id));
      if (status.running || !batch.length || batch.length > Math.min(5, free)) throw new Error('请停止采集后，选择项目可容纳的 1–5 个画面。');
      if (systemCaptureAvailable && (await getSystemStatus()).running) throw new Error('请先通过系统入口停止采集，再发送画面。');
      saving.current = true;
      try {
        const target = await targetProject(), items = [];
        for (const [index, frame] of batch.entries()) {
          setProgress(`正在整理画面 ${index + 1}/${batch.length}…`);
          items.push(await prepareAppMaterial(await normalizeImage(frame.uri), `App 画面 ${index + 1}`, Platform.OS === 'ios' ? 'ios_native' : 'android_native'));
        }
        const ids = await saveCaptures(target, items);
        for (const frame of batch) { try { await removeSystemFrame(frame.id); } catch { /* Save committed first. */ } }
        try { await refresh(); } catch { /* The durable saved batch can still be sent. */ } setSelected([]);
        router.push({ pathname: '/connect', params: { projectId: target, captureIds: ids.join(','), selectionKey: requestDirectSend(target, ids) } });
      } finally { saving.current = false; setProgress(null); }
    });
  }
  const step = status.running ? 2 : draft && !preparing ? 3 : 1;
  return <Screen title="转换 App 画面" subtitle="采集一个页面，预览后发送到电脑。" back
    footer={!status.running && !preparing && draft ? <>
      <Button icon="send" label={existing ? '发送到电脑转换' : '确认并发送'} busy={task.busy} disabled={previewLoading || free < 1 && !existing} onPress={() => void saveDraft(true)} />
      <Button label={existing ? '已保存到项目' : '先保存到项目'} quiet small disabled={locked || !!existing || free < 1} onPress={() => void saveDraft(false)} />
    </> : undefined}>
    <Steps labels={['开始采集', '打开 App', '预览发送']} current={step - 1} />
    <Notice error message={task.error ?? readError ?? previewError} /><Notice message={progress ?? (starting ? '系统正在启动采集，请稍候…' : notice)} />
    {previewError ? <Button label="重试读取画面" quiet disabled={task.busy} onPress={() => setPreviewAttempt(value => value + 1)} /> : null}
    {status.running ? <Section title={Platform.OS === 'ios' ? returned ? '已返回，请先停止系统采集' : '正在采集，请打开目标 App'
      : status.phase === 'capturing' ? '正在保存当前页面' : returned ? '已返回，请完成采集或停止' : '已就绪，请打开目标 App'}>
      <Label>{!status.guidedCapture ? '当前安装包正在定时采集。请通过系统入口停止，返回后选择画面。更新安装包后可使用新的引导采集。' : Platform.OS === 'ios'
        ? returned ? activeFrames.length ? '已取得候选画面。请通过顶部系统录屏状态或控制中心停止，再预览并发送。'
          : '尚未取得目标画面。请切回目标 App，在需要的页面停留约 3 秒，再通过系统录屏入口停止。'
          : '找到要转换的页面，停留约 3 秒，再点击顶部系统录屏状态或打开控制中心停止。返回这里即可预览。'
        : '切换到要转换的 App，找到目标页面，点击悬浮按钮“采集当前页”。保存完成后返回这里。'}</Label>
      <Label size={14} muted>{Platform.OS === 'ios' ? '返回本应用后不会继续写入本应用的画面。请先停止系统采集，再发送转换。' : '悬浮按钮可拖动；采集时自动隐藏，保存一张后结束共享。'}</Label>
      <Notice message={status.message} />
      {Platform.OS === 'android' ? <Button label="停止本次采集" quiet disabled={task.busy} onPress={() => void task.run(async () => { await stopSystemCapture(); await refresh(); })} />
        : <SystemBroadcastControl running disabled={task.busy} />}
    </Section> : null}
    {!status.running && !preparing && draft ? <Section title={existing ? '画面已保存，可以发送' : '确认要转换的画面'}>
      {previewLoading ? <Label muted>正在读取画面…</Label> : <ImageRegionPicker uri={draft.uri} width={draft.asset.width} height={draft.asset.height}
        region={region} onChange={setRegion} disabled={task.busy} />}
    </Section> : null}
    {!status.running ? <Section title={draft && !preparing ? '继续采集' : preparing ? '开始前请看这三步' : '采集一个 App 页面'}>
      {!loaded ? <Label muted>正在读取采集状态…</Label> : guided ? <>
        {!preparing ? <Button label={draft ? '采集下一个页面' : '开始采集'} disabled={locked || free < 1 || frames.length >= 20}
          onPress={() => { setPreparing(true); setReturned(false); setNotice(null); }} /> : <>
          <Surface><Label size={14}>1. {Platform.OS === 'ios' ? '点下方录屏按钮，选择“界面采集”，再点“开始广播”。' : '允许系统共享画面。'}</Label>
          <Label size={14}>2. {Platform.OS === 'ios' ? '打开目标 App，在需要的页面停留约 3 秒。' : '打开目标 App，定位需要转换的页面。'}</Label>
          <Label size={14}>3. {Platform.OS === 'ios' ? '从顶部录屏状态或控制中心停止，返回这里。' : '点击悬浮按钮“采集当前页”，再返回这里。'}</Label></Surface>
          <Label size={13} muted>每次最长 60 秒，部分受保护内容可能无法采集。</Label>
          {Platform.OS === 'android' ? <Label size={14} muted>系统支持时可选择“单个 App”并选中目标 App；否则共享屏幕后手动打开。</Label> : null}
          {Platform.OS === 'ios' ? <SystemBroadcastControl disabled={task.busy} />
            : status.overlayGranted ? <Button label="授权并开始采集" busy={task.busy || starting} onPress={() => void task.run(async () => {
              const accepted = await startSystemCapture();
              if (!accepted) { setNotice('已取消系统授权，可以重新开始。'); return; }
              startWait.current = { session: observedSession.current, until: Date.now() + 10_000 };
              setStarting(true); setNotice('系统正在启动，请打开目标 App。'); await refresh();
            })} /> : <>
              <Label size={14} muted>先允许在其他 App 上显示采集按钮，授权后返回此页面继续。</Label>
              <Button label="允许悬浮采集按钮" busy={task.busy} onPress={() => void task.run(async () => { await requestCaptureOverlay(); })} />
            </>}
          <Button label="暂不采集" quiet disabled={task.busy || starting} onPress={() => setPreparing(false)} />
        </>}
        {status.phase === 'failed' || status.phase === 'stopped' && !activeFrames.length ? <Notice message={status.message} /> : null}
      </> : <>
        <Notice message={!systemCaptureAvailable ? '当前为 Expo Go：可导入截图或体验示例。跨 App 录屏需要独立安装包。'
          : !status.configured ? status.message : '此安装包使用旧版定时采集。请更新安装包后使用引导采集，已有画面仍可选择。'} />
        <Button label="体验采集流程（无需打包）" disabled={task.busy} onPress={() => router.push({ pathname: '/capture/demo', params: { projectId: project?.id ?? '' } })} />
      </>}
      {frames.length >= 20 ? <Notice message="待整理画面已满，请先保存或丢弃下方画面，再开始采集。" /> : null}
      <Button label="从相册导入 App 截图" quiet busy={task.busy} disabled={free < 1 || starting} onPress={() => void importScreenshots()} />
    </Section> : null}
    {frames.length && !status.running ? <Section title={`其他采集画面 · ${frames.length}`} action={<Button label={otherOpen ? '收起' : '选择其他画面'} quiet disabled={locked} onPress={() => setOtherOpen(value => !value)} />}>
      {!draft && !previewLoading ? <Label muted>本次未取得可预览的画面。可以重新采集，或展开选择之前保留的画面。</Label> : null}
      {previewLoading ? <Label muted>正在读取画面…</Label> : null}
      {otherOpen ? <>
        <Label size={13} muted>默认预览本次最后一张。若不是目标页面，可选择较早的画面。</Label>
        <Button label={batchOpen ? '返回单张预览' : '批量发送多个画面'} quiet disabled={locked} onPress={() => setBatchOpen(value => !value)} />
        <View style={[ui.row, { alignItems: 'flex-start' }]}>{frames.map((frame, index) => {
          const checked = batchOpen ? selected.includes(frame.id) : reviewId === frame.id;
          return <View key={frame.id} style={{ width: '47%', gap: 6 }}><Pressable accessibilityRole={batchOpen ? 'checkbox' : 'radio'}
            accessibilityLabel={`画面 ${index + 1}`} accessibilityState={{ checked, disabled: locked }} disabled={locked}
            onPress={() => {
              if (batchOpen) setSelected(previous => checked ? previous.filter(id => id !== frame.id) : previous.length < Math.min(5, free) ? [...previous, frame.id] : previous);
              else if (reviewId !== frame.id) { setPreparing(false); setReviewId(frame.id); setSaved(null); setNotice(null); }
            }} style={{ borderWidth: 2, borderColor: checked ? palette.accent : palette.line, padding: 6, borderRadius: 8, gap: 6 }}>
            <Image source={{ uri: frame.uri }} style={{ height: 140, width: '100%' }} contentFit="contain" cachePolicy="none" />
            <Label size={13}>{checked ? '已选 · ' : ''}画面 {index + 1}</Label></Pressable>
            <Button label="丢弃" quiet disabled={locked} onPress={() => void task.run(async () => {
              await removeSystemFrame(frame.id);
              if (reviewId === frame.id) { setReviewId(null); if (!existing) setDraft(null); }
              await refresh();
            })} /></View>;
        })}</View>
        {batchOpen ? <Button label={`保存并发送 ${selected.length} 个画面`} busy={task.busy} disabled={!selected.length || free < 1} onPress={() => void saveBatch()} /> : null}
      </> : null}
    </Section> : null}
    <View style={[ui.spread, { paddingTop: 16, borderTopWidth: 1, borderColor: palette.line }]}>
      <View style={{ flex: 1, gap: 4 }}><Label size={14}>保存到：{project?.name ?? 'App 原型'}</Label><Label size={13} muted>还可保存 {free} 个画面</Label></View>
      <Button label={projectOpen ? '收起项目' : '更换项目'} quiet disabled={locked} onPress={() => setProjectOpen(value => !value)} />
    </View>
    {projectOpen ? <View style={ui.stack}>{state.projects.map(p => <Button key={p.id} label={p.name} quiet={p.id !== project?.id} disabled={locked} onPress={() => setChosen(p.id)} />)}
      <Button label="新建项目" quiet disabled={locked} onPress={() => void task.run(async () => setChosen(await createProject(`App 原型 ${state.projects.length + 1}`)))} /></View> : null}
    {systemCaptureAvailable ? <Button label="刷新采集状态" quiet disabled={task.busy || previewLoading} onPress={() => void task.run(refresh)} /> : null}
  </Screen>;
}

