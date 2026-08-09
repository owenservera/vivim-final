/**
 * VIVIM AI Gateway — In-Memory Model Registry
 * @module ai/registry/in-memory-model-registry
 */

import type { ModelDescriptor, ModelId, ProviderId } from '../core/types.js'
import type { IModelRegistry } from './registry.js'

export class InMemoryModelRegistry implements IModelRegistry {
  private readonly models = new Map<ModelId, ModelDescriptor>()

  async register(model: ModelDescriptor): Promise<void> {
    this.models.set(model.id, model)
  }

  async unregister(modelId: ModelId): Promise<void> {
    this.models.delete(modelId)
  }

  async get(modelId: ModelId): Promise<ModelDescriptor | undefined> {
    return this.models.get(modelId)
  }

  async list(): Promise<readonly ModelDescriptor[]> {
    return Array.from(this.models.values())
  }

  async listByProvider(providerId: ProviderId): Promise<readonly ModelDescriptor[]> {
    const out: ModelDescriptor[] = []
    for (const model of this.models.values()) {
      if (model.providerId === providerId) out.push(model)
    }
    return out
  }

  async has(modelId: ModelId): Promise<boolean> {
    return this.models.has(modelId)
  }

  async unregisterByProvider(providerId: ProviderId): Promise<void> {
    for (const [id, model] of this.models) {
      if (model.providerId === providerId) {
        this.models.delete(id)
      }
    }
  }
}
