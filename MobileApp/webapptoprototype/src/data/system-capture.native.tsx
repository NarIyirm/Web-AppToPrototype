import { isRunningInExpoGo, requireNativeView, requireOptionalNativeModule } from 'expo';
import { createURL } from 'expo-linking';
import { Platform, type ViewProps } from 'react-native';

import type { SystemFrame, SystemCaptureStatus } from './system-capture';
export type { SystemFrame, SystemCaptureStatus } from './system-capture';

type ScreenModule = { start(returnUrl: string): Promise<boolean>; stop(): Promise<void>;
  status(): Promise<SystemCaptureStatus>; requestOverlay(): Promise<void>;
  frames(): Promise<SystemFrame[]>; removeFrame(id: string): Promise<void> };
const native = isRunningInExpoGo() ? null : requireOptionalNativeModule<ScreenModule>('MobileScreen');
const Picker = native && Platform.OS === 'ios' ? requireNativeView<ViewProps>('MobileScreen') : null;
export const systemCaptureAvailable = native !== null;
export async function getSystemStatus() {
  if (!native) return { configured: false, running: false, message: '当前安装包未包含系统采集模块。' };
  return native.status();
}
export async function listSystemFrames(): Promise<SystemFrame[]> {
  if (!native) return [];
  const frames = await native.frames();
  if (!Array.isArray(frames) || frames.length > 20 || frames.some((frame) => !/^frame-[a-f0-9-]+\.png$/.test(frame.id) || typeof frame.uri !== 'string' || !frame.uri.startsWith('file://') || !Number.isFinite(frame.createdAt))) throw new Error('系统采集帧格式无效。');
  return frames.sort((a, b) => a.createdAt - b.createdAt);
}
export async function startSystemCapture() { if (!native || Platform.OS !== 'android') return false; return native.start(createURL('/capture/native')); }
export async function stopSystemCapture() { if (native && Platform.OS === 'android') await native.stop(); }
export async function removeSystemFrame(id: string) { if (native) await native.removeFrame(id); }
export async function requestCaptureOverlay() { if (native && Platform.OS === 'android') await native.requestOverlay(); }
export function SystemBroadcastPicker() { return Picker ? <Picker style={{ width: 64, height: 64 }} accessibilityLabel="开始或停止系统界面采集" /> : null; }
