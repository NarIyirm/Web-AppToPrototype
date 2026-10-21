import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

import { expoGoUpdateRequired } from '../src/core/expo-go-compatibility.ts';

const entry = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
function launch(isExpoGo: boolean, platform: string, version: string | null) {
  const loaded: string[] = [];
  let registered: (() => unknown) | undefined;
  const UpdateScreen = () => undefined;
  runInNewContext(entry, { require(name: string) {
    loaded.push(name);
    if (name === 'expo') return { isRunningInExpoGo: () => isExpoGo,
      registerRootComponent(component: () => unknown) { registered = component; } };
    if (name === 'expo-constants') return { default: { expoVersion: version } };
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === './src/core/expo-go-compatibility') return { expoGoUpdateRequired };
    if (name === 'react') return { createElement: (component: unknown, props: unknown) => ({ component, props }) };
    if (name === './src/features/startup/expo-go-update-required') return { ExpoGoUpdateRequired: UpdateScreen };
    if (name === 'expo-router/entry') return {};
    throw Error(`Unexpected startup import: ${name}`);
  } });
  return { loaded, registered, UpdateScreen };
}

test('old Expo Go is stopped before Router, storage or animation initialization on both platforms', () => {
  for (const [platform, version, minimum] of [['ios', '57.0.0', '57.0.6'], ['ios', '57.0.5', '57.0.6'],
    ['android', '57.0.0', '57.0.3'], ['android', '57.0.2', '57.0.3']]) {
    const result = launch(true, platform, version);
    assert.ok(!result.loaded.includes('expo-router/entry'));
    assert.ok(result.registered);
    const rendered = result.registered() as { component: unknown; props: { version: string; minimum: string } };
    assert.equal(rendered.component, result.UpdateScreen);
    assert.equal(rendered.props.version, version);
    assert.equal(rendered.props.minimum, minimum);
  }
});

test('fixed Expo Go and standalone builds register Router once and do not load the update screen', () => {
  for (const [go, platform, version] of [[true, 'ios', '57.0.6'], [true, 'ios', '57.0.30'],
    [true, 'android', '57.0.3'], [false, 'ios', '57.0.0'], [false, 'android', null],
    [false, 'web', null]] as const) {
    const result = launch(go, platform, version);
    assert.equal(result.loaded.filter((name) => name === 'expo-router/entry').length, 1);
    assert.equal(result.registered, undefined);
    assert.ok(!result.loaded.includes('./src/features/startup/expo-go-update-required'));
  }
});

test('compatibility policy only restricts the documented SDK 57 Expo Go releases', () => {
  for (const version of [null, '', 'unknown', '57', '57.0', '56.0.0', '58.0.0', '57.1.0']) {
    assert.equal(expoGoUpdateRequired(true, 'ios', version), null);
  }
});
