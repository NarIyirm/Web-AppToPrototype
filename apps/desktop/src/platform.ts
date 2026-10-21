import type {App,BrowserWindow,MenuItemConstructorOptions} from 'electron';

export function revealWindow(window:BrowserWindow){if(window.isDestroyed())return;if(window.isMinimized())window.restore();window.show();window.focus();}

export function bindMacLifecycle(app:App,window:BrowserWindow,platform=process.platform,smoke=false){
  if(platform!=='darwin'||smoke)return;
  let quitting=false;
  app.on('before-quit',()=>{quitting=true;});
  // Keep the same browser/session and project when the red close control is used.
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
  app.on('activate',()=>revealWindow(window));
}

export function macMenu(focusAddress:()=>void):MenuItemConstructorOptions[]{return [
  {label:'WebToPrototype',submenu:[{role:'about'},{type:'separator'},{role:'services'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
  {label:'文件',submenu:[{label:'打开网址',accelerator:'Command+L',click:focusAddress},{type:'separator'},{role:'close'}]},
  {role:'editMenu'},
  {label:'窗口',submenu:[{role:'minimize'},{role:'zoom'},{type:'separator'},{role:'front'}]}
];}
