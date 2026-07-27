// components/builder/index.ts
// Phase 6 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Visual Builder (node-graph).
// Barrel export for the BuilderSurface family.
//
// CONTRACT_VERSION: 1

export { BuilderSurface } from './BuilderSurface';
export type { BuilderSurfaceProps, BuilderGraph } from './BuilderSurface';
export { SurfaceNode } from './SurfaceNode';
export type { SurfaceNodeData, SurfaceNodeProps, Port } from './SurfaceNode';
export { CapabilityNode } from './CapabilityNode';
export type { CapabilityNodeData, CapabilityNodeProps } from './CapabilityNode';
export { MutationEdge } from './MutationEdge';
export type { MutationEdgeData, MutationEdgeProps } from './MutationEdge';
export { Toolbar } from './Toolbar';
export type { ToolbarProps } from './Toolbar';
