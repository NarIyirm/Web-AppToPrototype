import { useState } from 'react';
import { View } from 'react-native';

import { SystemBroadcastPicker } from '@/data/system-capture';
import { Button, Label, usePalette } from '@/ui/kit';

export function SystemBroadcastControl({ running = false, disabled = false }: { running?: boolean; disabled?: boolean }) {
  const [help, setHelp] = useState(false);
  const palette = usePalette();
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View pointerEvents={disabled ? 'none' : 'auto'} accessibilityElementsHidden={disabled}
        style={{ width: 66, height: 66, flexShrink: 0, borderRadius: 12, borderWidth: 1,
          borderColor: palette.accent, backgroundColor: palette.accentSurface, opacity: disabled ? 0.5 : 1 }}>
        <SystemBroadcastPicker />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Label weight="600">{running ? '停止系统采集' : '开始系统采集'}</Label>
        <Label size={14} muted>{running ? '点左侧录屏按钮，在系统面板停止广播。' : '点左侧录屏按钮，选择“界面采集”，再点“开始广播”。'}</Label>
      </View>
    </View>
    <Button label={help ? '收起控制中心启动方法' : '看不到录屏图标？使用控制中心'} quiet onPress={() => setHelp(value => !value)} />
    {help ? <Label size={14}>从屏幕右上角下滑打开控制中心，长按“屏幕录制”按钮，选择“界面采集”，再点“开始广播”。如没有“屏幕录制”，先在控制中心添加这个控制。停止时点顶部录屏状态或控制中心的录屏按钮。</Label> : null}
  </View>;
}
