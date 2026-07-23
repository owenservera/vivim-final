/**
 * sdk/canvas/index.ts
 * --------------------------------------------------------------------
 * @vivim/canvas-sdk — barrel. Author SDK for shipping hot-swappable
 * UI components to the Vivim Universal Canvas without touching core.
 *
 * G1 deliverable (bundle prompt §4.1):
 *   - defineComponent(input) → CanvasDefinition
 *   - publish(def) → Promise<{id, slug, version}>
 *   - hotReload(watchDir) → Disposer
 *   - registerSlot / unregisterSlot
 *   - useCanvasComponent(slot, ctx)
 *   - CapabilityBus client (sandboxed postMessage)
 *
 * All exports use `unknown` + narrowing (no `any`), Zod at boundaries,
 * literal `false` for `allowInlineScript` (P8).
 */

export { defineComponent, CANVAS_DEFINITION_INPUT_SCHEMA } from './define-component';
export type { CanvasDefinitionInput } from './define-component';

export { publish } from './publish';
export type { PublishOptions } from './publish';

export { hotReload } from './hot-reload';
export type { HotReloadOptions, Disposer } from './hot-reload';

export {
  registerSlot,
  unregisterSlot,
  registerDefault,
  resolveSlot,
  listSlotOverrides,
  subscribe,
  getVersion,
} from './register-slot';
export type {
  AnyComponent,
  SlotSource,
  ResolvedSlotComponent,
  RegisterOptions,
} from './register-slot';

export { useCanvasComponent } from './use-canvas-component';

export { CapabilityBus, getBusFromWindow } from './capability-bus';
export type { CapabilityBusOptions } from './capability-bus';

// Re-export shared types so plugin authors have one import path.
export type {
  CanvasDefinition,
  SandboxPolicy,
  CanvasLayout,
  LayerBinding,
  LayerAuthor,
  LayerStatus,
  LayerCategory,
} from '../../shared/canvas-types';
export { buildSandboxPolicy, DEFAULT_SANDBOX_CSP } from '../../shared/canvas-types';

// ── Phase 4 — doc suite, z-layers, drawers, unified IO ─────────────────
export { createDocumentEditorClient } from './document-editor-client';
export type { DocumentEditorClient } from './document-editor-client';
export { createZLayerClient } from './z-layer-client';
export type { ZLayerClient } from './z-layer-client';
export { createDrawerClient } from './drawer-client';
export type { DrawerClient } from './drawer-client';
export { createUnifiedIO } from './unified-io-client';
export type {
  UnifiedIO,
  IORequestInit,
  IOResponse,
  IOEvent,
  IOError,
} from '../../shared/unified-io';
