import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { storage } from '@/data/storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaSurface } from '@/ui/safe-area';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark ? { bg: '#101215', surface: '#1B1E23', text: '#F3F5F8', muted: '#A8B2C0',
    line: '#343B45', accent: '#85B8FF', accentSurface: '#1A3457', danger: '#FFAEAA', success: '#88D6B4' }
    : { bg: '#FAFBFD', surface: '#FFFFFF', text: '#152132', muted: '#566579',
      line: '#DDE3EC', accent: '#0965CB', accentSurface: '#E9F2FF', danger: '#AE2928', success: '#19684B' };
}
export function Label({ children, size = 16, muted = false, weight = '400', style, ...props }: {
  children: ReactNode; size?: number; muted?: boolean; weight?: '400' | '500' | '600' | '700'; style?: TextStyle;
} & Pick<React.ComponentProps<typeof Text>, 'selectable' | 'numberOfLines' | 'accessibilityRole'>) {
  const palette = usePalette();
  return <Text {...props} style={[{ color: muted ? palette.muted : palette.text, fontSize: size,
    lineHeight: Math.round(size * 1.45), fontWeight: weight }, style]}>{children}</Text>;
}
export function Screen({ title, subtitle, children, back = false, scroll = true, action }: {
  title: string; subtitle?: string; children: ReactNode; back?: boolean; scroll?: boolean; action?: ReactNode;
}) {
  const palette = usePalette();
  const content = <View style={s.content}>
    <View style={s.heading}>
      {back ? <Button label="‹ 返回" quiet onPress={() => router.canGoBack() ? router.back() : router.replace('/capture')} />
        : null}
      <View style={s.titleRow}><Label size={26} weight="700" accessibilityRole="header">{title}</Label>{action}</View>
      {subtitle ? <Label size={15} muted>{subtitle}</Label> : null}
    </View>
    {children}
  </View>;
  return <SafeAreaSurface style={{ backgroundColor: palette.bg }}>
    {scroll ? <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{content}</ScrollView> : content}
  </SafeAreaSurface>;
}
export function Button({ label, onPress, quiet = false, busy = false, disabled = false, danger = false }: {
  label: string; onPress(): void; quiet?: boolean; busy?: boolean; disabled?: boolean; danger?: boolean;
}) {
  const palette = usePalette();
  const unavailable = disabled || busy;
  const foreground = danger ? palette.danger : quiet ? palette.accent : '#FFFFFF';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: unavailable, busy }}
    disabled={unavailable} onPress={onPress} style={({ pressed }) => [s.button,
      { backgroundColor: quiet || danger ? 'transparent' : '#0965CB', opacity: unavailable ? 0.5 : pressed ? 0.72 : 1 }]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : null}
    <Text style={{ color: foreground, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const palette = usePalette();
  return <View style={s.field}><Label size={13} weight="600" muted>{label}</Label>
    <TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} {...props}
      style={[s.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.line }, props.style]} />
  </View>;
}
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <View style={s.section}><View style={s.titleRow}><Label size={18} weight="600">{title}</Label>{action}</View>{children}</View>;
}
export function Surface({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <View style={[s.surface, { backgroundColor: palette.surface, borderColor: palette.line }]}>{children}</View>;
}
export function Notice({ message, error = false }: { message: string | null | undefined; error?: boolean }) {
  const palette = usePalette();
  return message ? <View accessibilityLiveRegion="polite" style={[s.notice, { borderColor: error ? palette.danger : palette.line }]}>
    <Label size={14}>{message}</Label></View> : null;
}
export function Empty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <View style={s.empty}><Label size={20} weight="600">{title}</Label><Label size={15} muted>{description}</Label>{children}</View>;
}
export function useTask() {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run<T,>(task: () => Promise<T>): Promise<T | undefined> {
    if (running.current) return;
    running.current = true; setBusy(true); setError(null);
    try { return await task(); }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '操作未完成，请重试。'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }
  return { busy, error, run };
}
export function AssetImage({ id, ratio, contain = false }: { id: string; ratio: number; contain?: boolean }) {
  const [value, setValue] = useState<{ id: string; uri: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const palette = usePalette();
  useEffect(() => {
    let alive = true;
    storage.assetUri(id).then((uri) => { if (alive) setValue({ id, uri }); })
      .catch(() => { if (alive) setFailure('图片资源无法读取'); });
    return () => { alive = false; };
  }, [id]);
  return <View style={{ width: '100%', aspectRatio: ratio, maxHeight: 600, backgroundColor: palette.surface, overflow: 'hidden', borderRadius: 10 }}>
    {value?.id === id ? <Image accessibilityLabel="已保存画面预览" source={value.uri} style={{ width: '100%', height: '100%' }} contentFit={contain ? 'contain' : 'cover'} />
      : <View style={s.empty}><Label size={13} muted>{failure ?? '正在读取画面…'}</Label></View>}
  </View>;
}
export const ui = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  stack: { gap: 16 }, grow: { flex: 1 }, divider: { height: 1 },
  item: { paddingVertical: 18, gap: 6 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
const s = StyleSheet.create({
  scroll: { flexGrow: 1 }, content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, paddingBottom: 40, gap: 28 },
  heading: { gap: 12 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  wordmark: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }, mark: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  field: { gap: 8 }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, minHeight: 50, fontSize: 16, lineHeight: 24 },
  section: { gap: 16 }, surface: { padding: 20, borderWidth: 1, borderRadius: 14, gap: 16 },
  notice: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }, empty: { paddingVertical: 28, gap: 12 },
});
