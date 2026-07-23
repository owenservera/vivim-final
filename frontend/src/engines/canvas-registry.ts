/**
 * engines/canvas-registry.ts
 * --------------------------------------------------------------------
 * CanvasRegistry — published CanvasDefinition rows (bundle 01 §1).
 * `define / get / getBySlug / list / update / deprecate`.
 *
 * This is the live publish point: a `define()` is a DB write that
 * emits `plugin:registered` on the bus. There is NO build step.
 */

import type { CanvasDefinition, LayerStatus } from '../shared/canvas-types';
import type { CapabilityEventBus } from './capability-event-bus';
import type { CanvasDefinitionInput, CanvasDefinitionStore } from '../storage/contracts/canvas-definition-store';

export class CanvasRegistry {
  constructor(private store: CanvasDefinitionStore, private eventBus: CapabilityEventBus) {}

  async define(input: CanvasDefinitionInput): Promise<CanvasDefinition> {
    const def = await this.store.define(input);
    this.eventBus.emit({
      type: 'plugin:registered',
      pluginId: def.id,
      slug: def.slug,
      category: def.category,
    });
    return def;
  }

  async get(id: string): Promise<CanvasDefinition | null> {
    return this.store.get(id);
  }

  async getBySlug(slug: string): Promise<CanvasDefinition | null> {
    return this.store.getBySlug(slug);
  }

  async list(filter?: { category?: string; status?: LayerStatus }): Promise<CanvasDefinition[]> {
    return this.store.list(filter);
  }

  async update(id: string, patch: Partial<CanvasDefinitionInput>): Promise<CanvasDefinition> {
    const updated = await this.store.update(id, patch);
    this.eventBus.emit({
      type: 'canvas:def:updated',
      definitionId: updated.id,
      slug: updated.slug,
      version: updated.version,
    });
    return updated;
  }

  async deprecate(id: string): Promise<boolean> {
    const ok = await this.store.deprecate(id);
    if (ok) {
      this.eventBus.emit({ type: 'canvas:def:deprecated', definitionId: id });
    }
    return ok;
  }
}
