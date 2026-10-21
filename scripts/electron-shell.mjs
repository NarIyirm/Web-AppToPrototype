// WebContentsView can finish loading before the shell. Never assume the first
// Playwright page is the privileged desktop UI.
export async function waitForShell(application){
 const deadline=Date.now()+20000;
 while(Date.now()<deadline){const shell=application.windows().find(page=>page.url().startsWith('file:'));if(shell){await shell.waitForFunction(()=>!!window.w2p);return shell;}await new Promise(resolve=>setTimeout(resolve,100));}
 throw Error('Desktop shell did not load');
}
