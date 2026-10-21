import {cp,mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join,sep,relative} from 'node:path';
await import('./build.mjs');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Windows x64打包需对应平台运行时');
const {version}=JSON.parse(await readFile('package.json','utf8'));if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),root=resolve('release'),folder=join(root,`WebToPrototype-${version}-win-x64-${stamp}`);if(!folder.startsWith(root+sep))throw Error('release path');await mkdir(root,{recursive:true});
await cp(resolve('node_modules/electron/dist'),folder,{recursive:true,errorOnExist:true,force:false});await rename(join(folder,'electron.exe'),join(folder,'WebToPrototype.exe'));
const app=join(folder,'resources/app');await mkdir(app,{recursive:true});await writeFile(join(app,'package.json'),JSON.stringify({name:'web-to-prototype',productName:'WebToPrototype',version,main:'apps/desktop/dist/main.cjs',private:true},null,2));
await cp(resolve('apps/desktop/dist'),join(app,'apps/desktop/dist'),{recursive:true});await cp(resolve('apps/desktop/fixtures'),join(app,'apps/desktop/fixtures'),{recursive:true});await cp(resolve('apps/figma-plugin/dist'),join(app,'apps/figma-plugin/dist'),{recursive:true});await cp(resolve('apps/figma-plugin/dist'),join(folder,'FigmaPlugin'),{recursive:true});await cp(resolve('docs/20-desktop-release-guide.md'),join(folder,'使用说明.md'));
await cp(resolve('node_modules/ajv/LICENSE'),join(folder,'AJV-LICENSE.txt'));
await cp(resolve('docs'),join(folder,'docs'),{recursive:true});for(const file of ['DESIGN.md','PRODUCT.md','README.md'])await cp(resolve(file),join(folder,file));await cp(resolve('examples'),join(folder,'examples'),{recursive:true});
await writeFile(join(folder,'Install.cmd'),'@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"\r\npause\r\n');
const installer=String.raw`param([string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'WebToPrototype'), [switch]$NoShortcut)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath($PSScriptRoot)
$base = [IO.Path]::GetFullPath($InstallRoot)
$destination = [IO.Path]::GetFullPath((Join-Path $base '@@RELEASE_VERSION@@'))
if (!$destination.StartsWith($base + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $destination -eq $source -or $destination.StartsWith($source + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid installation directory' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Get-ChildItem -LiteralPath $source | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force }
if (!$NoShortcut) { $programs = [Environment]::GetFolderPath('Programs'); $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut((Join-Path $programs 'WebToPrototype.lnk')); $shortcut.TargetPath = Join-Path $destination 'WebToPrototype.exe'; $shortcut.WorkingDirectory = $destination; $shortcut.Save() }
Write-Output ('Installed: ' + $destination)
`;
await writeFile(join(folder,'Install.ps1'),'\ufeff'+installer.replaceAll('@@RELEASE_VERSION@@',version));
const paths=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else paths.push(path);}}await walk(folder);const lines=[];let total=0;for(const path of paths.sort()){const hash=createHash('sha256');for await(const chunk of createReadStream(path)){hash.update(chunk);total+=chunk.length;}lines.push(`${hash.digest('hex')}  ${relative(folder,path).replaceAll('\\','/')}`);}await writeFile(join(folder,'SHA256SUMS.txt'),lines.join('\n')+'\n');
const zip=folder+'.zip';await promisify(execFile)('powershell.exe',['-NoProfile','-File',resolve('scripts/archive-windows.ps1'),'-Source',folder,'-Destination',zip],{windowsHide:true,timeout:300000});const zipHash=createHash('sha256');let zipBytes=0;for await(const chunk of createReadStream(zip)){zipHash.update(chunk);zipBytes+=chunk.length;}const sha256=zipHash.digest('hex');await writeFile(zip+'.sha256',sha256+'  '+relative(root,zip)+'\n');
await writeFile(join(root,'latest-windows.json'),JSON.stringify({folder,zip,sha256,zipBytes,executable:join(folder,'WebToPrototype.exe'),plugin:join(folder,'FigmaPlugin/manifest.json'),createdAt:new Date().toISOString(),files:paths.length,bytes:total,version,userAcceptance:'pending'},null,2));console.log(JSON.stringify({folder,zip,sha256,files:paths.length,bytes:total,zipBytes},null,2));

