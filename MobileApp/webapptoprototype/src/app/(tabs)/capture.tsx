import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppState } from '@/data/app-state';
import { pickImage } from '@/data/media';
import { ActionRow, AssetImage, Badge, Button, Field, Icon, Label, Notice, Screen, Section, SelectionMark, Surface, ui, usePalette, useTask } from '@/ui/kit';

export default function CaptureScreen() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  return <CaptureHome key={projectId ?? 'capture-home'} projectId={projectId} />;
}
function CaptureHome({ projectId }: { projectId?: string }) {
  const { state, notice, createProject, saveCapture } = useAppState();
  const [chosen, setChosen] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [webEntry, setWebEntry] = useState(false), [chooseProject, setChooseProject] = useState(false);
  const task = useTask();
  const palette = usePalette();
  const project = state.projects.find((item) => item.id === (chosen ?? projectId)) ?? state.projects[0];
  const recent = state.captures.filter((item) => item.projectId === project?.id).slice(-2).reverse();
  async function ensureProject() { return project?.id ?? await createProject('我的第一个项目'); }
  async function importImage() {
    const id = await task.run(async () => {
      const asset = await pickImage();
      if (!asset) return null;
      return saveCapture(await ensureProject(), asset);
    });
    if (id) router.push({ pathname: '/captures/[id]', params: { id } });
  }
  async function openWeb() {
    const id = await task.run(async () => {
      const normalized = new URL(url.includes('://') ? url : `https://${url}`);
      if (!['https:', 'http:'].includes(normalized.protocol) || !normalized.hostname || normalized.username || normalized.password) throw new Error('请输入有效的 HTTP 或 HTTPS 网页地址。');
      return { projectId: await ensureProject(), url: normalized.href };
    });
    if (id) router.push({ pathname: '/capture/web', params: id });
  }
  return <Screen title="添加画面" subtitle="收集灵感，把 App 和网页带到 Figma。">
    <Notice message={notice} /><Notice error message={task.error} />
    <Surface><View style={ui.spread}><Icon name="folder" color={palette.accent} size={22} /><View style={{ flex: 1, gap: 3 }}><Label size={12} muted>画面将保存到</Label><Label size={15} weight="600" numberOfLines={2}>{project?.name ?? '我的第一个项目'}</Label></View>
      {state.projects.length > 1 ? <Button label={chooseProject ? '收起' : '更换'} small quiet onPress={() => setChooseProject((value) => !value)} /> : <Badge label="本机保存" />}</View>
      {chooseProject ? <View style={ui.stack}>{state.projects.map((item) => <Pressable key={item.id}
        accessibilityRole="button" accessibilityState={{ selected: item.id === project?.id }} onPress={() => { setChosen(item.id); setChooseProject(false); }}
        style={[ui.spread, { minHeight: 48, paddingVertical: 8 }]}><Label size={14} style={{ flex: 1 }}>{item.name}</Label><SelectionMark checked={item.id === project?.id} /></Pressable>)}</View> : null}</Surface>
    <Section title="选择添加方式">
      <ActionRow icon="photo" title={task.busy ? '正在处理画面…' : '导入截图'} description="从相册选取，预览后发送到电脑" primary disabled={task.busy} onPress={() => void importImage()} />
      <ActionRow icon="app" title="转换 App 画面" description="采集其他 App，或用截图快速开始" disabled={task.busy} onPress={() => router.push({ pathname: '/capture/native', params: { projectId: project?.id ?? '' } })} />
      <ActionRow icon="web" title="采集网页" description="打开网址，保存整页或选定区域" expanded={webEntry} disabled={task.busy} onPress={() => setWebEntry((value) => !value)} />
    </Section>
    {webEntry ? <Section title="网页地址">
      <Field label="网页地址" value={url} onChangeText={setUrl} placeholder="https://example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={() => { if (url.trim()) void openWeb(); }} />
      <Button label="打开网页" busy={task.busy} disabled={!url.trim()} onPress={() => void openWeb()} />
    </Section> : null}
    {recent.length ? <Section title="最近保存" action={<Button label="查看全部" small quiet onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project!.id } })} />}>
      <View style={ui.row}>{recent.map((capture) => <Pressable key={capture.id} accessibilityRole="button" accessibilityLabel={`打开${capture.title}`}
        style={{ flex: 1, minWidth: 100, gap: 8 }} onPress={() => router.push({ pathname: '/captures/[id]', params: { id: capture.id } })}>
        <AssetImage id={capture.assetId} ratio={1.2} /><Label size={14} numberOfLines={1}>{capture.title}</Label>
      </Pressable>)}</View>
    </Section> : null}
    <ActionRow icon="computer" title="在电脑继续制作" description="同一 Wi-Fi 下扫码连接，再转换到 Figma" onPress={() => router.push({ pathname: '/connect', params: { projectId: project?.id ?? '', selectionKey: String(Date.now()) } })} />
  </Screen>;
}
