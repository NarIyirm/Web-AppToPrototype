import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await import('./generate-validator.mjs');
await import('./create-probe-package.mjs');
await import('./create-acceptance-fixtures.mjs');
await import('./create-visual-fixtures.mjs');
await import('./create-text-example.mjs');
await import('./create-layers-example.mjs');
await import('./create-svg-example.mjs');
await import('./create-forms-example.mjs');
await import('./create-shadows-example.mjs');

const desktop = resolve('apps/desktop/dist');
const plugin = resolve('apps/figma-plugin/dist');
await Promise.all([mkdir(desktop, { recursive: true }), mkdir(plugin, { recursive: true })]);
const shared = { bundle: true, sourcemap: true, logLevel: 'info' };
await Promise.all([
  build({ ...shared, entryPoints: ['apps/desktop/src/main.ts'], outfile: `${desktop}/main.cjs`, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...shared, entryPoints: ['apps/desktop/src/preload.ts'], outfile: `${desktop}/preload.cjs`, platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...shared, entryPoints: ['apps/desktop/src/renderer.ts'], outfile: `${desktop}/renderer.js`, platform: 'browser', target: 'es2022' }),
  build({ ...shared, entryPoints: ['apps/desktop/src/capture.ts'], outfile: `${desktop}/capture.js`, platform: 'browser', format: 'iife', target: 'es2022' })
]);
const uiScript=await build({entryPoints:['apps/figma-plugin/ui/index.ts'],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020'});
const ui = (await readFile('apps/figma-plugin/src/ui.html', 'utf8')).replace('/*__W2P_UI__*/',uiScript.outputFiles[0].text);
await build({ ...shared, entryPoints: ['apps/figma-plugin/src/main.ts'], outfile: `${plugin}/code.js`, platform: 'browser', format: 'iife', target: 'es2020', define: { __html__: JSON.stringify(ui) } });
await mkdir(`${desktop}/ocr`,{recursive:true});
await Promise.all([
  copyFile('apps/desktop/src/ocr/windows.ps1', `${desktop}/ocr/windows.ps1`),
  copyFile('apps/desktop/src/ocr/macos.js', `${desktop}/ocr/macos.js`),
  copyFile('apps/desktop/src/index.html', `${desktop}/index.html`),
  copyFile('apps/desktop/src/style.css', `${desktop}/style.css`),
  writeFile(`${plugin}/ui.html`, ui),
  writeFile(`${plugin}/manifest.json`, JSON.stringify({
    name: 'WebToPrototype', id: 'webtoprototype-m0-probe', api: '1.0.0',
    main: 'code.js', ui: 'ui.html', editorType: ['figma'], documentAccess: 'dynamic-page',
    networkAccess: { allowedDomains: ['none'], devAllowedDomains: ['http://localhost:43821'], reasoning: '开发插件仅连接本机桌面应用，配对后传输转换任务与导入回执；文件导入无需网络。' }
  }, null, 2) + '\n')
]);
console.log('Built desktop probe and local Figma development plugin.');

