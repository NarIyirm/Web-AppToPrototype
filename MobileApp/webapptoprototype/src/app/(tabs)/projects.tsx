import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { useAppState } from '@/data/app-state';
import { AssetImage, Button, Empty, Field, Icon, Label, Notice, Screen, ui, usePalette, useTask } from '@/ui/kit';

export default function ProjectsScreen() {
  const { state, createProject } = useAppState();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const task = useTask(), palette = usePalette();
  async function create() {
    const id = await task.run(() => createProject(name));
    if (id) { setName(''); setCreating(false); router.push({ pathname: '/projects/[id]', params: { id } }); }
  }
  return <Screen title="我的项目" subtitle={state.projects.length ? `${state.projects.length} 个项目，灵感都在这里。` : '按项目整理截图和网页画面。'} scroll={false}
    action={<Button label="新建" icon="plus" small secondary onPress={() => setCreating((value) => !value)} />}>
    <Notice error message={task.error} />
    {creating ? <View style={ui.stack}><Field label="项目名称" placeholder="例如：购物流程" value={name} onChangeText={setName} maxLength={80} autoFocus />
      <View style={ui.row}><Button label="创建项目" busy={task.busy} disabled={!name.trim()} onPress={() => void create()} />
        <Button label="取消" quiet onPress={() => setCreating(false)} /></View></View> : null}
    <FlatList data={state.projects} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
      ListEmptyComponent={<Empty title="还没有项目" description="可以先添加截图，自动创建第一个项目。"><Button label="添加画面" onPress={() => router.push('/capture')} /><Button label="新建空白项目" quiet onPress={() => setCreating(true)} /></Empty>}
      renderItem={({ item }) => {
        const cover = state.captures.find((capture) => capture.id === item.captureIds[0]);
        return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}，${item.captureIds.length} 个画面`}
          onPress={() => router.push({ pathname: '/projects/[id]', params: { id: item.id } })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: pressed ? palette.subtle : palette.surface })}>
          <View style={{ width: 64 }}>{cover ? <AssetImage id={cover.assetId} ratio={1} /> : <View style={{ height: 64, borderRadius: 12, backgroundColor: palette.accentSurface, alignItems: 'center', justifyContent: 'center' }}><Icon name="folder" color={palette.accent} size={28} /></View>}</View>
          <View style={{ flex: 1, gap: 6 }}><Label size={17} weight="600" numberOfLines={2}>{item.name}</Label>
            <Label size={13} muted>{item.captureIds.length} 个画面 · {new Date(item.updatedAt).toLocaleDateString('zh-CN')}</Label></View>
          <Icon name="chevron" color={palette.muted} size={16} />
        </Pressable>;
      }} />
  </Screen>;
}
