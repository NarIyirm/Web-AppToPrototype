import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),folder=resolve(root,'contracts/artifacts/0.1.0-alpha.1');
const manifest=JSON.parse(readFileSync(resolve(folder,'manifest.json'),'utf8'));
for(const file of manifest.files){
 const copy=readFileSync(resolve(folder,file.path)),source=readFileSync(resolve(root,file.path));
 if(copy.length!==file.bytes||createHash('sha256').update(copy).digest('hex')!==file.sha256||!copy.equals(source))throw Error(`Contract artifact drift: ${file.path}`);
}
for(const [name,version] of Object.entries(manifest.runtimeDependencies))if(JSON.parse(readFileSync(resolve(root,'node_modules',name,'package.json'),'utf8')).version!==version)throw Error(`Contract runtime mismatch: ${name}`);
console.log(`Contract ${manifest.formatVersion}: ${manifest.files.length} traced files match source and runtime.`);
