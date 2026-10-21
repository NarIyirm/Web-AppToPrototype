import * as Device from 'expo-device';
import { useEffect, useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { isProbeNavigationAllowed, parseWebProbe, type WebProbe } from '@/core/web-probe';

import { createWebFixture } from './web-fixture';

function ProbeAttempt({ epoch }: { epoch: string }) {
  const source = useMemo(() => ({ html: createWebFixture(epoch) }), [epoch]);
  const [observation, setObservation] = useState<WebProbe | null>(null);
  const [rejected, setRejected] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (observation) return;
    const timer = setTimeout(() => setError('10 秒内未收到结果，请重试并记录构建与系统版本。'), 10_000);
    return () => clearTimeout(timer);
  }, [observation]);

  return (
    <View style={styles.panel}>
      <WebView
        style={styles.webview}
        source={source}
        // Required for inline HTML. The navigation callback below denies external URLs.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => {
          const allowed = isProbeNavigationAllowed(url);
          if (!allowed) setBlocked((count) => count + 1);
          return allowed;
        }}
        onMessage={({ nativeEvent }) => {
          const result = parseWebProbe(nativeEvent.data, epoch);
          if (result) { setObservation(result); setError(null); }
          else setRejected((count) => count + 1);
        }}
        onError={() => setError('网页加载失败，请记录系统版本并重试。')}
        onContentProcessDidTerminate={() => setError('网页进程已停止，请重新运行。')}
        onRenderProcessGone={() => setError('网页进程已停止，请重新运行。')}
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        geolocationEnabled={false}
        incognito
      />
      <ThemedText type="small" accessibilityLiveRegion="polite">
        {error ?? (observation ? '已收到网页观察，请核对图片和坐标。' : '正在等待网页观察…')}
      </ThemedText>
      <ThemedText type="small">已拒绝消息：{rejected}；已拦截跳转：{blocked}</ThemedText>
      <ThemedText type="small" selectable>
        {JSON.stringify({ task: 'MOB-00a', platform: Platform.OS, os: Device.osVersion,
          model: Device.modelName, physicalDevice: Device.isDevice, epoch, observation }, null, 2)}
      </ThemedText>
    </View>
  );
}

export function WebProbePanel() {
  const id = useId().replace(/[^a-zA-Z0-9:_-]/g, '_');
  const [attempt, setAttempt] = useState(0);
  const epoch = `probe-${id}-${attempt}`;
  return (
    <View style={styles.panel}>
      <ThemedText type="small">
        读取本地测试页的坐标和图片，再点击页内两个测试入口，核对拒绝与拦截计数。
        此结果只验证网页能力，系统采集、OCR 和传输需单独测试。
      </ThemedText>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt((value) => value + 1)}>
        <ThemedText type="link">{attempt ? '重新运行网页测试' : '运行网页测试'}</ThemedText>
      </Pressable>
      {attempt > 0 ? <ProbeAttempt key={epoch} epoch={epoch} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12, width: '100%' },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  webview: { height: 320, flex: 0 },
});
