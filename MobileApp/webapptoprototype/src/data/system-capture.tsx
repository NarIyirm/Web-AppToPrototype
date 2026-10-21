import { Label } from '@/ui/kit';
import type { SystemFrame, SystemCaptureStatus } from '@/core/app-capture';

export type { SystemFrame, SystemCaptureStatus } from '@/core/app-capture';
export const systemCaptureAvailable = false;
export const getSystemStatus = async (): Promise<SystemCaptureStatus> => ({ configured: false, running: false, message: '请在手机安装包中使用系统采集。' });
export const listSystemFrames = async (): Promise<SystemFrame[]> => [];
export const startSystemCapture = async () => false;
export const stopSystemCapture = async () => {};
export const removeSystemFrame = async (_id: string) => {};
export const requestCaptureOverlay = async () => {};
export function SystemBroadcastPicker() { return <Label muted>系统采集入口只在手机上显示。</Label>; }
