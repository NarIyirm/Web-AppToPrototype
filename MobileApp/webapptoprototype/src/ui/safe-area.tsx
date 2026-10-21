import type { ReactNode } from 'react';
import { Modal, StyleSheet, type ViewProps } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

/** One boundary per screen/window. Measure here, not in the route underneath a Modal.
 * A tab scene already ends above its tab bar, so its measured bottom inset is zero.
 * Do not seed remounting providers with initialWindowMetrics (rotation can change them).
 */
export function SafeAreaSurface({ children, style, ...props }: ViewProps) {
  return <SafeAreaProvider>
    <SafeAreaView {...props} edges={['top', 'right', 'bottom', 'left']} style={[styles.fill, style]}>
      {children}
    </SafeAreaView>
  </SafeAreaProvider>;
}

/** Keep the provider INSIDE the native Modal's separate view hierarchy. */
export function SafeAreaModal({ visible, onClose, children, style }: {
  visible: boolean; onClose(): void; children: ReactNode; style?: ViewProps['style'];
}) {
  return <Modal visible={visible} presentationStyle="fullScreen" animationType="none" onRequestClose={onClose}>
    <SafeAreaSurface style={style}>{children}</SafeAreaSurface>
  </Modal>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
