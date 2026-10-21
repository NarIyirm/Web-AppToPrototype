// SDK 57's initial Expo Go clients shipped older Worklets native code.
// https://github.com/expo/expo/issues/48390
export function expoGoUpdateRequired(isExpoGo: boolean, platform: string, version: string | null): string | null {
  if (!isExpoGo || (platform !== 'ios' && platform !== 'android') || !version) return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match || Number(match[1]) !== 57 || Number(match[2]) !== 0) return null;
  const minimumPatch = platform === 'ios' ? 6 : 3;
  return Number(match[3]) < minimumPatch ? `57.0.${minimumPatch}` : null;
}
