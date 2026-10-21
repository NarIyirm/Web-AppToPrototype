import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { dragRegionFromPage, type CropAnchor } from '@/core/app-capture';
import type { Region } from '@/core/project';
import { Button, Field, Label, ui, usePalette } from '@/ui/kit';
import { SafeAreaModal } from '@/ui/safe-area';

type Size = { width: number; height: number };
type ImageProps = { uri: string; width: number; height: number; region: Region | null };

export function ImageRegionPicker({ uri, width, height, region, onChange, disabled = false }: ImageProps & {
  onChange(region: Region | null): void; disabled?: boolean;
}) {
  const palette = usePalette();
  const [availableWidth, setAvailableWidth] = useState(280), [editing, setEditing] = useState(false), [precise, setPrecise] = useState(false);
  const [draft, setDraft] = useState<Region | null>(null);
  const [editorSize, setEditorSize] = useState<Size>({ width: 280, height: 420 });
  const previewWidth = Math.min(availableWidth, 420 * width / height);
  const editorWidth = Math.min(Math.max(1, editorSize.width - 32), Math.max(1, editorSize.height - 32) * width / height);
  const shown = region ?? { x: 0, y: 0, width, height };
  return <View style={ui.stack}>
    <View onLayout={event => setAvailableWidth(Math.max(1, event.nativeEvent.layout.width))} style={styles.stage}>
      <CropImage uri={uri} width={width} height={height} region={region} display={{ width: previewWidth, height: previewWidth * height / width }} />
    </View>
    <View style={ui.row}>
      <Button label="整张画面" quiet={region !== null} disabled={disabled} onPress={() => onChange(null)} />
      <Button label="框选部分" quiet disabled={disabled} onPress={() => {
        Keyboard.dismiss(); setDraft(region); setEditing(true);
      }} />
    </View>
    <Label size={13} muted>{region ? `将转换所选区域 · ${region.width} × ${region.height} px` : `将转换整张画面 · ${width} × ${height} px`}</Label>
    <Button label={precise ? '收起精确范围' : '输入精确范围'} quiet disabled={disabled} onPress={() => setPrecise(value => !value)} />
    {precise ? <View style={ui.row}>{(['x', 'y', 'width', 'height'] as const).map(key => <View key={key} style={styles.field}>
      <Field label={{ x: '左侧 X', y: '顶部 Y', width: '宽度', height: '高度' }[key]} value={String(shown[key])} keyboardType="number-pad" editable={!disabled} selectTextOnFocus
        onChangeText={text => {
          if (!/^\d+$/.test(text)) return;
          const next = { ...shown, [key]: Number(text) };
          if (next.width > 0 && next.height > 0 && next.x + next.width <= width && next.y + next.height <= height) onChange(next);
        }} />
    </View>)}</View> : null}
    <SafeAreaModal visible={editing} onClose={() => setEditing(false)} style={{ backgroundColor: palette.bg }}>
      <View testID="crop-toolbar" style={[styles.toolbar, { borderColor: palette.line }]}>
        <Button label="取消" quiet onPress={() => setEditing(false)} />
        <Label size={18} weight="600" style={{ flex: 1, textAlign: 'center' }}>框选部分</Label>
        <Button label="完成框选" disabled={disabled} onPress={() => { onChange(draft); setEditing(false); }} />
      </View>
      <View style={styles.workspace} onLayout={event => {
        const next = event.nativeEvent.layout;
        setEditorSize(previous => previous.width === next.width && previous.height === next.height ? previous : { width: next.width, height: next.height });
      }}>
        {editing ? <CropImage key={`${uri}:${editorWidth}`} uri={uri} width={width} height={height} region={draft}
          display={{ width: editorWidth, height: editorWidth * height / width }} onChange={setDraft} disabled={disabled} /> : null}
      </View>
      <View testID="crop-footer" style={[styles.footer, { borderColor: palette.line }]}>
        <Label size={14} muted numberOfLines={1}>{draft ? `已选 ${draft.width} × ${draft.height} px` : '尚未框选，将保留整张画面'}</Label>
        <Label size={13} muted>在图片上拖动框选。重新拖动可重画，页面不会滚动。</Label>
        <Button label="重置为整张" quiet onPress={() => setDraft(null)} />
      </View>
    </SafeAreaModal>
  </View>;
}

function CropImage({ uri, width, height, region, display, onChange, disabled = false }: ImageProps & {
  display: Size; onChange?(region: Region): void; disabled?: boolean;
}) {
  const palette = usePalette(), anchor = useRef<CropAnchor | null>(null);
  const shown = region ?? { x: 0, y: 0, width, height };
  const selected = { left: shown.x / width * display.width, top: shown.y / height * display.height,
    width: shown.width / width * display.width, height: shown.height / height * display.height };
  function update(event: GestureResponderEvent) {
    if (!anchor.current || disabled) return;
    const next = dragRegionFromPage(anchor.current, event.nativeEvent, display, { width, height });
    if (next) onChange?.(next);
  }
  return <View style={{ width: display.width, height: display.height, backgroundColor: '#101215' }}>
    <Image pointerEvents="none" source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="待转换画面预览" cachePolicy="none" />
    <View testID={onChange ? 'crop-editor-image' : 'crop-preview-image'} collapsable={false} style={StyleSheet.absoluteFill} pointerEvents={onChange ? 'box-only' : 'none'}
      accessibilityLabel={onChange ? '在图片上单指拖动框选范围' : undefined}
      onStartShouldSetResponder={() => !!onChange && !disabled}
      onStartShouldSetResponderCapture={() => !!onChange && !disabled}
      onMoveShouldSetResponder={() => !!onChange && !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => {
        if (event.nativeEvent.touches.length !== 1) { anchor.current = null; return; }
        const { locationX, locationY, pageX, pageY } = event.nativeEvent;
        anchor.current = { x: locationX, y: locationY, pageX, pageY };
      }}
      onResponderMove={event => {
        if (event.nativeEvent.touches.length !== 1) { anchor.current = null; return; }
        update(event);
      }}
      onResponderRelease={event => { update(event); anchor.current = null; }}
      onResponderTerminate={() => { anchor.current = null; }}>
      {region ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.shade, { top: 0, height: selected.top, left: 0, right: 0 }]} />
        <View style={[styles.shade, { top: selected.top + selected.height, bottom: 0, left: 0, right: 0 }]} />
        <View style={[styles.shade, { top: selected.top, height: selected.height, left: 0, width: selected.left }]} />
        <View style={[styles.shade, { top: selected.top, height: selected.height, left: selected.left + selected.width, right: 0 }]} />
        <View testID="crop-selection" style={[styles.selection, selected, { borderColor: palette.accent }]} />
      </View> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { width: '100%', alignItems: 'center', backgroundColor: '#101215', borderRadius: 10, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
  workspace: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101215', overflow: 'hidden' },
  footer: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderTopWidth: 1 },
  selection: { position: 'absolute', borderWidth: 2 }, shade: { position: 'absolute', backgroundColor: '#00000099' },
  field: { flex: 1, minWidth: 100 },
});
