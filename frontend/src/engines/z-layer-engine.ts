/**
 * engines/z-layer-engine.ts
 * --------------------------------------------------------------------
 * E2 — Configurable Z layers engine.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { ZLayerConfig, ZLayerId, WorkspaceZLayerConfig } from '../shared/z-layer';
import type { ZLayerStore } from '../storage/contracts/z-layer-store';

export interface ZLayerEngineDeps {
  zLayerStore: ZLayerStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class ZLayerEngine {
  constructor(private deps: ZLayerEngineDeps) {}

  async get(workspaceId: string): Promise<WorkspaceZLayerConfig> {
    return this.deps.zLayerStore.get(workspaceId);
  }

  async updateLayer(
    workspaceId: string,
    layerId: ZLayerId,
    patch: Partial<ZLayerConfig>,
  ): Promise<WorkspaceZLayerConfig> {
    const config = await this.deps.zLayerStore.updateLayer(workspaceId, layerId, patch);
    this.deps.eventBus.emit({
      type: 'zlayer:updated',
      workspaceId,
      layerId,
      traceId: `zlayer-${Date.now().toString(36)}`,
    });
    return config;
  }

  async setActiveLayer(workspaceId: string, layerId: ZLayerId): Promise<void> {
    await this.deps.zLayerStore.setActiveLayer(workspaceId, layerId);
    this.deps.eventBus.emit({ type: 'zlayer:active_changed', workspaceId, layerId });
  }

  async reorder(workspaceId: string, order: ZLayerId[]): Promise<WorkspaceZLayerConfig> {
    return this.deps.zLayerStore.reorder(workspaceId, order);
  }

  async reset(workspaceId: string): Promise<WorkspaceZLayerConfig> {
    return this.deps.zLayerStore.reset(workspaceId);
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:zlayer:get':
        return this.get(String(input.workspaceId));
      case 'cap:zlayer:update':
        return this.updateLayer(
          String(input.workspaceId),
          input.layerId as ZLayerId,
          input.patch as Partial<ZLayerConfig>,
        );
      case 'cap:zlayer:set_active':
        return this.setActiveLayer(String(input.workspaceId), input.layerId as ZLayerId);
      case 'cap:zlayer:reorder':
        return this.reorder(String(input.workspaceId), input.order as ZLayerId[]);
      case 'cap:zlayer:reset':
        return this.reset(String(input.workspaceId));
      default:
        throw new Error(`z-layer-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:zlayer:get', 'cap:zlayer:update', 'cap:zlayer:set_active', 'cap:zlayer:reorder', 'cap:zlayer:reset'];
  }
}
