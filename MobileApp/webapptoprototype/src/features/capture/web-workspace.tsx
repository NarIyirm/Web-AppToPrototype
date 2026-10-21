import { Button, Label, Screen } from '@/ui/kit';
import { router } from 'expo-router';

export function WebWorkspace({ url }: { url: string; projectId: string }) {
  return <Screen title="网页采集" back><Label muted>网页结构采集使用手机内置 WebView。请在 Android 或 iOS 应用中打开此入口。</Label>
    <Label selectable>{url}</Label><Button label="返回采集页" onPress={() => router.replace('/capture')} /></Screen>;
}
