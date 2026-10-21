import type { ConfigContext } from 'expo/config';

// Native capabilities are additive; preserve the user's app.json/EAS identity.
export default ({ config }: ConfigContext) => ({
  ...config,
  name: 'WebAppToFigma',
  icon: './assets/webapptofigma-icon.png',
  ios: { ...config.ios,
    bundleIdentifier: 'com.nariyirm.webapptofigma',
    icon: './assets/webapptofigma-icon.png',
    infoPlist: { ...config.ios?.infoPlist,
    NSLocalNetworkUsageDescription: '连接你确认配对的电脑，传输本机采集的界面素材。',
  } },
  android: { ...config.android,
    package: 'com.nariyirm.webapptofigma',
    adaptiveIcon: {
      foregroundImage: './assets/webapptofigma-icon.png',
      backgroundColor: '#F4F7FC',
    },
  },
  plugins: [
    ...(config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
        ? [plugin[0], { ...plugin[1], image: './assets/webapptofigma-icon.png', backgroundColor: '#F4F7FC' }]
        : plugin),
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
