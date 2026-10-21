import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ExampleAppKind = 'shop' | 'tasks';
export type ExamplePage = 'home' | 'detail';
export const exampleAppNames = { shop: '示例商店', tasks: '示例待办' };
export function examplePageName(kind: ExampleAppKind, page: ExamplePage) {
  return kind === 'shop' ? page === 'home' ? '商店首页' : '商品详情' : page === 'home' ? '待办列表' : '任务详情';
}

/** Rendered sample content, never an installed-app selector or a native permission mock. */
export function ExampleApp({ kind, page, onPageChange, checked, onToggle }: {
  kind: ExampleAppKind; page: ExamplePage; onPageChange(page: ExamplePage): void; checked: boolean; onToggle(): void;
}) {
  return <View style={s.app}>
    <View style={s.top}><Text style={s.brand}>{exampleAppNames[kind]}</Text><Text style={s.demo}>内置示例</Text></View>
    {page === 'detail' ? <Pressable accessibilityRole="button" onPress={() => onPageChange('home')} style={s.back}><Text style={s.link}>‹ 返回列表</Text></Pressable> : null}
    {kind === 'shop' ? page === 'home' ? <>
      <Text style={s.heading}>为日常，留一点好物。</Text><Text style={s.muted}>简单、实用的生活小物</Text>
      <View style={s.hero}><Text style={s.kicker}>本周精选</Text><Text style={s.product}>便携台灯</Text><Text style={s.muted}>一盏柔和的光，陪你专注。</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="查看便携台灯详情" onPress={() => onPageChange('detail')} style={s.item}>
        <View style={s.grow}><Text style={s.itemTitle}>便携台灯</Text><Text style={s.muted}>暖光 · 可调亮度</Text></View><Text style={s.price}>¥128 ›</Text>
      </Pressable>
      <View style={s.item}><View style={s.grow}><Text style={s.itemTitle}>折叠托盘</Text><Text style={s.muted}>轻巧 · 易收纳</Text></View><Text style={s.price}>¥68</Text></View>
    </> : page === 'detail' ? <>
      <View style={s.hero}><Text style={s.kicker}>日常照明</Text><Text style={s.product}>便携台灯</Text><Text style={s.muted}>把喜欢的角落，照得刚刚好。</Text></View>
      <Text style={s.heading}>便携台灯</Text><Text style={s.price}>¥128</Text>
      <Text style={s.body}>柔和暖光，三档亮度。适合床头阅读，也适合下班后的片刻休息。</Text>
      <View style={s.item}><Text style={s.itemTitle}>颜色</Text><Text style={s.body}>雾白</Text></View>
      <View style={s.item}><Text style={s.itemTitle}>配送</Text><Text style={s.body}>两日内发货</Text></View>
    </> : null : page === 'home' ? <>
      <Text style={s.heading}>今天，慢慢做好。</Text><Text style={s.muted}>周三 · 我的待办</Text>
      <View style={s.summary}><Text style={s.itemTitle}>今天的重点</Text><Text style={s.body}>整理灵感，留出专注的时间。</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="查看整理设计灵感的任务详情" style={s.item} onPress={() => onPageChange('detail')}>
        <View style={s.grow}><Text style={s.itemTitle}>整理设计灵感</Text><Text style={s.muted}>收集 · 今天 16:00</Text></View><Text style={s.link}>查看 ›</Text>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="散步二十分钟" accessibilityState={{ checked }} style={s.item} onPress={onToggle}>
        <Text style={s.check}>{checked ? '☑' : '☐'}</Text><View style={s.grow}><Text style={s.itemTitle}>散步二十分钟</Text><Text style={s.muted}>{checked ? '已经完成' : '生活 · 今天'}</Text></View>
      </Pressable>
    </> : <>
      <Text style={s.heading}>整理设计灵感</Text><Text style={s.muted}>今天 16:00 · 收集</Text>
      <View style={s.summary}><Text style={s.body}>挑选喜欢的页面，记录值得保留的布局和交互，让下次设计有据可循。</Text></View>
      <View style={s.item}><Text style={s.itemTitle}>完成时间</Text><Text style={s.body}>今天</Text></View>
      <View style={s.item}><Text style={s.itemTitle}>优先级</Text><Text style={s.body}>普通</Text></View>
      <Text style={s.muted}>备注：收集三张页面，再整理成可点击原型。</Text>
    </>}
    <View style={s.footer}><Text style={s.footerText}>WebToPrototype 流程演示 · 示例画面</Text></View>
  </View>;
}
const s = StyleSheet.create({
  app: { backgroundColor: '#FFFFFF', padding: 20, gap: 16, minHeight: 470 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: '#E1E7EE', paddingBottom: 16 },
  brand: { color: '#152132', fontSize: 18, lineHeight: 26, fontWeight: '700', flexShrink: 1 },
  demo: { color: '#0965CB', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  heading: { color: '#152132', fontSize: 24, lineHeight: 34, fontWeight: '700' },
  muted: { color: '#566579', fontSize: 14, lineHeight: 22 },
  hero: { backgroundColor: '#EDF3F8', padding: 22, gap: 14, minHeight: 158, justifyContent: 'center' },
  kicker: { color: '#566579', fontSize: 13, lineHeight: 20 },
  product: { color: '#152132', fontSize: 28, lineHeight: 38, fontWeight: '600' },
  item: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#E1E7EE', minHeight: 64 },
  itemTitle: { color: '#152132', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  price: { color: '#152132', fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { color: '#152132', fontSize: 16, lineHeight: 26 },
  summary: { paddingVertical: 20, gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E1E7EE' },
  grow: { flex: 1, gap: 6, minWidth: 100 },
  link: { color: '#0965CB', fontSize: 15, lineHeight: 22 },
  back: { minHeight: 48, justifyContent: 'center' },
  check: { color: '#0965CB', fontSize: 24 },
  footer: { borderTopWidth: 1, borderColor: '#E1E7EE', paddingTop: 16, marginTop: 12 },
  footerText: { color: '#566579', fontSize: 12, lineHeight: 18 },
});
