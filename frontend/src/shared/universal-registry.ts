/**
 * shared/universal-registry.ts
 * --------------------------------------------------------------------
 * UniversalComponentRegistry — the SINGLE registry for ALL UI components.
 *
 * Every visible UI element — canvas shells, node cards, panels, overlays,
 * theme controls, V6 components — registers here with:
 *   - id (unique)
 *   - kind (canvas/card/panel/overlay/control/primitive)
 *   - category (chat/docs/media/automation/agents/shell/audit/rbac/...)
 *   - slot (where it mounts, if applicable)
 *   - Component (the React component, or null for data-only)
 *   - capabilities (what this component can do)
 *   - metadata (version, author, tags, sandbox)
 *
 * Resolution: `registry.resolve(slot, ctx)` returns the component.
 * Hot-swap: `registry.register(spec)` live-updates via useSyncExternalStore.
 *
 * This supersedes the Phase 1 UIComponentRegistry (slot-only) and the
 * Phase 2 register-slot SDK. Both are now thin wrappers around this.
 */

import type { ComponentType } from 'react';

// ── Types ──────────────────────────────────────────────────────────────

export type ComponentKind =
  | 'canvas'      // LivingCanvas, CanvasSurface (the shell)
  | 'card'        // DocCard, MediaCard, AutomationCard, AgentCard, ShellCard, DocEditor
  | 'panel'       // ZLayerPanel, AuditDashboard, RbacManager, TemplatesGallery, DrawerSystem
  | 'overlay'     // CommandPalette, NotificationsCenter, OnboardingTour, QuickActionsMenu, AgentOverlay
  | 'control'     // ThemeProvider, ThemeSettings, WorkspaceSwitcher, PresenceIndicator, VCardMenu
  | 'primitive'   // SandboxedNode, ConnectionLayer, ObservabilityHUD, CommandStack, QuadTree, EventBus
  | 'hook';       // useStreamSlot, useResolvedNodes, useCanvasEvents (non-visual)

export type ComponentCategory =
  | 'chat' | 'docs' | 'media' | 'automation' | 'agents' | 'shell'
  | 'audit' | 'rbac' | 'templates' | 'zlayers' | 'editor'
  | 'theme' | 'workspace' | 'presence' | 'search' | 'notifications'
  | 'onboarding' | 'agent-canvas' | 'connection' | 'observability'
  | 'vcard' | 'io' | 'generic';

export interface ComponentSpec {
  /** Unique id (e.g. 'canvas.living', 'card.doc', 'panel.audit'). */
  id: string;
  /** Display label. */
  label: string;
  /** Component kind. */
  kind: ComponentKind;
  /** Category for grouping + CLI. */
  category: ComponentCategory;
  /** Slot id where this component mounts (if applicable). */
  slot?: string;
  /** The React component (null for hooks/data-only). */
  Component: ComponentType<Record<string, unknown>> | null;
  /** Capabilities this component exposes (for CLI invocation). */
  capabilities: string[];
  /** Version. */
  version: number;
  /** Author. */
  author: 'system' | 'user' | 'agent';
  /** Tags. */
  tags: string[];
  /** Whether the component is enabled. */
  enabled: boolean;
  /** Whether this is the default for its slot. */
  isDefault?: boolean;
}

export interface ResolveContext {
  slot?: string;
  category?: ComponentCategory;
  kind?: ComponentKind;
  /** Capability slug override (precedence: capability > category > default). */
  capabilitySlug?: string;
}

export interface ResolvedComponent {
  spec: ComponentSpec;
  source: 'explicit' | 'capability' | 'category' | 'default';
}

// ── Registry (external store) ──────────────────────────────────────────

const registry = new Map<string, ComponentSpec>();
const bySlot = new Map<string, string[]>(); // slot → component ids (default last)
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const l of listeners) l();
}

/** Subscribe (for useSyncExternalStore). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Get current version (for useSyncExternalStore). */
export function getVersion(): number {
  return version;
}

// ── Registration ───────────────────────────────────────────────────────

