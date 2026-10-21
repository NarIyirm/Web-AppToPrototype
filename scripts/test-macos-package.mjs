import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
const python=process.env.W2P_PYTHON??(process.platform==='win32'?'python':'python3');
const result=await promisify(execFile)(python,[resolve('scripts/test-macos-package.py'),'-v'],{windowsHide:true,timeout:120000});process.stdout.write(result.stdout);process.stderr.write(result.stderr);
const bash=process.platform==='win32'?resolve(process.env.ProgramFiles??'C:/Program Files','Git/bin/bash.exe'):'/bin/bash';
for(const script of ['scripts/Prepare Mac.command','scripts/mac-tools/prepare-app.sh','scripts/mac-tools/resolve-app.sh','scripts/mac-tools/make-dmg.sh','scripts/test-mac-prepare.sh'])await promisify(execFile)(bash,['-n',script],{windowsHide:true,timeout:30000});
const shell=await promisify(execFile)(bash,['scripts/test-mac-prepare.sh'],{windowsHide:true,timeout:30000});process.stdout.write(shell.stdout);process.stderr.write(shell.stderr);
