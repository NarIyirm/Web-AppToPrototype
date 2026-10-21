import type { CaptureContext, CapturePackage, SceneNode, Rect } from '../../../packages/contracts/src/index';
import type { ImageLayout } from './visual';
export type BoundaryPolicy = 'strict' | 'complete_elements';
export interface PreviewMetadata {
  packageId: string; revision: number; screenId: string; capturedAt: string;
  frameRect: Rect; requestedRect: Rect; documentRect: Rect; partial: boolean;
  pixelWidth: number; pixelHeight: number; sha256: string;
  segmentIndex?:number;segmentCount?:number;referenceMode?:'segments'|'sampled';
}
export interface SourcePreview { dataUrl: string; metadata: PreviewMetadata }
export type OutputMode='separate'|'merged';
export interface SelectionItem {key:string;tag:string;id:string;text:string;rect:Rect;stale:boolean}
export interface SelectionState {items:SelectionItem[];excluded:SelectionItem[];multiple:boolean;mode:string}
export interface CaptureResult { data: CapturePackage; path: string; preview?: SourcePreview; previews?:SourcePreview[]; previewNotice?: string }
export interface DomCapture {
  flexCandidates?:Array<{id:string;axis:'horizontal'|'vertical'}>;
  url: string; title: string; context: CaptureContext; selection: CapturePackage['screens'][number]['selection'];
  nodes: SceneNode[]; warnings: CapturePackage['warnings'];
  images: Array<{ nodeId: string; ownerNodeId?: string; url?: string; base64?: string; layout?: ImageLayout }>;
  requestedRect?: Rect;
  layoutStamp?: { revision: number; scrollX: number; scrollY: number; width: number; height: number;contentRevision?:number;documentHeight?:number;documentWidth?:number };
}
