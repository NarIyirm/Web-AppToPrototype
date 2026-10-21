import type { ConfigContext } from 'expo/config';

// Native capabilities are additive; preserve the user's app.json/EAS identity.
export default ({ config }: ConfigContext) => ({
  ...config,
  ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist,
    NSLocalNetworkUsageDescription: '连接你确认配对的电脑，传输本机采集的界面素材。',
  } },
  plugins: [
    ...(config.plugins ?? []),
    'expo-font',
    'expo-image',
    'expo-sharing',
    'expo-status-bar',
    'expo-web-browser',
    './plugins/with-system-capture.cjs',
    ['expo-camera', { cameraPermission: '扫描电脑上的配对二维码，连接你自己的电脑。', microphonePermission: false, recordAudioAndroid: false }],
    ['expo-image-picker', {
      photosPermission: '选择你希望整理和导出的界面截图。',
      cameraPermission: '扫描电脑上的配对二维码，连接你自己的电脑。',
      microphonePermission: false,
    }],
  ],
});
