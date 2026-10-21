import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { commit, LIMITS } from '@/core/project';
import { newId, renameProject, useAppState } from '@/data/app-state';
import { exportBundle } from '@/data/export-bundle';
import { pickImage } from '@/data/media';
import { AssetImage, Button, Empty, Field, Icon, Label, Notice, Screen, Section, SelectionMark, ui, usePalette, useTask } from '@/ui/kit';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectEditor key={id} id={id} />;
}
function ProjectEditor({ id }: { id: string }) {
  const { state, update, saveCapture } = useAppState();
  const project = state.projects.find((item) => item.id === id);
  const [editing, setEditing] = useState(false), [name, setName] = useState(project?.name ?? '');
  const [deleting, setDeleting] = useState(false);
  const [more, setMore] = useState(false), [reordering, setReordering] = useState(false), [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<string[]>(project?.captureIds.slice(0, LIMITS.batch) ?? []);
  const [receipt, setReceipt] = useState<string | null>(null);
  const task = useTask(), palette = usePalette();
  if (!project) return <Screen title="项目不存在" back><Label muted>项目可能已被删除，其他保存内容仍然保留。</Label></Screen>;
  const captures = project.captureIds.map((captureId) => state.captures.find((item) => item.id === captureId)!);
  async function importImage() {
    const captureId = await task.run(async () => {
      const asset = await pickImage();
      return asset ? saveCapture(id, asset) : null;
    });
    if (captureId) router.push({ pathname: '/captures/[id]', params: { id: captureId } });
  }
  function reorder(captureId: string, direction: -1 | 1) {
    void task.run(() => update((current) => commit(current, (next) => {
      const item = next.projects.find((value) => value.id === id)!;
      const from = item.captureIds.indexOf(captureId), to = from + direction;
      if (from < 0 || to < 0 || to >= item.captureIds.length) throw new Error('无法继续调整顺序。');
      [item.captureIds[from], item.captureIds[to]] = [item.captureIds[to], item.captureIds[from]];
    })));
  }
  async function removeProject() {
    const result = await task.run(() => update((current) => commit(current, (next) => {
      next.projects = next.projects.filter((item) => item.id !== id);
      next.captures = next.captures.filter((item) => item.projectId !== id);
    })));
    if (result) router.replace('/projects');
  }
  function openSend() {
    router.push({ pathname: '/connect', params: { projectId: id, captureIds: project!.captureIds.filter((value) => selected.includes(value)).join(','), selectionKey: newId('selection') } });
  }
  return <Screen title={project.name} subtitle={`${captures.length} 个画面 · 已保存在手机`} back
    action={<Button label="重命名" small quiet onPress={() => setEditing((value) => !value)} />}
    footer={captures.length > 0 ? <><Label size={13} muted>已选 {selected.filter((value) => project.captureIds.includes(value)).length} / {LIMITS.batch} 个画面</Label>
      <Button icon="send" label="发送到电脑" disabled={task.busy || !selected.some((value) => project.captureIds.includes(value))}
        onPress={openSend} /></> : undefined}>
    <Notice error message={task.error} /><Notice message={receipt} />
    {editing ? <View style={ui.stack}><Field label="项目名称" value={name} maxLength={80} onChangeText={setName} />
      <Button label="保存名称" busy={task.busy} disabled={!name.trim()} onPress={() => void task.run(async () => { await update((current) => renameProject(current, id, name)); setEditing(false); })} /></View> : null}
    <View style={ui.row}><Button label="导入截图" icon="plus" secondary busy={task.busy} disabled={captures.length >= LIMITS.states} onPress={() => void importImage()} />
      <Button label="采集网页" icon="web" quiet onPress={() => router.push({ pathname: '/capture', params: { projectId: id } })} /></View>
    {!captures.length ? <Empty title="把第一个状态放进来" description="可以从相册导入截图，或在采集页打开网页。" />
      : <Section title="选择画面" action={<Button label={reordering ? '完成排序' : '调整顺序'} quiet onPress={() => setReordering((value) => !value)} />}><Label size={14} muted>勾选要发送的画面，最多 5 个。点击缩略图可编辑。</Label>
        {captures.map((capture, index) => <View key={capture.id} style={{ backgroundColor: palette.surface, padding: 8, borderRadius: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable accessibilityRole="checkbox" accessibilityLabel={`选择${capture.title}`} accessibilityState={{ checked: selected.includes(capture.id), disabled: !selected.includes(capture.id) && selected.length >= LIMITS.batch }}
              aria-checked={selected.includes(capture.id)}
              disabled={!selected.includes(capture.id) && selected.length >= LIMITS.batch}
              style={{ minWidth: 44, minHeight: 64, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setSelected((current) => current.includes(capture.id) ? current.filter((value) => value !== capture.id)
                : current.length < LIMITS.batch ? [...current, capture.id] : current)}>
              <SelectionMark checked={selected.includes(capture.id)} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`编辑${capture.title}`} style={{ flex: 1, gap: 12, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}
              onPress={() => router.push({ pathname: '/captures/[id]', params: { id: capture.id } })}>
              <View style={{ width: 60 }}><AssetImage id={capture.assetId} ratio={1} /></View>
              <View style={{ flex: 1, gap: 4 }}><Label size={15} weight="600" numberOfLines={2}>{capture.title}</Label>
                <Label size={12} muted>{capture.sourceKind === 'web' ? '网页' : 'App 画面'} · {capture.width} × {capture.height}</Label></View>
              <Icon name="chevron" color={palette.muted} size={14} />
            </Pressable>
          </View>
          {reordering ? <View style={ui.row}><Button label="上移" quiet disabled={index === 0 || task.busy} onPress={() => reorder(capture.id, -1)} />
            <Button label="下移" quiet disabled={index === captures.length - 1 || task.busy} onPress={() => reorder(capture.id, 1)} /></View> : null}
        </View>)}
        <Button label={exporting ? '收起文件导出' : '其他方式：导出文件'} quiet onPress={() => setExporting((value) => !value)} />
        {exporting ? <Button label="生成文件并分享" busy={task.busy}
          disabled={!selected.some((value) => project.captureIds.includes(value))}
          onPress={() => void task.run(async () => {
            const result = await exportBundle(state, id, project.captureIds.filter((value) => selected.includes(value)));
            setReceipt(`已生成 ${result.count} 个画面的素材包。分享或下载完成后，在电脑转换。`);
          })} /> : null}
      </Section>}
    <Button label={more ? '收起项目操作' : '更多项目操作'} quiet onPress={() => setMore((value) => !value)} />
    {more ? <View style={ui.stack}>{deleting ? <><Notice message="删除后，项目和画面将从列表移除。已经发送的素材不受影响。" />
      <View style={ui.row}><Button label="确认删除项目" danger busy={task.busy} onPress={() => void removeProject()} />
        <Button label="保留项目" quiet onPress={() => setDeleting(false)} /></View></>
      : <Button label="删除项目" danger onPress={() => setDeleting(true)} />}</View> : null}
  </Screen>;
}
