import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// Use only bundled React Native views: importing the regular UI would load
// storage, Router and the animation libraries this screen must run before.
export function ExpoGoUpdateRequired({ version, minimum }: { version: string; minimum: string }) {
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <View style={styles.root}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.brand}>Web to Prototype</Text>
    <Text style={styles.title}>请先更新 Expo Go</Text>
    <Text style={styles.text}>当前客户端 {version} 早于此项目要求的 {minimum}，可能在画面加载前闪退。</Text>
    <Text style={styles.text}>在应用商店更新支持 SDK 57 的 Expo Go，完全退出后重新扫码打开项目。</Text>
    <Text style={styles.text}>项目仍使用 SDK 57。更新客户端后即可继续，你的本机项目会保留。</Text>
    <Text selectable style={styles.detail}>Expo Go {version} · 最低版本 {minimum}</Text>
  </ScrollView></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFBFD' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 80, gap: 22, maxWidth: 640, alignSelf: 'center' },
  brand: { fontSize: 14, color: '#566579' },
  title: { fontSize: 28, lineHeight: 38, fontWeight: '700', color: '#152132' },
  text: { fontSize: 17, lineHeight: 27, color: '#152132' },
  detail: { fontSize: 14, lineHeight: 22, color: '#566579' },
});
