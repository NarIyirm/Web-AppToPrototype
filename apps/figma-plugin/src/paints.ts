import type { Fill, SceneNode } from '../../../packages/contracts/src/index';

export function scenePaint(fill: Fill, width: number, height: number): Paint {
  if (fill.kind === 'solid') return { type:'SOLID', color:{r:fill.color.r,g:fill.color.g,b:fill.color.b}, opacity:fill.color.a };
  const rad = fill.angle * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
  const length = Math.max(.0001, Math.abs(width*dx)+Math.abs(height*dy));
  // Map normalized node coordinates into gradient space. First row is the physical
  // projection onto the CSS axis, so non-square nodes preserve the CSS angle.
  const a = dx*width/length, b = dy*height/length;
  const c = -dy*width/length, d = dx*height/length;
  return { type:'GRADIENT_LINEAR', gradientStops:fill.stops, gradientTransform:[[a,b,.5-(a+b)/2],[c,d,.5-(c+d)/2]] };
}
export function sceneImagePaint(node: SceneNode, hash: string): ImagePaint {
  return node.imageSizing === 'stretch'
    ? { type:'IMAGE', imageHash:hash, scaleMode:'CROP', imageTransform:[[1,0,0],[0,1,0]] }
    : { type:'IMAGE', imageHash:hash, scaleMode:'FILL' };
}
