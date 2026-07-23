/**
 * engines/ui-engine.ts
 * --------------------------------------------------------------------
 * V8 G1 — Central Reprogrammability Engine.
 *
 * Extends the V7 UniversalComponentRegistry with:
 *   - UIComponentSpec (property traits + inheritance + variants)
 *   - setProperty(id, path, value) — live property mutation
 *   - extendSpec(baseId, overrides) — create a derived component
 *   - applyBlueprint(patch) — batch reprogram the entire UI
 *   - getBlueprint() — read the full UI snapshot
 *   - getSpec(id) — read a component's full resolved spec
 *
 * CLI: `/vivim ui list|get|create|update|delete|extend|apply`
 * SDK: `uiEngine.register()`, `uiEngine.get()`, `uiEngine.setProperty()`, `uiEngine.extendSpec()`
 * Frontend: `window.vivim.ui` exposed to sandboxed CanvasDefinitions
 *
 * Every mutation emits `ui:reprogrammed` on the event bus →
 * useSyncExternalStore consumers re-render instantly (hot-swap, no reload).
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { ComponentSpec } from '../shared/universal-registry';
import {
  register as registryRegister,
  unregister as registryUnregister,
  get as registryGet,
  list as registryList,
  resolve as registryResolve,
  subscribe,
  getVersion,
  size,
} from '../shared/universal-registry';
import type {
  UIComponentSpec,
  UIProperties,
  UIAction,
  UIVariant,
  UIBlueprint,
} from '../shared/ui-language';
import {
  resolveProperties,
  mergeProperties,
  applyBlueprintPatch,
  SYSTEM_DEFAULTS,
} from '../shared/ui-language';

export interface UIEngineDeps {
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class UIEngine {
  private specs = new Map<string, UIComponentSpec>();
  private blueprint: UIBlueprint | null = null;

  constructor(private deps: UIEngineDeps) {}

  // ── Registration (extends UniversalComponentRegistry) ──────────────

  /** Register a UIComponentSpec. Also registers in the base registry. */
  register(spec: UIComponentSpec): UIComponentSpec {
    this.specs.set(spec.id, spec);
    // Also register in the base UniversalComponentRegistry (for Component lookup).
    registryRegister(spec);
    this.deps.eventBus.emit({ type: 'ui:registered', componentId: spec.id, version: spec.version });
    return spec;
  }

  /** Unregister a component. */
  unregister(id: string): boolean {
    const existed = this.specs.delete(id);
    registryUnregister(id);
    if (existed) this.deps.eventBus.emit({ type: 'ui:unregistered', componentId: id });
    return existed;
  }

  /** Get a component's full spec (with resolved properties). */
  getSpec(id: string): UIComponentSpec | null {
    return this.specs.get(id) ?? null;
  }

  /** Get a component's RESOLVED properties (inheritance walk). */
  getResolvedProperties(id: string): UIProperties | null {
    const spec = this.specs.get(id);
    if (!spec) return null;
    return resolveProperties(spec);
  }

  /** List all registered UIComponentSpecs. */
  listSpecs(filter?: { kind?: string; category?: string; enabledOnly?: boolean }): UIComponentSpec[] {
    const all = [...this.specs.values()];
    return all.filter((s) => {
      if (filter?.kind && s.kind !== filter.kind) return false;
      if (filter?.category && s.category !== filter.category) return false;
      if (filter?.enabledOnly && !s.enabled) return false;
      return true;
    });
  }

  // ── Live Property Mutation ─────────────────────────────────────────

  /**
   * Set a single property on a component. Path is dot-notation:
   *   `styling.borderRadius`, `layout.minWidth`, `visibility.animation`
   * Emits `ui:reprogrammed` → all consumers re-render.
   */
  setProperty(id: string, path: string, value: unknown): UIComponentSpec | null {
    const spec = this.specs.get(id);
    if (!spec) return null;
    const parts = path.split('.');
    const root = parts[0] as keyof UIProperties;
    if (!(root in (spec.properties ?? {}))) {
      (spec.properties as Record<string, unknown>)[root] = {};
    }
    let target: Record<string, unknown> = spec.properties as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i]!;
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      target = target[k] as Record<string, unknown>;
    }
    target[parts[parts.length - 1]!] = value;
    spec.version += 1;
    // Re-register to bump the base registry version.
    registryRegister(spec);
    this.deps.eventBus.emit({
      type: 'ui:reprogrammed',
      componentId: id,
      path,
      version: spec.version,
      traceId: `ui-${Date.now().toString(36)}`,
    });
    this.deps.logger.info('ui-engine', `set ${id}.${path} = ${JSON.stringify(value).slice(0, 60)}`, {
      componentId: id, path, version: spec.version,
    });
    return spec;
  }

  /**
   * Extend an existing component spec — creates a derived component
   * that inherits from the base. The new spec gets `extends: baseId`
   * and merged properties.
   */
  extendSpec(baseId: string, overrides: {
    id: string;
    label?: string;
    properties?: Partial<UIProperties>;
    features?: string[];
    actions?: UIAction[];
    variants?: Record<string, UIVariant>;
    tags?: string[];
  }): UIComponentSpec | null {
    const base = this.specs.get(baseId);
    if (!base) return null;
    const merged: UIComponentSpec = {
      ...base,
      id: overrides.id,
      label: overrides.label ?? `${base.label} (extended)`,
      extends: baseId,
      properties: mergeProperties(base.properties ?? {}, overrides.properties ?? {}),
      features: [...new Set([...base.features, ...(overrides.features ?? [])])],
      actions: [...base.actions, ...(overrides.actions ?? [])],
      variants: { ...base.variants, ...(overrides.variants ?? {}) },
      tags: [...new Set([...base.tags, ...(overrides.tags ?? [])])],
      version: 1,
    };
    return this.register(merged);
  }

  // ── Blueprint (full UI snapshot) ───────────────────────────────────

  /** Read the full UI blueprint (all component specs + theme). */
  getBlueprint(workspaceId: string): UIBlueprint {
    if (this.blueprint && this.blueprint.workspaceId === workspaceId) {
      return this.blueprint;
    }
    const components: Record<string, UIComponentSpec> = {};
    for (const spec of this.specs.values()) {
      components[spec.id] = spec;
    }
    this.blueprint = {
      workspaceId,
      components,
      themeMode: 'light',
      accentColor: 'amber',
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return this.blueprint;
  }

  /**
   * Apply a blueprint patch — deep-merges component specs, bumps
   * versions, emits `ui:reprogrammed` for each changed component.
   * This is the "reprogram the entire UI" entry point.
   */
  applyBlueprint(workspaceId: string, patch: Partial<Pick<UIBlueprint, 'components' | 'themeMode' | 'accentColor'>>): UIBlueprint {
    const current = this.getBlueprint(workspaceId);
    const next = applyBlueprintPatch(current, patch);
    this.blueprint = next;
    // Register all changed components.
    if (patch.components) {
      for (const [id, spec] of Object.entries(patch.components)) {
        this.specs.set(id, spec);
        registryRegister(spec);
        this.deps.eventBus.emit({
          type: 'ui:reprogrammed',
          componentId: id,
          version: spec.version,
          traceId: `blueprint-${next.version}`,
        });
      }
    }
    this.deps.logger.info('ui-engine', `blueprint applied v${next.version}`, {
      workspaceId, componentCount: Object.keys(next.components).length,
    });
    return next;
  }

  // ── Delegates to the base registry ────────────────────────────────

  resolve(ctx: Parameters<typeof registryResolve>[0]) {
    return registryResolve(ctx);
  }

  subscribe = subscribe;
  getVersion = getVersion;
  size = () => this.specs.size;

  // ── Capability Dispatcher ─────────────────────────────────────────

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:ui:list':
        return this.listSpecs({
          kind: input.kind as string | undefined,
          category: input.category as string | undefined,
          enabledOnly: input.enabledOnly === true,
        }).map((s) => ({
          id: s.id, label: s.label, kind: s.kind, category: s.category,
          version: s.version, enabled: s.enabled, capabilities: s.capabilities.length,
        }));
      case 'cap:ui:get':
        return this.getSpec(String(input.id));
      case 'cap:ui:get_resolved':
        return this.getResolvedProperties(String(input.id));
      case 'cap:ui:set_property':
        return this.setProperty(String(input.id), String(input.path), input.value);
      case 'cap:ui:extend':
        return this.extendSpec(String(input.baseId), {
          id: String(input.id),
          label: input.label as string | undefined,
          properties: input.properties as Partial<UIProperties> | undefined,
          features: input.features as string[] | undefined,
          actions: input.actions as UIAction[] | undefined,
          tags: input.tags as string[] | undefined,
        });
      case 'cap:ui:unregister':
        return this.unregister(String(input.id));
      case 'cap:ui:get_blueprint':
        return this.getBlueprint(String(input.workspaceId ?? 'ws:global'));
      case 'cap:ui:apply_blueprint':
        return this.applyBlueprint(
          String(input.workspaceId ?? 'ws:global'),
          input.patch as Parameters<UIEngine['applyBlueprint']>[1],
        );
      default:
        throw new Error(`ui-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:ui:list', 'cap:ui:get', 'cap:ui:get_resolved',
      'cap:ui:set_property', 'cap:ui:extend', 'cap:ui:unregister',
      'cap:ui:get_blueprint', 'cap:ui:apply_blueprint',
    ];
  }
}
