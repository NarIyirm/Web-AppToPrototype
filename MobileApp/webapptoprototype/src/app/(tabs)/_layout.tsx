import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { usePalette } from '@/ui/kit';

export default function TabLayout() {
  const palette = usePalette();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.accent,
    tabBarInactiveTintColor: palette.muted, tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '500' }, tabBarItemStyle: { paddingTop: 4 },
    sceneStyle: { backgroundColor: palette.bg } }}>
    <Tabs.Screen name="capture" options={{ title: '添加画面', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'plus.square', android: 'add_photo_alternate', web: 'add_photo_alternate' }} tintColor={color} size={22} /> }} />
    <Tabs.Screen name="projects" options={{ title: '我的项目', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} tintColor={color} size={22} /> }} />
    <Tabs.Screen name="connect" options={{ title: '发送到电脑', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'desktopcomputer', android: 'computer', web: 'computer' }} tintColor={color} size={22} /> }} />
  </Tabs>;
}
