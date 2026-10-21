import {createHash} from 'node:crypto';
export function previewPath(path:string,screenId:string,firstScreenId:string,segment=1){
 // Imported screen IDs are identifiers, never filesystem paths.
 const safe=/^[A-Za-z0-9_-]{1,80}$/.test(screenId)?screenId:`id-${createHash('sha256').update(screenId).digest('hex').slice(0,32)}`;
 return segment>1?`${path}.${safe}.segment-${segment}`:screenId===firstScreenId?path:`${path}.${safe}`;
}
