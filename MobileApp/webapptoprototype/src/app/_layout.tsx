import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppStateProvider, useAppState } from '@/data/app-state';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Button, Label, Notice, Screen, usePalette } from '@/ui/kit';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
function Routes() {
  const { loading, error, retry } = useAppState();
  useEffect(() => { if (!loading) void SplashScreen.hideAsync().catch(() => undefined); }, [loading]);
  if (loading) return <Screen title="正在打开项目"><Label muted>读取本机保存的素材…</Label></Screen>;
  if (error) return <Screen title="项目暂时无法读取"><Notice error message={error} /><Button label="重新读取" onPress={retry} /></Screen>;
  return <Stack screenOptions={{ headerShown: false }} />;
}
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <Screen title="画面暂时无法打开">
    <Label selectable>{error.message}</Label>
    <Label muted selectable>SDK 57 · Expo Go {Constants.expoVersion ?? '独立安装包'}</Label>
    <Button label="重新打开" onPress={() => void retry()} />
  </Screen>;
}
export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const palette = usePalette();
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: palette.bg, card: palette.surface,
    primary: palette.accent, text: palette.text, border: palette.line } };
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={theme}>
      <AppStateProvider><StatusBar style={dark ? 'light' : 'dark'} /><Routes /></AppStateProvider>
    </ThemeProvider>
  </GestureHandlerRootView>;
}
