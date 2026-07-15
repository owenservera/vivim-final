import { CapabilityEventBus } from '../../src/engines/capability-event-bus.js'
import { ConfigManager } from '../../src/engines/config-manager.js'
import type { KernelContext } from '../../src/engines/kernel/kernel-context.js'
import { KernelProvenance } from '../../src/engines/kernel/kernel-provenance.js'
import { KernelRegistry } from '../../src/engines/kernel/kernel-registry.js'
import { KernelTracer } from '../../src/engines/kernel/kernel-tracer.js'
import { createMockKernelStore } from './mock-store-contracts.js'

export function createMockKernelContext(): KernelContext {
  const registry = new KernelRegistry()
  const tracer = new KernelTracer()
  const provenance = new KernelProvenance()
  const eventBus = CapabilityEventBus.getInstance()
  const store = createMockKernelStore()
  const config = new ConfigManager(
    {
      getConfigEntry: async () => null,
      upsertConfigEntry: async (engineId, scopeType, scopeId, configJson, schemaVersion) => ({
        id: 'mock-config',
        engineId,
        scopeType,
        scopeId,
        configJson,
        schemaVersion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      insertConfigAudit: async (row) => ({ ...row, id: 'mock-audit' }),
      getConfigAuditHistory: async () => [],
      getConfigEntryById: async () => null,
    },
    { emit: () => {} },
  )

  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => logger,
    withFields: () => logger,
  }

  const ctx = {
    kernel: null as unknown as KernelContext['kernel'],
    registry,
    tracer,
    provenance,
    eventBus,
    config,
    store,
    logger,
    oracle: null,
  }

  return ctx
}
