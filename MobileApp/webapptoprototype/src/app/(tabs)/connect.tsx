import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { parsePairingOffer, type PairingOffer } from '@/core/pairing';
import { transferError } from '@/core/transfer-error';
import { useAppState } from '@/data/app-state';
import { prepareBundle } from '@/data/export-bundle';
import { directSendRequests } from '@/data/direct-send';
import { checkDesktopConnection, connectedDesktop, disconnectDesktop, pairDesktop, transferAvailable, transferBundle } from '@/data/transfer';
import { AssetImage, Badge, Button, Empty, Field, Icon, Label, Notice, Screen, Section, SelectionMark, Surface, ui, usePalette, useTask } from '@/ui/kit';

export default function ConnectScreen() {
  const params = useLocalSearchParams<{ projectId?: string; captureIds?: string; selectionKey?: string }>();
  return <ConnectContent key={`${params.projectId ?? ''}:${params.captureIds ?? ''}:${params.selectionKey ?? ''}`} initialProject={params.projectId} initialIds={params.captureIds} sendRequest={params.selectionKey} />;
}
function ConnectContent({ initialProject, initialIds, sendRequest }: { initialProject?: string; initialIds?: string; sendRequest?: string }) {
  const focused = useIsFocused();
  const { state } = useAppState();
  const first = state.projects.find((item) => item.id === initialProject) ?? state.projects[0];
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false), [manual, setManual] = useState(false), [code, setCode] = useState('');
  const [offer, setOffer] = useState<PairingOffer | null>(null), [computer, setComputer] = useState(connectedDesktop);
  const [projectId, setProjectId] = useState<string | null>(first?.id ?? null);
  const [selected, setSelected] = useState<string[]>(initialIds ? initialIds.split(',').slice(0, 5) : first?.captureIds.slice(0, 5) ?? []);
  const [choosingProject, setChoosingProject] = useState(false);
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareBundle>> | null>(null);
  const [progress, setProgress] = useState(0), [phase, setPhase] = useState(''), [message, setMessage] = useState<string | null>(null);
  const [connectionNote, setConnectionNote] = useState('');
  const cancel = useRef(false), scanLock = useRef(false), task = useTask(), palette = usePalette();
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  const captures = project?.captureIds.map((id) => state.captures.find((item) => item.id === id)!).filter(Boolean) ?? [];
  const validSelected = captures.filter((capture) => selected.includes(capture.id)).map((capture) => capture.id);
  const [directRequested] = useState(() => directSendRequests.has(sendRequest ?? '', initialProject ?? '', initialIds?.split(',') ?? []));
  const directGranted = useRef(false), autoAttempted = useRef(false);
  const selectionMatches = project?.id === initialProject
    && JSON.stringify([...validSelected].sort()) === JSON.stringify((initialIds?.split(',') ?? []).sort());

  useEffect(() => {
    if (!computer) return;
    let alive = true, checking = false;
    const poll = async () => {
      if (checking || AppState.currentState !== 'active') return;
      checking = true;
      try {
        const connected = await checkDesktopConnection();
        if (alive) { if (!connected) setComputer(null); setConnectionNote(connected ? '' : '连接已结束，请重新扫码。'); }
      } catch { if (alive) setConnectionNote('暂时无法连接电脑。请检查 Wi-Fi 和电脑接收是否开启。'); }
      finally { checking = false; }
    };
    void poll(); const timer = setInterval(() => void poll(), 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [computer]);
  useEffect(() => () => { cancel.current = true; }, []);

  function run<T,>(operation: () => Promise<T>) {
    return task.run(async () => { try { return await operation(); } catch (cause) { throw Error(transferError(cause)); } });
  }
  function readCode(raw: string) {
    setScanning(false);
    void run(async () => { setOffer(parsePairingOffer(raw)); setMessage(null); });
  }
  async function send() {
    cancel.current = false; setMessage(null); setPhase('正在确认电脑连接…');
    await run(async () => {
      if (!await checkDesktopConnection()) { setComputer(null); throw new Error('电脑连接已结束，请重新扫码后发送。'); }
      if (cancel.current) throw new Error('发送已暂停，画面仍保留在手机。');
      setPhase('正在准备画面…');
      const bundle = prepared ?? await prepareBundle(state, project!.id, validSelected);
      setPrepared(bundle); setPhase('正在发送到电脑…');
      await transferBundle(bundle, setProgress, () => cancel.current);
      setMessage(`已发送 ${bundle.count} 个画面。请在电脑“手机收件箱”点击“转换并打开”。`);
      setPrepared(null); setProgress(0); setSelected([]);
    });
    setPhase('');
  }
  const sendRequested = useEffectEvent((authorized: boolean) => {
    if (authorized) void send();
    else setConnectionNote('快捷发送请求已失效，请在下方确认发送这批画面。');
  });
  useEffect(() => {
    if (!directRequested || !focused || !computer || task.busy || !validSelected.length || !selectionMatches || autoAttempted.current) return;
    let disposed = false;
    // Defer the one-use claim past development Strict Mode's setup/cleanup replay.
    void Promise.resolve().then(() => {
      if (disposed || autoAttempted.current) return;
      autoAttempted.current = true;
      if (!directGranted.current) directGranted.current = directSendRequests.claim(sendRequest ?? '', initialProject ?? '', initialIds?.split(',') ?? []);
      sendRequested(directGranted.current);
    });
    return () => { disposed = true; };
  }, [directRequested, focused, computer, task.busy, validSelected.length, selectionMatches, sendRequest, initialProject, initialIds]);
  return <Screen title="发送到电脑" subtitle="手机收集画面，电脑继续转换。"
    footer={computer && captures.length ? <>
      {task.busy ? <View style={{ gap: 8 }}><View style={ui.spread}><Label size={13} muted>{phase}</Label><Label size={13}>{Math.round(progress * 100)}%</Label></View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 4, borderRadius: 2, backgroundColor: palette.line, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.max(0, Math.min(100, progress * 100))}%`, backgroundColor: palette.accent }} /></View></View> : <Label size={13} muted>{validSelected.length ? `已选 ${validSelected.length} 个画面 · 每次最多 5 个` : '选择画面后即可发送'}</Label>}
      <Button icon="send" label={prepared ? '重试发送' : `发送${validSelected.length ? ` ${validSelected.length} 个画面` : '到电脑'}`}
        busy={task.busy} disabled={!prepared && !validSelected.length} onPress={() => void send()} />
      {task.busy ? <Button label="暂停发送" quiet small onPress={() => { cancel.current = true; }} /> : null}
      {prepared && !task.busy ? <Button label="取消本次发送" quiet small onPress={() => { setPrepared(null); setProgress(0); }} /> : null}
    </> : undefined}>
    <Notice error message={task.error} /><Notice message={message} />
    {directRequested && !computer && validSelected.length ? <Notice message={`已选好 ${validSelected.length} 个画面。确认连接电脑后，会继续发送这批画面。`} /> : null}
    {!computer ? <Section title="连接你的电脑">
      {!offer && !scanning ? <>
        <Surface><View style={{ alignItems: 'center', paddingVertical: 20, gap: 14 }}><View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: palette.accentSurface, alignItems: 'center', justifyContent: 'center' }}><Icon name="computer" color={palette.accent} size={36} /></View>
          <Label size={20} weight="600">从扫码开始</Label><Label size={14} muted style={{ textAlign: 'center' }}>手机和电脑连接同一 Wi-Fi</Label></View>
          {['打开电脑端 WebToPrototype', '进入“手机收件箱”，生成配对码', '用手机扫码，在电脑确认连接'].map((step, index) => <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: palette.subtle, alignItems: 'center', justifyContent: 'center' }}><Label size={12} muted weight="600">{index + 1}</Label></View><Label size={14} style={{ flex: 1 }}>{step}</Label></View>)}
        </Surface>
        <Button icon="qr" label="扫描电脑二维码" disabled={!transferAvailable} busy={task.busy} onPress={() => void run(async () => {
          const result = permission?.granted ? permission : await requestPermission();
          if (!result.granted) throw Error('请允许相机权限，或使用下方“粘贴配对信息”。');
          scanLock.current = false; setScanning(true); setMessage(null);
        })} />
        <Button label={manual ? '收起手动连接' : '无法扫码？粘贴配对信息'} quiet disabled={task.busy} onPress={() => setManual((value) => !value)} />
      </> : null}
      {scanning ? <>
        <CameraView style={{ height: 300, borderRadius: 12 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => { if (!scanLock.current) { scanLock.current = true; readCode(data); } }}
          onMountError={() => { setScanning(false); setManual(true); setConnectionNote('相机未能打开，可粘贴电脑上的配对信息连接。'); }} />
        <Label muted>将电脑上的二维码放入镜头中。</Label>
        <Button label="取消扫码" quiet onPress={() => setScanning(false)} />
      </> : null}
      {manual && !offer && !scanning ? <>
        <Field label="电脑配对信息" placeholder="在电脑点击“复制配对信息”，粘贴到这里" value={code} maxLength={4096} multiline autoCorrect={false} autoCapitalize="none" onChangeText={setCode} />
        <Button label="继续连接" disabled={!transferAvailable || !code.trim()} busy={task.busy} onPress={() => readCode(code)} />
      </> : null}
      {offer ? <>
        <Label size={22} weight="600">{offer.desktopName}</Label>
        <Label muted>确认这是你的电脑，再点击连接。</Label>
        <Button label={`连接 ${offer.desktopName}`} busy={task.busy} onPress={() => void run(async () => {
          parsePairingOffer(JSON.stringify(offer)); setConnectionNote('请在电脑弹窗中点击“允许连接”。');
          try { const name = await pairDesktop(offer); autoAttempted.current = false; setComputer(name); setOffer(null); setCode(''); setConnectionNote(''); }
          catch (cause) { setOffer(null); setConnectionNote(''); throw cause; }
        })} />
        <Button label="重新扫码" quiet disabled={task.busy} onPress={() => setOffer(null)} />
      </> : null}
      {!transferAvailable ? <Label muted>请在手机 App 中打开此页面，浏览器暂不支持局域网发送。</Label> : null}
      <Notice message={connectionNote} />
    </Section> : <>
      <Surface><View style={ui.spread}><Icon name="computer" color={palette.accent} size={28} />
        <View style={{ flex: 1, gap: 6 }}><Label size={17} weight="600" numberOfLines={2}>{computer}</Label><Badge label={connectionNote ? '请检查连接' : '已连接'} success={!connectionNote} /></View>
        <Button label="断开" quiet small disabled={task.busy} onPress={() => { setComputer(null); setConnectionNote(''); void disconnectDesktop(); }} />
      </View></Surface>
      <Notice message={connectionNote} />
      {connectionNote ? <Button label="重新扫码连接" quiet disabled={task.busy} onPress={() => { setComputer(null); setConnectionNote(''); void disconnectDesktop(); }} /> : null}
      <Section title="选择画面">
        {project ? <>
          <View style={ui.spread}><Label weight="600" style={{ flex: 1 }}>{project.name}</Label>
            {state.projects.length > 1 ? <Button label="更换项目" quiet disabled={task.busy || prepared !== null} onPress={() => setChoosingProject((value) => !value)} /> : null}</View>
          {choosingProject ? <View style={ui.stack}>{state.projects.map((item) => <Button key={item.id} label={item.name} quiet={project?.id !== item.id} disabled={task.busy || prepared !== null}
            onPress={() => { setProjectId(item.id); setSelected(item.captureIds.slice(0, 5)); setChoosingProject(false); }} />)}</View> : null}
          {captures.length ? <>
            <Label size={13} muted>已选 {validSelected.length} / 5 · 点击画面勾选</Label>
            {captures.map((capture) => {
              const checked = selected.includes(capture.id);
              return <Pressable key={capture.id} accessibilityRole="checkbox" accessibilityLabel={capture.title}
                aria-checked={checked}
                accessibilityState={{ checked, disabled: task.busy || prepared !== null || !checked && validSelected.length >= 5 }} disabled={task.busy || prepared !== null || !checked && validSelected.length >= 5}
                onPress={() => setSelected((current) => current.includes(capture.id) ? current.filter((id) => id !== capture.id) : [...current, capture.id])}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
                  backgroundColor: pressed ? palette.subtle : checked ? palette.accentSurface : palette.surface, opacity: !checked && validSelected.length >= 5 ? 0.5 : 1 })}>
                <SelectionMark checked={checked} />
                <View style={{ width: 64 }}><AssetImage id={capture.assetId} ratio={1} /></View>
                <View style={{ flex: 1, gap: 4 }}><Label size={15} weight="600" numberOfLines={2}>{capture.title}</Label><Label size={12} muted>{capture.width} × {capture.height}</Label></View>
              </Pressable>;
            })}
          </> : <Empty title="还没有画面" description="先添加一张截图，或保存一个网页。"><Button label="添加画面" onPress={() => router.push('/capture')} /></Empty>}
        </> : <Empty title="先添加一个画面" description="截图或网页保存后，就可以在这里发送。"><Button label="添加画面" onPress={() => router.push('/capture')} /></Empty>}
      </Section>
    </>}
    {!computer ? <Label size={14} muted>连接后选择画面发送，不需要手动导出文件。电脑接收后可继续转换到 Figma。</Label> : null}
  </Screen>;
}
