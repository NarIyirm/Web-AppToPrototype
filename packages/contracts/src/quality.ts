import type {CapturePackage} from './index';
export function fidelityCounts(data:CapturePackage){const counts={native:0,approximated:0,rasterized:0,missing:0};for(const screen of data.screens)for(const node of screen.nodes)if(node.type!=='FRAME'||node.fidelity==='missing')counts[node.fidelity]++;return counts;}
