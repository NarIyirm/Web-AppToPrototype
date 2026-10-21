import {appendFile,stat,rename,rm,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
export class RuntimeLog{
 private pending=Promise.resolve();constructor(private folder:string){}
 write(event:string,fields:Record<string,string|number|boolean>={}){const task=this.pending.catch(()=>{}).then(async()=>{await mkdir(this.folder,{recursive:true});const file=join(this.folder,'runtime.log');let size=0;try{size=(await stat(file)).size;}catch{}if(size>1024*1024){await rm(file+'.2',{force:true});try{await rename(file+'.1',file+'.2');}catch{}await rename(file,file+'.1');}await appendFile(file,JSON.stringify({at:new Date().toISOString(),event,...fields})+'\n');});this.pending=task;return task;}
}