/** Register a component. If the id already exists, it's hot-swapped. */
export function register(spec: Omit<ComponentSpec, 'version'> & { version?: number }): ComponentSpec {
  const existing = registry.get(spec.id);
  const full: ComponentSpec = {
    ...spec,
    version: spec.version ?? (existing ? existing.version + 1 : 1),
  };
  registry.set(spec.id, full);

  // Index by slot.
  if (spec.slot) {
    let ids = bySlot.get(spec.slot);
    if (!ids) {
      ids = [];
      bySlot.set(spec.slot, ids);
    }
    if (!ids.includes(spec.id)) ids.push(spec.id);
  }

  emit();
  return full;
}

/** Unregister a component. */
export function unregister(id: string): boolean {
  const spec = registry.get(id);
  if (!spec) return false;
  registry.delete(id);
  if (spec.slot) {
    const ids = bySlot.get(spec.slot);
    if (ids) {
      const idx = ids.indexOf(id);
      if (idx >= 0) ids.splice(idx, 1);
      if (ids.length === 0) bySlot.delete(spec.slot);
    }
  }
  emit();
  return true;
}

/** Enable/disable a component (without removing it). */
export function setEnabled(id: string, enabled: boolean): void {
  const spec = registry.get(id);
  if (!spec) return;
  spec.enabled = enabled;
  emit();
}

// ── Resolution ─────────────────────────────────────────────────────────

/** Resolve a component by slot + context. */
export function resolve(ctx: ResolveContext): ResolvedComponent | null {
  if (ctx.slot) {
    const ids = bySlot.get(ctx.slot);
    if (ids && ids.length > 0) {
      // Find the first enabled component for this slot.
      for (const id of ids) {
        const spec = registry.get(id);
        if (spec && spec.enabled) {
          return { spec, source: 'default' };
        }
      }
    }
  }
  if (ctx.category) {
    for (const spec of registry.values()) {
      if (spec.category === ctx.category && spec.enabled) {
        return { spec, source: 'category' };
      }
    }
  }
  if (ctx.kind) {
    for (const spec of registry.values()) {
      if (spec.kind === ctx.kind && spec.enabled) {
        return { spec, source: 'default' };
      }
    }
  }
  return null;
}

/** Get a component by id. */
export function get(id: string): ComponentSpec | null {
  return registry.get(id) ?? null;
}

/** List all registered components (optionally filtered). */
export function list(filter?: {
  kind?: ComponentKind;
  category?: ComponentCategory;
  slot?: string;
  enabledOnly?: boolean;
}): ComponentSpec[] {
  const all = [...registry.values()];
  return all.filter((s) => {
    if (filter?.kind && s.kind !== filter.kind) return false;
    if (filter?.category && s.category !== filter.category) return false;
    if (filter?.slot && s.slot !== filter.slot) return false;
    if (filter?.enabledOnly && !s.enabled) return false;
    return true;
  });
}

/** List components grouped by kind (for the CLI `list components` command). */
export function listByKind(): Record<ComponentKind, ComponentSpec[]> {
  const out = {} as Record<ComponentKind, ComponentSpec[]>;
  for (const spec of registry.values()) {
    if (!out[spec.kind]) out[spec.kind] = [];
    out[spec.kind].push(spec);
  }
  return out;
}

/** Total registered count. */
export function size(): number {
  return registry.size;
}

// ── CLI bridge ─────────────────────────────────────────────────────────

/**
 * Every registered component is automatically invocable from the CLI.
 * The CLI `component <id> <action> [args]` command dispatches to the
 * component's capabilities.
 *
 * This function generates CLI command specs from the registry.
 */
export function generateCliCommands(): Array<{
  path: string[];
  description: string;
  capabilityId: string;
}> {
  const commands: Array<{ path: string[]; description: string; capabilityId: string }> = [];
  for (const spec of registry.values()) {
    if (!spec.enabled) continue;
    for (const cap of spec.capabilities) {
      commands.push({
        path: ['component', spec.id, cap.replace(/^cap:[^:]+:/, '')],
        description: `${spec.label} → ${cap}`,
        capabilityId: cap,
      });
    }
  }
  return commands;
}
