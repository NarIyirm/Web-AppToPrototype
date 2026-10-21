import {readFile,writeFile,rename,mkdir,readdir,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseCapturePackage} from '../../../packages/contracts/src/index';
import type {CaptureResult} from './capture-data';
import {emptyProject,validateProject,type ProjectDocument} from './project';
export async function atomicFile(path:string,body:string|Uint8Array){const temp=path+'.'+randomUUID()+'.tmp';try{await writeFile(temp,body);await rename(temp,path);}catch(e){await rm(temp,{force:true}).catch(()=>{});throw e;}}
export class WorkspaceStorage{
  private writes=Promise.resolve();private project:ProjectDocument=emptyProject('project-'+randomUUID());private error='';
  constructor(private folder:string){}
  async init(){await mkdir(join(this.folder,'history'),{recursive:true});try{const path=join(this.folder,'project.json');if((await stat(path)).size>128*1024*1024)throw Error('project budget');this.project=validateProject(JSON.parse(await readFile(path,'utf8')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')this.error='E_PROJECT_STORAGE: 项目记录不可读，原文件保留。请导出备份或新建项目。';}}
  read(){return {...structuredClone(this.project),storageError:this.error};}
  async update(change:(p:ProjectDocument)=>ProjectDocument){let result:ProjectDocument|undefined;const next=this.writes.catch(()=>{}).then(async()=>{if(this.error)throw Error(this.error);const p=validateProject(change(structuredClone(this.project))),body=JSON.stringify(p);if(Buffer.byteLength(body)>128*1024*1024)throw Error('E_LIMIT_EXCEEDED: 项目含预览超过128MiB');await atomicFile(join(this.folder,'project.json'),body);this.project=p;result=p;});this.writes=next;await next;return structuredClone(result!);}
  async reset(){const next=this.writes.catch(()=>{}).then(async()=>{if(this.error)await rename(join(this.folder,'project.json'),join(this.folder,`project-unreadable-${Date.now()}.json`));const p=emptyProject('project-'+randomUUID());await atomicFile(join(this.folder,'project.json'),JSON.stringify(p));this.project=p;this.error='';});this.writes=next;await next;return this.read();}
  async remember(result:CaptureResult){const id='capture-'+randomUUID(),body=JSON.stringify({data:result.data,previews:result.previews??[]});if(Buffer.byteLength(body)>90*1024*1024)throw Error('历史记录超过90MiB');await atomicFile(join(this.folder,'history',id+'.json'),body);await this.trim();}
  async history(){const files=await readdir(join(this.folder,'history'));const records=[];for(const file of files.filter(f=>/^capture-[\w-]+\.json$/.test(f))){try{const path=join(this.folder,'history',file),meta=await stat(path);if(meta.size>90*1024*1024)continue;const saved=JSON.parse(await readFile(path,'utf8'));const data=parseCapturePackage(saved.data);records.push({id:file,at:meta.mtimeMs,name:data.screens.map(s=>s.name).join(' / ').slice(0,120),screens:data.screens.length,bytes:meta.size});}catch{/* corrupt history stays on disk, never loaded as success */}}return records.sort((a,b)=>b.at-a.at);}
  async load(id:unknown){if(typeof id!=='string'||!/^capture-[\w-]+\.json$/.test(id))throw Error('历史标识无效');const path=join(this.folder,'history',id);if((await stat(path)).size>90*1024*1024)throw Error('历史记录超限');const v=JSON.parse(await readFile(path,'utf8'));return {data:parseCapturePackage(v.data),previews:Array.isArray(v.previews)?v.previews:[],path};}
  async trim(){const records=await this.history();let total=0;for(let i=0;i<records.length;i++){const r=records[i];total+=r.bytes;if(i>=20||total>256*1024*1024)await rm(join(this.folder,'history',r.id),{force:true});}}
}
