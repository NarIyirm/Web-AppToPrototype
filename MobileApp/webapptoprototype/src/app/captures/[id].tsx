import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { commit, removeCapture, type Region } from '@/core/project';
import { useAppState } from '@/data/app-state';
import { normalizeImage } from '@/data/media';
import { storage } from '@/data/storage';
import { recognizeText, redactImage, visionAvailable } from '@/data/vision';
import { AssetImage, Button, Field, Label, Notice, Screen, Section, ui, useTask } from '@/ui/kit';

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CaptureEditor key={id} id={id} />;
}
function CaptureEditor({ id }: { id: string }) {
  const { state, update, saveCapture } = useAppState();
  const capture = state.captures.find((item) => item.id === id);
  const [title, setTitle] = useState(capture?.title ?? '');
  const [crop, setCrop] = useState({ x: '0', y: '0', width: String(capture?.width ?? 0), height: String(capture?.height ?? 0) });
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false), [toolsOpen, setToolsOpen] = useState(false), [textOpen, setTextOpen] = useState(false), [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState(capture?.observations.slice(0, 100).map((item) => item.text) ?? []);
  const task = useTask();
  if (!capture) return <Screen title="画面不存在" back><Label muted>返回项目，查看仍然保存的画面。</Label></Screen>;
  const current = capture;
  async function transform(rotation = 0) {
    const nextId = await task.run(async () => {
      const region = Object.fromEntries(Object.entries(crop).map(([key, value]) => [key, Number(value)])) as Region;
      if (Object.values(region).some((value) => !Number.isInteger(value)) || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1
        || region.x + region.width > current.width || region.y + region.height > current.height) throw new Error('请填写原图范围内的整数裁切坐标。');
      const uri = await storage.assetUri(current.assetId);
      const asset = await normalizeImage(uri, rotation ? undefined : region, rotation);
      return saveCapture(current.projectId, asset, { title: `${current.title.slice(0, 70)} ${rotation ? '旋转' : '裁切'}`,
        sourceKind: current.sourceKind, sourceUrl: current.sourceUrl,
        redacted: current.redacted,
        warnings: ['此画面为处理后的图片，文字观察需要重新识别。'] });
    });
    if (nextId) router.replace({ pathname: '/captures/[id]', params: { id: nextId } });
  }
  function selectedRegion(): Region {
    const region = Object.fromEntries(Object.entries(crop).map(([key, value]) => [key, Number(value)])) as Region;
    if (Object.values(region).some((value) => !Number.isInteger(value)) || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1
      || region.x + region.width > current.width || region.y + region.height > current.height) throw new Error('请填写原图范围内的整数区域坐标。');
    return region;
  }
  async function applyRedaction() {
    await task.run(async () => {
      const region = selectedRegion();
      const redacted = await redactImage(await storage.assetUri(current.assetId), [region]);
      const asset = await normalizeImage(redacted);
      await update((previous) => commit(previous, (next) => {
        const item = next.captures.find((value) => value.id === id);
        if (!item || item.assetId !== current.assetId) throw new Error('画面已变化，请重新选择。');
        item.assetId = asset.id; item.width = asset.width; item.height = asset.height; item.redacted = true;
        // Drop all observations on redaction; re-OCR may only read the actual redacted pixels.
        item.observations = []; item.webNodes = [];
        item.warnings = ['已对实际画面遮挡，之前的文字与网页观察已清除；共享包只引用处理后的画面。'];
        if (!next.assets.some((value) => value.id === asset.id)) next.assets.push(asset);
      }));
      setTextDrafts([]); setNotice('遮挡已写入画面，旧的文字观察已清除。');
    });
  }
  return <Screen title={current.title} subtitle="画面预览" back footer={<Button icon="send" label="发送到电脑转换" disabled={task.busy}
    onPress={() => router.push({ pathname: '/connect', params: { projectId: current.projectId, captureIds: id, selectionKey: String(Date.now()) } })} />}>
    <Notice error message={task.error} /><Notice message={notice} />
    <AssetImage id={current.assetId} ratio={current.width / current.height} contain />
    <Label size={13} muted>{current.width} × {current.height} px · {current.sourceKind === 'web' ? '网页采集' : '导入画面'} · 手机已保存</Label>
    {current.sourceKind !== 'web' ? <Label size={13} muted>{current.observations.length ? `已有 ${current.observations.length} 行识别文字，发送前可校对。` : '电脑转换时会尝试离线识别文字；可靠区域可编辑，其余保留图片。'}</Label> : null}
    <View style={ui.row}>
      <Button label={renameOpen ? '收起' : '名称'} icon="edit" secondary small onPress={() => setRenameOpen((value) => !value)} />
      <Button label={toolsOpen ? '收起' : '裁切 / 旋转'} icon="crop" secondary small onPress={() => setToolsOpen((value) => !value)} />
      {visionAvailable || current.observations.length ? <Button label={textOpen ? '收起' : '文字'} icon="text" secondary small onPress={() => setTextOpen((value) => !value)} /> : null}
    </View>
    {renameOpen ? <Section title="画面名称"><Field label="名称" value={title} maxLength={80} onChangeText={setTitle} />
      <Button label="保存名称" quiet busy={task.busy} disabled={!title.trim() || title === current.title}
        onPress={() => void task.run(async () => { await update((previous) => commit(previous, (next) => {
          const item = next.captures.find((value) => value.id === id)!; item.title = title.trim();
        })); setNotice('画面名称已保存。'); })} />
    </Section> : null}
    {toolsOpen ? <Section title="裁切与旋转"><Label size={14} muted>裁切和旋转会保存为新画面。裁切范围使用图片像素，从左上角开始。</Label>
      <View style={ui.row}>{(['x', 'y', 'width', 'height'] as const).map((key) => <View key={key} style={{ flex: 1, minWidth: 100 }}>
        <Field label={{ x: '左侧 X', y: '顶部 Y', width: '宽度', height: '高度' }[key]} value={crop[key]} keyboardType="number-pad"
          onChangeText={(value) => setCrop((previous) => ({ ...previous, [key]: value }))} />
      </View>)}</View>
      <View style={ui.row}><Button label="裁切并另存" busy={task.busy} onPress={() => void transform()} />
        <Button label="顺时针旋转 90°" quiet disabled={task.busy} onPress={() => void transform(90)} /></View>
      {visionAvailable ? <><Button label="遮挡这个区域" quiet disabled={task.busy} onPress={() => void applyRedaction()} />
      <Label size={13} muted>遮挡将直接修改当前画面，清除已有文字识别结果。之前发送的版本不会改变。</Label></> : null}
    </Section> : null}
    {textOpen ? <Section title="文字识别"><Label size={15} muted>识别后可修改文字，再发送到电脑处理。</Label>
      <Button label="在本机识别文字" quiet busy={task.busy} disabled={!visionAvailable}
        onPress={() => void task.run(async () => {
          const observations = await recognizeText(await storage.assetUri(current.assetId), current.width, current.height);
          await update((previous) => commit(previous, (next) => {
            const item = next.captures.find((value) => value.id === id);
            if (!item || item.assetId !== current.assetId) throw new Error('画面已变化，请重新识别。');
            item.observations = observations;
          }));
          setTextDrafts(observations.slice(0, 100).map((item) => item.text));
          setNotice(`已识别 ${observations.length} 条文字，请校对结果。识别本身不代表背景已重建。`);
        })} />
      {!visionAvailable ? <Label size={13} muted>此版本可以查看和校对已有文字，重新识别需要独立安装包。</Label> : null}
      {current.observations.slice(0, 100).map((item, index) => <Field key={`${id}-${index}-${item.bounds.x}-${item.bounds.y}`} label={`文字 ${index + 1}${item.confidence === null ? ' · 置信度未知' : ` · ${Math.round(item.confidence * 100)}%`}`}
        value={textDrafts[index] ?? item.text} maxLength={10000} multiline editable={!task.busy}
        onChangeText={(value) => setTextDrafts((previous) => { const next = [...previous]; next[index] = value; return next; })} />)}
      {current.observations.length ? <Button label="保存文字校对" busy={task.busy}
        disabled={!textDrafts.some((text, index) => text !== current.observations[index]?.text)}
        onPress={() => void task.run(async () => {
          await update((previous) => commit(previous, (next) => {
            const target = next.captures.find((value) => value.id === id);
            if (!target || target.assetId !== current.assetId || target.observations.length !== current.observations.length) throw new Error('画面已变化，请重新校对。');
            target.observations = target.observations.map((item, index) => textDrafts[index] === undefined || textDrafts[index] === item.text ? item
              : { ...item, text: textDrafts[index], provenance: 'user', confidence: null });
          }));
          setNotice('文字校对已保存，导出时会包含这些修改。');
        })} /> : null}
    </Section> : null}
    <Button label={detailsOpen ? '收起更多操作' : '更多操作与画面说明'} quiet onPress={() => setDetailsOpen((value) => !value)} />
    {detailsOpen ? <View style={ui.stack}>
    {current.warnings.map((warning, index) => <Notice key={index} message={warning} />)}
    {deleting ? <View style={ui.row}><Button label="确认删除画面" danger busy={task.busy}
      onPress={() => void task.run(async () => { await update((previous) => removeCapture(previous, id)); router.back(); })} />
      <Button label="保留画面" quiet onPress={() => setDeleting(false)} /></View>
      : <Button label="删除画面" danger onPress={() => setDeleting(true)} />}
    </View> : null}
  </Screen>;
}
