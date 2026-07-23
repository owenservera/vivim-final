/**
 * components/canvas/transform.ts
 * --------------------------------------------------------------------
 * World↔screen coordinate transforms (harvested from POC engine.ts).
 * CanvasSurface uses these for pan/zoom; the CanvasDefinition.layout
 * is world-space {x,y,z,w,h} where z is depth (not zoom).
 */

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export function worldToScreen(
  wx: number,
  wy: number,
  vp: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
): Vec2 {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  return {
    x: (wx - vp.x) * vp.zoom + cx,
    y: (wy - vp.y) * vp.zoom + cy,
  };
}

export function screenToWorld(
  sx: number,
  sy: number,
  vp: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
): Vec2 {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  return {
    x: (sx - cx) / vp.zoom + vp.x,
    y: (sy - cy) / vp.zoom + vp.y,
  };
}

export function clampZoom(zoom: number): number {
  return Math.max(0.05, Math.min(10, zoom));
}

export interface Vec2 {
  x: number;
  y: number;
}
