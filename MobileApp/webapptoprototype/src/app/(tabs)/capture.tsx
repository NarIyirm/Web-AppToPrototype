import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppState } from '@/data/app-state';
import { pickImage } from '@/data/media';
import { AssetImage, Button, Field, Label, Notice, Screen, Section, ui, usePalette, useTask } from '@/ui/kit';

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
  return <Screen title="添加画面" subtitle="保存截图或网页，再发送到电脑制作原型。">
    <Notice message={notice} /><Notice error message={task.error} />
    <View style={ui.spread}><View style={{ flex: 1, gap: 4 }}><Label size={13} muted>保存到项目</Label><Label weight="600">{project?.name ?? '我的第一个项目'}</Label></View>
      {state.projects.length > 1 ? <Button label={chooseProject ? '收起' : '更换'} quiet onPress={() => setChooseProject((value) => !value)} /> : null}</View>
      {chooseProject ? <View style={ui.stack}>{state.projects.map((item) => <Pressable key={item.id}
        accessibilityRole="button" accessibilityState={{ selected: item.id === project?.id }} onPress={() => { setChosen(item.id); setChooseProject(false); }}
        style={{ minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1,
          borderColor: item.id === project?.id ? palette.accent : palette.line,
          backgroundColor: item.id === project?.id ? palette.accentSurface : palette.surface }}><Label size={14}>{item.name}</Label></Pressable>)}</View> : null}
    <View style={ui.stack}>
      <Button label="从相册导入截图" busy={task.busy} onPress={() => void importImage()} />
      <Button label="转换手机 App 画面" quiet disabled={task.busy} onPress={() => router.push({ pathname: '/capture/native', params: { projectId: project?.id ?? '' } })} />
      <Button label={webEntry ? '收起网页地址' : '打开网页并保存画面'} quiet disabled={task.busy} onPress={() => setWebEntry((value) => !value)} />
    </View>
    {webEntry ? <Section title="网页地址">
      <Field label="网页地址" value={url} onChangeText={setUrl} placeholder="https://example.com" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={() => { if (url.trim()) void openWeb(); }} />
      <Button label="打开网页" busy={task.busy} disabled={!url.trim()} onPress={() => void openWeb()} />
    </Section> : null}
    {recent.length ? <Section title="最近保存" action={<Button label="查看项目" quiet onPress={() => router.push({ pathname: '/projects/[id]', params: { id: project!.id } })} />}>
      <View style={ui.row}>{recent.map((capture) => <Pressable key={capture.id} accessibilityRole="button" accessibilityLabel={`打开${capture.title}`}
        style={{ flex: 1, minWidth: 120, gap: 8 }} onPress={() => router.push({ pathname: '/captures/[id]', params: { id: capture.id } })}>
        <AssetImage id={capture.assetId} ratio={1.2} /><Label size={14} numberOfLines={1}>{capture.title}</Label>
      </Pressable>)}</View>
    </Section> : null}
    <Section title="下一步">
      <Label muted>{recent.length ? '画面已保存在手机。连接电脑后，勾选画面即可发送。' : '添加画面后，打开“发送到电脑”扫码连接。'}</Label>
      <Button label="连接电脑并发送" quiet onPress={() => router.push({ pathname: '/connect', params: { projectId: project?.id ?? '', selectionKey: String(Date.now()) } })} />
    </Section>
  </Screen>;
}
