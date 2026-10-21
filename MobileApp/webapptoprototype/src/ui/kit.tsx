import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

import { storage } from '@/data/storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaSurface } from '@/ui/safe-area';
import { Icon, type IconName } from '@/ui/icon';
import { colors, radius } from '@/ui/tokens';

export { Icon } from '@/ui/icon';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark ? colors.dark : colors.light;
}
export function Label({ children, size = 16, muted = false, weight = '400', style, ...props }: {
  children: ReactNode; size?: number; muted?: boolean; weight?: '400' | '500' | '600' | '700'; style?: TextStyle;
} & Pick<React.ComponentProps<typeof Text>, 'selectable' | 'numberOfLines' | 'accessibilityRole'>) {
  const palette = usePalette();
  return <Text {...props} style={[{ color: muted ? palette.muted : palette.text, fontSize: size,
    lineHeight: Math.round(size * 1.45), fontWeight: weight }, style]}>{children}</Text>;
}
export function Screen({ title, subtitle, children, back = false, scroll = true, action, footer }: {
  title: string; subtitle?: string; children: ReactNode; back?: boolean; scroll?: boolean; action?: ReactNode; footer?: ReactNode;
}) {
  const palette = usePalette();
  const content = <View style={s.content}>
    <View style={s.heading}>
      {back ? <View style={s.titleRow}><Pressable accessibilityRole="button" accessibilityLabel="返回" hitSlop={4}
        onPress={() => router.canGoBack() ? router.back() : router.replace('/capture')}
        style={({ pressed }) => [s.back, { backgroundColor: pressed ? palette.subtle : 'transparent' }]}>
        <Icon name="back" color={palette.text} size={20} /><Label size={15}>返回</Label>
      </Pressable>{action}</View> : null}
      <View style={s.titleRow}><Label size={back ? 26 : 30} weight="700" accessibilityRole="header" style={{ flex: 1 }}>{title}</Label>{!back ? action : null}</View>
      {subtitle ? <Label size={15} muted>{subtitle}</Label> : null}
    </View>
    {children}
  </View>;
  return <SafeAreaSurface style={{ backgroundColor: palette.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {scroll ? <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    {footer ? <View style={{ backgroundColor: palette.surface, borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth }}>
      <View style={s.footer}>{footer}</View>
    </View> : null}
    </KeyboardAvoidingView>
  </SafeAreaSurface>;
}
export function Button({ label, onPress, quiet = false, busy = false, disabled = false, danger = false, secondary = false, small = false, icon }: {
  label: string; onPress(): void; quiet?: boolean; busy?: boolean; disabled?: boolean; danger?: boolean; secondary?: boolean; small?: boolean; icon?: IconName;
}) {
  const palette = usePalette();
  const unavailable = disabled || busy;
  const foreground = danger ? palette.danger : quiet || secondary ? palette.accent : '#FFFFFF';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable, busy }}
    disabled={unavailable} onPress={onPress} style={({ pressed }) => [s.button,
      { minHeight: quiet || small ? 44 : 52, paddingHorizontal: small ? 10 : 16, paddingVertical: small ? 8 : 12,
        backgroundColor: danger ? palette.dangerSurface : secondary ? palette.accentSurface : quiet ? pressed ? palette.subtle : 'transparent' : palette.primary,
        opacity: unavailable ? 0.45 : pressed ? 0.8 : 1 }]}>
    {busy ? <ActivityIndicator size="small" color={foreground} /> : null}
    {!busy && icon ? <Icon name={icon} color={foreground} size={18} /> : null}
    <Text style={{ color: foreground, fontSize: small ? 14 : 15, lineHeight: 22, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  return <View style={s.field}><Label size={13} weight="600" muted>{label}</Label>
    <TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} {...props}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[s.input, { color: palette.text, backgroundColor: palette.surface, borderColor: focused ? palette.accent : palette.line }, props.style]} />
  </View>;
}
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <View style={s.section}><View style={s.titleRow}><Label size={18} weight="600" accessibilityRole="header" style={{ flex: 1 }}>{title}</Label>{action}</View>{children}</View>;
}
export function Surface({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <View style={[s.surface, { backgroundColor: palette.surface }]}>{children}</View>;
}
export function Notice({ message, error = false }: { message: string | null | undefined; error?: boolean }) {
  const palette = usePalette();
  return message ? <View accessibilityLiveRegion="polite" style={[s.notice, { backgroundColor: error ? palette.dangerSurface : palette.accentSurface }]}>
    <Icon name={error ? 'error' : 'info'} color={error ? palette.danger : palette.accent} size={18} />
    <Label size={14} style={{ flex: 1, color: error ? palette.danger : palette.text }}>{message}</Label></View> : null;
}
export function Empty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  const palette = usePalette();
  return <View style={s.empty}><View style={[s.emptyIcon, { backgroundColor: palette.subtle }]}><Icon name="photo" color={palette.muted} size={28} /></View>
    <Label size={20} weight="600">{title}</Label><Label size={15} muted>{description}</Label>{children}</View>;
}
export function ActionRow({ icon, title, description, onPress, disabled = false, primary = false, expanded }: {
  icon: IconName; title: string; description?: string; onPress(): void; disabled?: boolean; primary?: boolean; expanded?: boolean;
}) {
  const palette = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={description ? `${title}，${description}` : title} accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [s.actionRow, { backgroundColor: pressed ? palette.subtle : palette.surface, opacity: disabled ? 0.45 : 1 }]}>
    <View style={[s.actionIcon, { backgroundColor: primary ? palette.primary : palette.subtle }]}><Icon name={icon} color={primary ? '#FFFFFF' : palette.text} size={23} /></View>
    <View style={{ flex: 1, gap: 4 }}><Label weight="600">{title}</Label>{description ? <Label size={13} muted>{description}</Label> : null}</View>
    <Icon name="chevron" color={palette.muted} size={16} />
  </Pressable>;
}
export function SelectionMark({ checked }: { checked: boolean }) {
  const palette = usePalette();
  return <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: checked ? 0 : 1.5,
    borderColor: palette.muted, backgroundColor: checked ? palette.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
    {checked ? <Icon name="check" color="#FFFFFF" size={15} /> : null}
  </View>;
}
export function Badge({ label, success = false }: { label: string; success?: boolean }) {
  const palette = usePalette();
  return <View style={{ borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
    backgroundColor: success ? palette.successSurface : palette.subtle }}><Label size={12} weight="500" style={{ color: success ? palette.success : palette.muted }}>{label}</Label></View>;
}
export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const palette = usePalette();
  return <View style={{ flexDirection: 'row', gap: 8 }}>{labels.map((label, index) => <View key={label} style={{ flex: 1, gap: 8 }}>
    <View style={{ height: 3, borderRadius: 2, backgroundColor: index <= current ? palette.accent : palette.line }} />
    <Label size={12} weight={index === current ? '600' : '400'} muted={index !== current}>{index + 1}. {label}</Label>
  </View>)}</View>;
}
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const palette = usePalette();
  return <View style={{ gap: 12 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
    onPress={() => setOpen(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Icon name="info" color={palette.muted} size={18} /><Label size={14} muted style={{ flex: 1 }}>{title}</Label>
    <Label size={13} muted>{open ? '收起' : '展开'}</Label>
  </Pressable>{open ? children : null}</View>;
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
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const palette = usePalette();
  useEffect(() => {
    let alive = true;
    storage.assetUri(id).then((uri) => { if (alive) setValue({ id, uri }); })
      .catch(() => { if (alive) setFailure({ id, message: '图片资源无法读取' }); });
    return () => { alive = false; };
  }, [id]);
  return <View style={{ width: '100%', aspectRatio: ratio, maxHeight: 600, backgroundColor: palette.subtle, overflow: 'hidden', borderRadius: 12 }}>
    {value?.id === id ? <Image accessibilityLabel="已保存画面预览" source={value.uri} style={{ width: '100%', height: '100%' }} contentFit={contain ? 'contain' : 'cover'} />
      : <View accessibilityLabel={failure?.id === id ? failure.message : '正在读取画面'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {failure?.id === id ? <Icon name="photo" color={palette.muted} /> : <ActivityIndicator color={palette.muted} size="small" />}</View>}
  </View>;
}
export const ui = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  stack: { gap: 16 }, grow: { flex: 1 }, divider: { height: 1 },
  item: { paddingVertical: 18, gap: 6 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
const s = StyleSheet.create({
  scroll: { flexGrow: 1 }, content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 24 },
  heading: { gap: 8 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  back: { minHeight: 44, flexDirection: 'row', gap: 4, alignItems: 'center', paddingRight: 12, borderRadius: 10, marginLeft: -4 },
  footer: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  button: { borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  field: { gap: 8 }, input: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 14, paddingVertical: 13, minHeight: 52, fontSize: 16, lineHeight: 24 },
  section: { gap: 12 }, surface: { padding: 16, borderRadius: radius.surface, gap: 12 },
  notice: { borderRadius: radius.control, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, empty: { paddingVertical: 24, gap: 14 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.surface, minHeight: 88 },
  actionIcon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
