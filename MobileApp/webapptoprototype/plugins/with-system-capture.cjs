const {withInfoPlist,withEntitlementsPlist,withDangerousMod,withXcodeProject}=require('expo/config-plugins');
const {mkdir,readFile,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
const plist=require('@expo/plist');
const TARGET='CaptureBroadcast';
const identity=config=>{
 const id=config.ios?.bundleIdentifier;
 if(!id)return null;
 if(!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(id))throw Error('Invalid iOS bundleIdentifier');
 return {extension:`${id}.capture-broadcast`,group:`group.${id}.capture`};
};
function addTarget(project,config){
 const ids=identity(config);if(!ids)throw Error('Configure ios.bundleIdentifier before generating the broadcast extension.');
 const existing=Object.entries(project.pbxNativeTargetSection()).find(([,value])=>value?.name?.replaceAll('"','')===TARGET);
 const target=existing?{uuid:existing[0],pbxNativeTarget:existing[1]}:project.addTarget(TARGET,'app_extension',TARGET,ids.extension);
 if(!existing){
  const group=project.addPbxGroup([],TARGET,TARGET);
  const root=project.getFirstProject().firstProject.mainGroup;
  project.addToPbxGroup({fileRef:group.uuid,basename:TARGET},root);
  project.addBuildPhase([],'PBXSourcesBuildPhase','Sources',target.uuid);
  project.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',target.uuid);
  project.addSourceFile('BroadcastSampleHandler.swift',{target:target.uuid},group.uuid);
 }
 const list=project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
 for(const ref of list.buildConfigurations){const settings=project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
  Object.assign(settings,{SWIFT_VERSION:'5.0',IPHONEOS_DEPLOYMENT_TARGET:'16.4',TARGETED_DEVICE_FAMILY:'"1,2"',
   APPLICATION_EXTENSION_API_ONLY:'YES',CODE_SIGN_ENTITLEMENTS:`"${TARGET}/${TARGET}.entitlements"`,
   CURRENT_PROJECT_VERSION:String(config.ios?.buildNumber??'1'),MARKETING_VERSION:`"${config.version??'1.0.0'}"`,PRODUCT_BUNDLE_IDENTIFIER:`"${ids.extension}"`,
   CODE_SIGN_STYLE:'Automatic',GENERATE_INFOPLIST_FILE:'NO',CLANG_ENABLE_MODULES:'YES'});
  if(config.ios?.appleTeamId)settings.DEVELOPMENT_TEAM=config.ios.appleTeamId;
 }
}
function withSystemCapture(config){
 const ids=identity(config);
 if(ids){
  const eas=config.extra?.eas??{},build=eas.build??{},experimental=build.experimental??{},ios=experimental.ios??{};
  const extensions=(ios.appExtensions??[]).filter(item=>item.targetName!==TARGET);
  config.extra={...config.extra,eas:{...eas,build:{...build,experimental:{...experimental,ios:{...ios,appExtensions:[...extensions,{targetName:TARGET,bundleIdentifier:ids.extension,entitlements:{'com.apple.security.application-groups':[ids.group]}}]}}}}};
 }
 config=withInfoPlist(config,c=>{const value=identity(c);if(value){c.modResults.MobileCaptureAppGroup=value.group;c.modResults.MobileBroadcastExtension=value.extension;}return c;});
 config=withEntitlementsPlist(config,c=>{const value=identity(c);if(value)c.modResults['com.apple.security.application-groups']=[...new Set([...(c.modResults['com.apple.security.application-groups']??[]),value.group])];return c;});
 config=withDangerousMod(config,['ios',async c=>{
  const value=identity(c);if(!value)throw Error('iOS system capture needs the Apple app bundle identifier at prebuild time.');
  const folder=join(c.modRequest.platformProjectRoot,TARGET);await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'BroadcastSampleHandler.swift'),await readFile(join(__dirname,'ios/BroadcastSampleHandler.swift')));
  await writeFile(join(folder,`${TARGET}-Info.plist`),plist.default.build({CFBundleDisplayName:'界面采集',CFBundleExecutable:'$(EXECUTABLE_NAME)',CFBundleIdentifier:'$(PRODUCT_BUNDLE_IDENTIFIER)',CFBundleName:'$(PRODUCT_NAME)',CFBundlePackageType:'XPC!',CFBundleShortVersionString:'$(MARKETING_VERSION)',CFBundleVersion:'$(CURRENT_PROJECT_VERSION)',MobileCaptureAppGroup:value.group,NSExtension:{NSExtensionPointIdentifier:'com.apple.broadcast-services-upload',NSExtensionPrincipalClass:'$(PRODUCT_MODULE_NAME).BroadcastSampleHandler',RPBroadcastProcessMode:'RPBroadcastProcessModeSampleBuffer'}}));
  await writeFile(join(folder,`${TARGET}.entitlements`),plist.default.build({'com.apple.security.application-groups':[value.group]}));
  return c;
 }]);
 return withXcodeProject(config,c=>{addTarget(c.modResults,c);return c;});
}
module.exports=withSystemCapture;
module.exports.identity=identity;
module.exports.addTarget=addTarget;
