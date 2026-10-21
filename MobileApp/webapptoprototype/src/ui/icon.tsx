import { SymbolView } from 'expo-symbols';

const names = {
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  photo: { ios: 'photo', android: 'image', web: 'image' },
  web: { ios: 'globe', android: 'language', web: 'language' },
  app: { ios: 'rectangle.on.rectangle', android: 'filter_none', web: 'filter_none' },
  folder: { ios: 'folder', android: 'folder', web: 'folder' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  send: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  computer: { ios: 'desktopcomputer', android: 'computer', web: 'computer' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  error: { ios: 'exclamationmark.circle', android: 'error', web: 'error' },
  qr: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  crop: { ios: 'crop', android: 'crop', web: 'crop' },
  text: { ios: 'text.alignleft', android: 'notes', web: 'notes' },
} as const;

export type IconName = keyof typeof names;
export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return <SymbolView name={names[name]} tintColor={color} size={size} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
