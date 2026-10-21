import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const plugin=require('../plugins/with-system-capture.cjs');
test('CNG adds exactly one broadcast target with independent entitlements and source membership',()=>{
 const project=require('xcode').project('node_modules/react-native-safe-area-context/ios/RNSafeAreaContext.xcodeproj/project.pbxproj');project.parseSync();
 const config={ios:{bundleIdentifier:'dev.example.capture',buildNumber:'7'},version:'1.2.3'};
 plugin.addTarget(project,config);plugin.addTarget(project,config);
 const targets=Object.values(project.pbxNativeTargetSection()) as {name?:string;buildConfigurationList?:string}[];
 const found=targets.filter(target=>target.name?.replaceAll('"','')==='CaptureBroadcast');assert.equal(found.length,1);
 const list=project.pbxXCConfigurationList()[found[0].buildConfigurationList!];
 for(const entry of list.buildConfigurations){const settings=project.pbxXCBuildConfigurationSection()[entry.value].buildSettings;assert.equal(settings.CURRENT_PROJECT_VERSION,'7');assert.match(settings.CODE_SIGN_ENTITLEMENTS,/CaptureBroadcast/);assert.equal(settings.APPLICATION_EXTENSION_API_ONLY,'YES');assert.equal(settings.SWIFT_VERSION,'5.0');}
 assert.match(project.writeSync(),/BroadcastSampleHandler\.swift/);
 assert.deepEqual(plugin.identity(config),{extension:'dev.example.capture.capture-broadcast',group:'group.dev.example.capture.capture'});
 assert.equal(plugin.identity({ios:{}}),null);
});
