import type { CapturePackage } from './index';
export interface BridgeTarget { bindingId:string; documentName:string; pageId:string; pageName:string }
export interface ImportReport {
  reportKind:'actual_import'; inputKind:'capture'|'example'; importId:string; packageId:string; revision:number;
  startedAt:string; finishedAt:string; status:'succeeded'|'succeeded_with_warnings'; targetPageId:string;
  rootNodeIds:string[]; nodeMap:Array<{screenId:string;sceneNodeId:string;figmaNodeId:string}>;
  counts:{nodes:number;screens:number;images:number;interactions:number}; warnings:Array<{code:string;message:string;[key:string]:unknown}>;
  errors:unknown[]; versions:{plugin:string;schema:string};
  fidelity?:{native:number;approximated:number;rasterized:number;missing:number};
}
export type JobStatus='queued'|'importing'|'succeeded'|'failed'|'cancelled'|'interrupted';
export interface BridgeJob {
  id:string; importId:string; packageId:string; revision:number; target:BridgeTarget; status:JobStatus;
  createdAt:string; updatedAt:string; completed:number; total:number; message:string; report?:ImportReport;
  packageSha256?:string;
  leaseExpiresAt?:string;
}
export interface BridgeManifest {job:BridgeJob;transfer:{byteLength:number;sha256:string;chunkSize:number;chunks:number}}
export interface BridgeDelivery { job:BridgeJob; data:CapturePackage }
export interface BridgeState { connected:boolean; paired:boolean; target?:BridgeTarget; reason:string; jobs:BridgeJob[] }
export interface BridgeResult { jobId:string; importId:string; report?:ImportReport; error?:string }
export function sameTarget(a:BridgeTarget,b:BridgeTarget){return a.bindingId===b.bindingId&&a.pageId===b.pageId;}
