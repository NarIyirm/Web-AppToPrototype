import {_electron as electron} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {waitForShell} from './electron-shell.mjs';
const stamp=new Date().toISOString().replace(/[.:]/g,'-'),folder=resolve('evidence/2026-10-20/Mac-port',stamp);await mkdir(folder,{recursive:true});
const env={...process.env,W2P_SMOKE:'1',W2P_DATA_DIR:resolve('.runtime/platform-smoke',stamp)};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[resolve('apps/desktop')],env,timeout:30000}),checks=[];
const check=(name,ok)=>{checks.push({check:name,ok:!!ok});if(!ok)throw Error(name);};
try{const shell=await waitForShell(app),target=app.windows().find(p=>p.url().includes('/fixture'));await target.waitForSelector('#orders');
 await shell.locator('#demo').focus();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')).webContents.send('app-command','focus-address'));
 await shell.waitForFunction(()=>document.activeElement?.id==='url');check('trusted-menu-command-focuses-address-and-selects-entire-value',await shell.locator('#url').evaluate(e=>e.selectionStart===0&&e.selectionEnd===e.value.length));
 await shell.locator('#demo').focus();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')).webContents.send('app-command','unrecognized'));
 check('preload-drops-unrecognized-application-commands',await shell.evaluate(()=>document.activeElement?.id==='demo'));
 check('untrusted-webpage-has-no-platform-or-application-bridge',await target.evaluate(()=>typeof window.w2p==='undefined'&&typeof window.require==='undefined'));
 const result=await shell.evaluate(()=>window.w2p.capture('viewport'));check('platform-command-leaves-native-capture-functional',result.data.artifactKind==='capture'&&result.data.screens[0].nodes.some(n=>n.text));
 await writeFile(resolve(folder,'report.json'),JSON.stringify({platform:process.platform,kind:'actual-electron-platform-command-regression',nativeMacTested:process.platform==='darwin',figmaTested:false,checks},null,2));console.log(JSON.stringify({folder,passed:checks.length},null,2));
}catch(error){await writeFile(resolve(folder,'failure.json'),JSON.stringify({error:String(error),checks},null,2));throw error;}finally{await app.close();}
