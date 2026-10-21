import { ThemedText } from '@/components/themed-text';

export function WebProbePanel() {
  return (
    <ThemedText type="small">
      MOB-00a 测试入口已建立。请在 Android 安装包或 iOS TestFlight 构建的 Explore 页运行，
      验证网页消息、坐标、内嵌图片和跳转拦截。浏览器预览不能验证手机 WebView。
    </ThemedText>
  );
}
