import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const reportDir = resolve(`evidence/${localDate}/M0-01/${new Date().toISOString().replace(/[.:]/g, '-')}`);
mkdirSync(reportDir, { recursive: true });
function command(executable, args) { try { return { ok: true, value: execFileSync(executable, args, { encoding: 'utf8', windowsHide: true }).trim() }; } catch (error) { return { ok: false, error: String(error.message).slice(0, 1000) }; } }
const figmaPaths = process.platform==='darwin'?['/Applications/Figma.app',join(os.homedir(),'Applications/Figma.app')]:[join(os.homedir(),'AppData/Local/Figma/Figma.exe')];
const figmaPath=figmaPaths.find(path=>existsSync(path))??figmaPaths[0];
const liveReportPath = resolve('evidence/2026-10-18/M0-03/import-report.json');
const liveReport = existsSync(liveReportPath) ? JSON.parse(readFileSync(liveReportPath, 'utf8')) : null;
const ps = process.platform === 'win32' ? command('powershell.exe', ['-NoProfile', '-Command', "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); [pscustomobject]@{os=Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture;figmaProcesses=@(Get-Process -Name 'Figma*' -ErrorAction SilentlyContinue | Select-Object ProcessName,Id)} | ConvertTo-Json -Depth 5"]) : null;
const dependencies = Object.fromEntries(['electron','typescript','@figma/plugin-typings','esbuild','playwright','ajv'].map(name => { try { return [name, JSON.parse(readFileSync(resolve(`node_modules/${name}/package.json`), 'utf8')).version]; } catch { return [name, null]; } }));
const report = {
  evidenceKind: 'actual_environment_inventory', checkedAt: new Date().toISOString(),
  machine: { platform: process.platform, release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: Number((os.totalmem()/2**30).toFixed(1)) },
  tools: { node: process.version, npm: process.platform==='win32'?command(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'npm.cmd --version']):command('npm',['--version']), git: command('git', ['--version']) },
  windowsInventory: process.platform==='win32'?(ps?.ok ? JSON.parse(ps.value) : { unavailable: ps?.error }):null,
  macInventory:process.platform==='darwin'?{version:command('/usr/bin/sw_vers',['-productVersion']),appleSilicon:command('/usr/sbin/sysctl',['-n','hw.optional.arm64'])}:null,
  figma: { installedAtKnownPath: existsSync(figmaPath), path: figmaPath, checkedPaths:figmaPaths, editableFileVerified:process.platform==='win32'&&liveReport?.reportKind === 'actual_import', customPluginExecuted:process.platform==='win32'&&liveReport?.reportKind === 'actual_import', priorVerificationPlatform:'win32', priorVerificationReport: liveReport ? liveReportPath : null, priorVerificationAt: liveReport?.finishedAt ?? null },
  fonts: (process.platform==='darwin'?['/System/Library/Fonts/SFNS.ttf','/System/Library/Fonts/Helvetica.ttc','/System/Library/Fonts/PingFang.ttc']:['msyh.ttc','arial.ttf','segoeui.ttf'].map(name=>join(process.env.SystemRoot??'C:/Windows','Fonts',name))).map(path=>({path,foundAtKnownPath:existsSync(path)})),
  dependencies, repository: command('git', ['rev-parse', '--show-toplevel'])
};
writeFileSync(resolve(reportDir, 'environment.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
