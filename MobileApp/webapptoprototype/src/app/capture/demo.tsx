import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { LIMITS, type Asset, type Region } from '@/core/project';
import { useAppState } from '@/data/app-state';
import { prepareAppMaterial } from '@/data/app-material';
import { requestDirectSend } from '@/data/direct-send';
import { normalizeImage, pickImage } from '@/data/media';
import { storage } from '@/data/storage';
import { ExampleApp, exampleAppNames, examplePageName, type ExampleAppKind, type ExamplePage } from '@/features/capture/example-app';
import { ImageRegionPicker } from '@/features/capture/image-region-picker';
import { Button, Disclosure, Label, Notice, Screen, Section, Steps, ui, useTask } from '@/ui/kit';

type Draft = { asset: Asset; uri: string; title: string; example: boolean };
export default function CaptureDemoScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { state, createProject, saveCaptures } = useAppState();
  const [stage, setStage] = useState<'intro' | 'browsing' | 'review'>('intro');
  const [kind, setKind] = useState<ExampleAppKind>('shop'), [page, setPage] = useState<ExamplePage>('home');
  const [checked, setChecked] = useState(false), [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null), [region, setRegion] = useState<Region | null>(null);
  const [saved, setSaved] = useState<{ key: string; id: string; projectId: string } | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null), [chooseProject, setChooseProject] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const frame = useRef<ComponentRef<typeof View>>(null), alive = useRef(true);
  const task = useTask();
  const project = state.projects.find(item => item.id === (targetId ?? projectId)) ?? state.projects[0];
  const free = LIMITS.states - (project?.captureIds.length ?? 0);
  const draftKey = draft ? JSON.stringify([draft.asset.id, region, project?.id ?? 'new']) : '';
  const existing = saved?.key === draftKey && state.captures.some(item => item.id === saved.id) ? saved : null;
  const step = stage === 'intro' ? 1 : stage === 'browsing' ? 2 : 3;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function captureExample() {
    await task.run(async () => {
      if (!frame.current || !ready) throw new Error('示例页面还没显示完成，请稍后再采集。');
      let temporary: string | undefined;
      try {
        // Capture only the interactive sample, never the surrounding guidance/buttons.
        temporary = await captureRef(frame, { format: 'png', quality: 1, result: 'tmpfile' });
        const asset = await normalizeImage(temporary), uri = await storage.assetUri(asset.id);
        if (!alive.current) return;
        setDraft({ asset, uri, title: `流程演示 · ${examplePageName(kind, page)}`, example: true });
        setRegion(null); setSaved(null); setMessage('示例画面已读取。现在可以真实裁切、保存和发送。'); setStage('review');
      } finally { if (temporary) releaseCapture(temporary); }
    });
  }
  async function chooseOwnScreenshot() {
    await task.run(async () => {
      const asset = await pickImage(); if (!asset || !alive.current) return;
      const uri = await storage.assetUri(asset.id);
      if (!alive.current) return;
      setDraft({ asset, uri, title: 'App 截图', example: false });
      setRegion(null); setSaved(null); setMessage('已换成你选择的截图。'); setStage('review');
    });
  }
  async function save(send: boolean) {
    await task.run(async () => {
      if (!draft) return;
      let receipt = existing;
      if (!receipt) {
        if (free < 1) throw new Error('当前项目已满，请更换或新建项目。');
        const target = project?.id ?? await createProject('采集体验');
        if (!project) setTargetId(target);
        const asset = region ? await normalizeImage(draft.uri, region) : draft.asset;
        const material = await prepareAppMaterial(asset, draft.title);
        if (draft.example) material.extras.warnings = ['来自内置示例 App 的流程演示，未进行跨 App 系统采集。', ...(material.extras.warnings ?? [])];
        const [id] = await saveCaptures(target, [material]);
        receipt = { key: JSON.stringify([draft.asset.id, region, target]), id, projectId: target };
        if (alive.current) { setSaved(receipt); setMessage('已真实保存到项目。'); }
      }
      if (send && alive.current) router.push({ pathname: '/connect', params: { projectId: receipt.projectId, captureIds: receipt.id,
        selectionKey: requestDirectSend(receipt.projectId, [receipt.id]) } });
    });
  }

  return <Screen title="体验 App 采集" subtitle="用内置示例，走一遍采集到发送的流程。" back
    footer={stage === 'review' && draft ? <><Button icon="send" label={existing ? '发送到电脑转换' : '确认并发送'} busy={task.busy} disabled={free < 1 && !existing} onPress={() => void save(true)} />
      <Button label={existing ? '已保存到项目' : '先保存到项目'} quiet small disabled={task.busy || !!existing || free < 1} onPress={() => void save(false)} /></> : undefined}>
    <Steps labels={['选择示例', '浏览采集', '预览发送']} current={step - 1} />
    <Notice message="当前为内置示例。裁切、保存和发送均为真实操作。" />
    <Notice error message={task.error} /><Notice message={message} />
    {stage === 'intro' ? <>
      <Section title="选择一个示例 App">
        <Label muted>打开示例后，可以点击列表进入详情，找到想转换的页面再采集。</Label>
        <View style={ui.row}>{(['shop', 'tasks'] as const).map(value => <Button key={value} label={exampleAppNames[value]} quiet={kind !== value}
          disabled={task.busy} onPress={() => setKind(value)} />)}</View>
      </Section>
      <View style={ui.stack}>
        <Button label={`打开${exampleAppNames[kind]}`} disabled={task.busy} onPress={() => {
          setPage('home'); setReady(false); setMessage(null); setStage('browsing');
        }} />
        <Disclosure title="正式版本如何采集其他 App？"><Label size={14}>1. 允许系统共享画面。</Label>
          <Label size={14}>2. 打开目标 App，定位到需要的页面。</Label>
          <Label size={14}>3. {Platform.OS === 'android' ? '点击悬浮采集按钮，返回应用预览。' : '在目标页面停留约 3 秒，通过系统录屏入口停止，再返回应用。'}</Label>
        </Disclosure>
      </View>
    </> : null}
    {stage === 'browsing' ? <Section title={`正在浏览 · ${examplePageName(kind, page)}`}>
      <Label muted>点示例中的列表项目进入详情。找到需要的画面后，使用下方按钮返回预览。</Label>
      <View pointerEvents={task.busy ? 'none' : 'auto'}><View ref={frame} collapsable={false} onLayout={event => setReady(event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0)}>
        <ExampleApp kind={kind} page={page} onPageChange={setPage} checked={checked} onToggle={() => setChecked(value => !value)} />
      </View></View>
      <Button label={Platform.OS === 'ios' ? '模拟停止并返回预览' : '采集当前示例页'} busy={task.busy} disabled={!ready}
        onPress={() => void captureExample()} />
      <Label size={13} muted>{Platform.OS === 'ios' ? '正式 iPhone 采集由系统录屏入口停止。这里用按钮演示返回后的操作。' : '这里采集的是本应用里的示例页面，正式版本由目标 App 上的悬浮按钮触发。'}</Label>
      <Button label="返回开始指引" quiet disabled={task.busy} onPress={() => setStage('intro')} />
    </Section> : null}
    {stage === 'review' && draft ? <Section title={existing ? '画面已保存，可以发送' : '确认要转换的画面'}>
      <Label size={14} muted>{draft.example ? '当前是内置示例画面，发送后会在电脑真实转换。' : '当前是你选择的截图，可在电脑真实转换。'}</Label>
      <ImageRegionPicker key={draft.asset.id} uri={draft.uri} width={draft.asset.width} height={draft.asset.height} region={region} onChange={setRegion} disabled={task.busy} />
      <Button label="再体验一个页面" quiet disabled={task.busy} onPress={() => { setMessage(null); setStage('intro'); }} />
    </Section> : null}
    {stage !== 'browsing' ? <Button label="换成我自己的 App 截图" quiet disabled={task.busy} onPress={() => void chooseOwnScreenshot()} /> : null}
    <View style={ui.spread}><View style={{ flex: 1, gap: 4 }}><Label size={14}>保存到：{project?.name ?? '采集体验'}</Label><Label size={13} muted>还可保存 {free} 个画面</Label></View>
      <Button label={chooseProject ? '收起项目' : '更换项目'} quiet disabled={task.busy} onPress={() => setChooseProject(value => !value)} /></View>
    {chooseProject ? <View style={ui.stack}>{state.projects.map(item => <Button key={item.id} label={item.name} quiet={project?.id !== item.id} disabled={task.busy} onPress={() => setTargetId(item.id)} />)}
      <Button label="新建体验项目" quiet disabled={task.busy} onPress={() => void task.run(async () => setTargetId(await createProject('采集体验')))} /></View> : null}
  </Screen>;
}
