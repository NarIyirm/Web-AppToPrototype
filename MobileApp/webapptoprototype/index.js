// Keep Router (and its eager native/animation imports) behind the client check.
// A static import of expo-router/entry here would run before this check.
const { isRunningInExpoGo, registerRootComponent } = require('expo');
const Constants = require('expo-constants').default;
const { Platform } = require('react-native');
const { expoGoUpdateRequired } = require('./src/core/expo-go-compatibility');

const minimum = expoGoUpdateRequired(isRunningInExpoGo(), Platform.OS, Constants.expoVersion);
if (minimum) {
  const React = require('react');
  const { ExpoGoUpdateRequired } = require('./src/features/startup/expo-go-update-required');
  registerRootComponent(() => React.createElement(ExpoGoUpdateRequired, { version: Constants.expoVersion, minimum }));
} else {
  require('expo-router/entry');
}
