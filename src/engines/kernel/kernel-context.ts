// src/engines/kernel/kernel-context.ts
// KernelContext — unified context object passed to every engine constructor.
// Provides access to kernel subsystems through a single object.

import { getLogger } from '../../lib/logger.js'
import type { KernelStore } from '../../storage/contracts/kernel-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { ConfigManager } from '../config-manager.js'
import type { KernelProvenance } from './kernel-provenance.js'
import type { KernelRegistry } from './kernel-registry.js'
import type { KernelTracer } from './kernel-tracer.js'
import type { OracleActuator } from './oracle-actuator.js'
import type { OracleDiagnosticEngine } from './oracle-diagnostic.js'
import type { OracleEventStream } from './oracle-event-stream.js'
import type { OracleQueryEngine } from './oracle-query.js'

export interface KernelLogger {
  info(msg: string, data?: Record<string, unknown>): void
  warn(msg: string, data?: Record<string, unknown>): void
  error(msg: string, data?: Record<string, unknown>): void
  debug(msg: string, data?: Record<string, unknown>): void
  child(prefix: string): KernelLogger
  withFields(fields: Record<string, unknown>): KernelLogger
}

export class ConsoleKernelLogger implements KernelLogger {
  private prefix: string
  private fields: Record<string, unknown>
  private log: ReturnType<typeof getLogger>

  constructor(prefix = 'kernel', fields: Record<string, unknown> = {}) {
    this.prefix = prefix
    this.fields = fields
    this.log = getLogger(`kernel:${prefix}`)
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log.info({ ...this.fields, ...data }, msg)
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log.warn({ ...this.fields, ...data }, msg)
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log.error({ ...this.fields, ...data }, msg)
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    if (process.env.DEBUG) {
      this.log.debug({ ...this.fields, ...data }, msg)
    }
  }

  child(prefix: string): KernelLogger {
    return new ConsoleKernelLogger(`${this.prefix}:${prefix}`, this.fields)
  }

  withFields(fields: Record<string, unknown>): KernelLogger {
    return new ConsoleKernelLogger(this.prefix, { ...this.fields, ...fields })
  }
}

export interface KernelContext {
  kernel: Kernel
  registry: KernelRegistry
  tracer: KernelTracer
  provenance: KernelProvenance
  eventBus: CapabilityEventBus
  config: ConfigManager
  store: KernelStore | null
  logger: KernelLogger
  oracle: {
    query: OracleQueryEngine
    diagnostic: OracleDiagnosticEngine
    actuator: OracleActuator
    events: OracleEventStream
  } | null
}

export interface Kernel {
  context(): KernelContext
  start(): Promise<void>
  stop(): Promise<void>
  snapshot(): import('../../storage/contracts/kernel-store.js').SystemTopology
}

export class KernelImpl implements Kernel {
  private ctx: KernelContext
  private started = false

  constructor(ctx: KernelContext) {
    this.ctx = ctx
  }

  context(): KernelContext {
    return this.ctx
  }

  async start(): Promise<void> {
    if (this.started) return
    this.ctx.logger.info('kernel starting')
    this.ctx.registry.markRunning('kernel')
    this.started = true
    this.ctx.logger.info('kernel started', {
      engines: this.ctx.registry.describe().engines.length,
    })
  }

  async stop(): Promise<void> {
    if (!this.started) return
    this.ctx.logger.info('kernel stopping')
    this.ctx.registry.markStopped('kernel')
    this.started = false
    this.ctx.logger.info('kernel stopped')
  }

  snapshot(): import('../../storage/contracts/kernel-store.js').SystemTopology {
    return this.ctx.registry.describe()
  }
}

export function createKernel(deps: {
  registry: KernelRegistry
  tracer: KernelTracer
  provenance: KernelProvenance
  eventBus: CapabilityEventBus
  config: ConfigManager
  store?: KernelStore
  logger?: KernelLogger
}): Kernel {
  const logger = deps.logger ?? new ConsoleKernelLogger()

  deps.registry.registerEngine({
    id: 'kernel',
    kind: 'engine',
    layer: 'kernel',
    dependencies: [],
    status: 'registered',
    config: {},
    metadata: { description: 'VIVIM Kernel — self-understanding layer' },
  })

  const ctx: KernelContext = {
    kernel: null as unknown as Kernel,
    registry: deps.registry,
    tracer: deps.tracer,
    provenance: deps.provenance,
    eventBus: deps.eventBus,
    config: deps.config,
    store: deps.store ?? null,
    logger,
    oracle: null,
  }

  const kernel = new KernelImpl(ctx)
  ctx.kernel = kernel

  return kernel
}
