# Screen chrome and safe areas

- Every new route must render `Screen` from `@/ui/kit`, delegate to a component using it, or use `SafeAreaSurface` from `@/ui/safe-area` for a custom workspace. Layout and redirect routes are exceptions.
- Full-screen dialogs must use `SafeAreaModal`. Its provider must stay **inside** the native Modal, which has a separate native view hierarchy. Do not import raw Modal or safe-area APIs outside `ui/safe-area.tsx`; lint enforces this.
- Keep one surface boundary at the screen/window root, outside ScrollView, FlatList, image capture targets and animated content. Nested content must not add its own surface or system insets.
- The shared surface owns all four edges. Do not hardcode status-bar/notch/home-indicator sizes, hide the status bar to avoid overlap, reuse `initialWindowMetrics` on remounting providers, or apply automatic scroll/WebView content insets on top of the shared padding.
- A tab scene measures its own frame above the tab bar; pushed screens and Modals measure their own bottom inset. Preserve this distinction instead of adding fixed bottom spacers.
- For layout changes, check portrait top/bottom, landscape side cutouts, tab-bar spacing and reopen/rotation. Final UIKit/Android measurement and touch behavior remain user verification; browser fixtures with controlled native inset events cannot prove those.
