import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { useAppState } from '@/data/app-state';
import { Button, Empty, Field, Label, Notice, Screen, ui, usePalette, useTask } from '@/ui/kit';

export default function ProjectsScreen() {
  const { state, createProject } = useAppState();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const task = useTask(), palette = usePalette();
  async function create() {
    const id = await task.run(() => createProject(name));
    if (id) { setName(''); setCreating(false); router.push({ pathname: '/projects/[id]', params: { id } }); }
  }
  return <Screen title="我的项目" subtitle="查看已保存的画面，选择后发送到电脑。" scroll={false}
    action={<Button label="新建项目" quiet onPress={() => setCreating((value) => !value)} />}>
    <Notice error message={task.error} />
    {creating ? <View style={ui.stack}><Field label="项目名称" placeholder="例如：购物流程" value={name} onChangeText={setName} maxLength={80} autoFocus />
      <View style={ui.row}><Button label="创建项目" busy={task.busy} disabled={!name.trim()} onPress={() => void create()} />
        <Button label="取消" quiet onPress={() => setCreating(false)} /></View></View> : null}
    <FlatList data={state.projects} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 24 }}
      ListEmptyComponent={<Empty title="还没有项目" description="可以先添加截图，自动创建第一个项目。"><Button label="添加画面" onPress={() => router.push('/capture')} /><Button label="新建空白项目" quiet onPress={() => setCreating(true)} /></Empty>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/projects/[id]', params: { id: item.id } })}
        style={[ui.item, { borderBottomWidth: 1, borderBottomColor: palette.line }]}>
        <View style={ui.spread}><Label size={18} weight="600">{item.name}</Label><Label muted>›</Label></View>
        <Label size={14} muted>{item.captureIds.length} 个画面 · {new Date(item.updatedAt).toLocaleDateString('zh-CN')}</Label>
      </Pressable>} />
  </Screen>;
}
