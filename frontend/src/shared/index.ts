/**
 * shared/index.ts — barrel for shared contract types.
 * Conceptual-model and ui-component both export a `ComponentContract`
 * type; we explicitly re-export under disambiguated names to avoid
 * the duplicate-export error (TS2308).
 *
 * Phase 2 adds: workspace, document, media, automation, agent,
 * workspace-route, shell-command.
 */
export * from './canvas-types';
export {
  RESOLUTION_CHAIN,
  type ResolutionTier,
  type ProviderTypeSlug,
  type PrimitiveScope,
  type RegionRect,
  type SlotCatalogEntry,
  type GestureCatalog,
  type LayoutRule,
  type InteractionGrammar,
  type ProviderType,
  type Primitive,
  primitiveToSlotId,
} from './conceptual-model';
export type {
  UiComponentStatus,
  UiComponentAuthor,
  ComponentArchetype,
  ComponentConstraints,
  UiComponent,
  uiComponentKey,
} from './ui-component';
export * from './stream-blocks';
export * from './route-context';

// Phase 2 — workspace OS expansion
export * from './workspace';
export * from './document';
export * from './media';
export * from './automation';
export * from './agent';
export * from './workspace-route';
export * from './shell-command';

// Phase 3 — UX enhancements (consumer + enterprise)
export * from './notification';
export * from './theme';
export * from './audit';
export * from './rbac';
export * from './template';
export * from './presence';
export * from './search';
export * from './onboarding';

// Phase 4 — doc suite, z-layers, drawers, unified IO
export * from './document-types';
export * from './z-layer';
export * from './drawer';
export * from './unified-io';

// V6 — the living canvas
export * from './streaming';
export * from './vcard';
export * from './connection-line';
export * from './layout-intent';
export * from './agent-canvas';
export * from './observability';

// Universal registry — single registry for ALL UI components
export * from './universal-registry';

// V8 — UI design language (property traits + inheritance + blueprint)
export * from './ui-language';
