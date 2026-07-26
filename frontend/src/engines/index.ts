/**
 * engines/index.ts — public barrel.
 *
 * Engines depend ONLY on `src/storage/contracts/*` and `src/shared/*`.
 * No engine imports `src/storage/impl/*` or `BunCdpClient` (B1/B2).
 *
 * Phase 2 adds: document-engine, media-engine (+ bridge), annotation-
 * engine, workspace-engine, automation-builder, agents-builder,
 * shell-command-engine, route-sync-workspace.
 */
export { CapabilityEventBus } from './capability-event-bus';
export type { EngineEvent, EventHandler, WsLike } from './capability-event-bus';

export { StructuredLogger, TraceStore } from './structured-logger';
export type { StructuredLog, LogSink, Span, TraceEntry } from './structured-logger';

export {
  routeSync,
  onContextChange,
  resolveActions,
  resolveFamilies,
  slotToPrimitive,
  primitiveToSlotId,
  diffSurfaces,
} from './route-sync';
export type { RouteSyncDeps, SurfaceDelta } from './route-sync';

export { ConceptualModelService, buildRouteSyncDeps } from './conceptual-model-service';

export { CanvasLayerMounter } from './canvas-layer-mounter';
export type { LayerDefinition, MountedLayer } from './canvas-layer-mounter';

export { CanvasRegistry } from './canvas-registry';

export { PluginManager } from './plugin-system';
export type { ProviderPlugin } from './plugin-system';

export { PluginHotReload } from './plugin-hot-reload';
export type {
  ProviderPlugin as HotReloadPlugin,
  PluginHandler,
  PluginErrorHandler,
  PluginUnloadHandler,
  DefChangeHandler,
} from './plugin-hot-reload';

export { AdaptiveWorkspace } from './adaptive-workspace';
export type { Workspace, WorkspaceMode } from './adaptive-workspace';

// ── Phase 2: workspace OS expansion ─────────────────────────────────────
export { DocumentEngine } from './document-engine';
export type { DocumentEngineDeps } from './document-engine';

export { MediaEngine } from './media-engine';
export type { MediaEngineDeps } from './media-engine';
export { MemoryMediaBridge } from './media-bridge';
export type {
  MediaBridge,
  MediaBridgePlayOptions,
  MediaBridgeExtractOptions,
  MediaBridgeTranscribeOptions,
  FrameThumb,
} from './media-bridge';

export { AnnotationEngine } from './annotation-engine';
export type { Annotation, AnnotationStore, AnnotationEngineDeps } from './annotation-engine';

export { WorkspaceEngine } from './workspace-engine';
export type { WorkspaceEngineDeps } from './workspace-engine';

export { AutomationBuilder } from './automation-builder';
export type { AutomationBuilderDeps } from './automation-builder';

export { AgentsBuilder } from './agents-builder';
export type { AgentsBuilderDeps } from './agents-builder';

export { ShellCommandEngine } from './shell-command-engine';
export type { ShellCommandEngineDeps, StreamSink } from './shell-command-engine';

export { routeSyncWorkspace } from './route-sync-workspace';
export type { WorkspaceRouteSyncDeps } from './route-sync-workspace';

// ── Phase 3: UX enhancement engines ────────────────────────────────────
export { NotificationEngine } from './notification-engine';
export type { NotificationEngineDeps } from './notification-engine';
export { SearchEngine } from './search-engine';
export type { SearchEngineDeps } from './search-engine';
export { PresenceEngine } from './presence-engine';
export type { PresenceEngineDeps } from './presence-engine';
export { AuditEngine } from './audit-engine';
export type { AuditEngineDeps } from './audit-engine';
export { RbacEngine } from './rbac-engine';
export type { RbacEngineDeps } from './rbac-engine';
export { TemplateEngine } from './template-engine';
export type { TemplateEngineDeps } from './template-engine';

// ── Phase 4: doc suite, z-layers, drawers ──────────────────────────────
export { DocumentEditorEngine } from './document-editor-engine';
export type { DocumentEditorEngineDeps } from './document-editor-engine';
export { ZLayerEngine } from './z-layer-engine';
export type { ZLayerEngineDeps } from './z-layer-engine';
export { DrawerEngine } from './drawer-engine';
export type { DrawerEngineDeps } from './drawer-engine';

// V8 — Central Reprogrammability Engine
export { UIEngine } from './ui-engine';
export type { UIEngineDeps } from './ui-engine';
