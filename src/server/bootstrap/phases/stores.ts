// src/server/bootstrap/phases/stores.ts
// Boot phase: store instances + core parsing/memory engines + governor + CDP
// transport + conversation manager. This phase owns the "hard" dependency spine:
// every later phase consumes what is built here.
// Writes: convStore, resolutionEngine, parserEngine, streamBlocks, memoryEngine,
//         governor, conversationManager, cdpTransport on ctx.

import { config } from '../../../config.js'
import { getLogger } from '../../../lib/logger.js'
import { onShutdown } from '../../index.js'
import type { BootstrapContext } from '../context.js'

const log = getLogger('bootstrap:stores')

export async function bootstrapStoresPhase(ctx: BootstrapContext): Promise<void> {
  const db = ctx.db!
  const eventBus = ctx.eventBus!

  // Lazy-import engine classes to avoid circular deps at module load
  const { ConversationManager } = await import('../../../engines/conversation-manager.js')
  const { CapabilityResolutionEngine } = await import('../../../engines/capability-resolution.js')
  const { ChromeGovernor } = await import('../../../engines/chrome-governor.js')
  const { StreamParserEngine } = await import('../../../engines/stream-parser.js')
  const { SandboxRunner } = await import('../../../engines/sandbox-runner.js')
  const { SandboxAuditStoreImpl } = await import('../../../storage/impl/sandbox-audit-store-impl.js')
  const { StreamBlockStore } = await import('../../../engines/stream-block-store.js')
  const { NodeStoreImpl } = await import('../../../storage/impl/node-store-impl.js')
  const { ExecutionMemoizer } = await import('../../../engines/execution-memoizer.js')
  const { MemoryEngine } = await import('../../../engines/memory-engine.js')
  const { ConversationStoreImpl } = await import('../../../storage/impl/conversation-store-impl.js')
  const { GovernorStoreImpl } = await import('../../../storage/impl/governor-store-impl.js')
  const { CapabilityResolutionStoreImpl } = await import(
    '../../../storage/impl/capability-resolution-store-impl.js'
  )
  const { ParserStoreImpl } = await import('../../../storage/impl/parser-store-impl.js')
  const { ParserExecutionLogStoreImpl } = await import(
    '../../../storage/impl/parser-execution-log-store-impl.js'
  )
  const { ContentUnitStoreImpl } = await import('../../../storage/impl/content-unit-store-impl.js')
  const { CapabilityStoreImpl } = await import('../../../storage/impl/capability-store-impl.js')
  const { EpisodicMemoryStoreImpl } = await import('../../../storage/impl/episodic-memory-store-impl.js')
  const { SemanticMemoryStoreImpl } = await import('../../../storage/impl/semantic-memory-store-impl.js')
  const { ProceduralMemoryStoreImpl } = await import(
    '../../../storage/impl/procedural-memory-store-impl.js'
  )

  // Store instances
  const convStore = new ConversationStoreImpl(db)
  const govStore = new GovernorStoreImpl(db)
  const resStore = new CapabilityResolutionStoreImpl(db.prisma as never)
  const parserStore = new ParserStoreImpl(db)
  const parserExecLogStore = new ParserExecutionLogStoreImpl(db.prisma as never)
  const contentUnitStore = new ContentUnitStoreImpl(db.prisma as never)
  const capabilityStore = new CapabilityStoreImpl(db)
  const episodicStore = new EpisodicMemoryStoreImpl(db)
  const semanticStore = new SemanticMemoryStoreImpl(db)
  const proceduralStore = new ProceduralMemoryStoreImpl(db)

  // Engine instances
  const resolutionEngine = new CapabilityResolutionEngine(resStore)
  const sandboxRunner = new SandboxRunner(new SandboxAuditStoreImpl(db))
  const parserEngine = new StreamParserEngine(
    parserStore,
    undefined,
    sandboxRunner,
    parserExecLogStore,
  )
  const streamBlocks = new StreamBlockStore(db)

  // Prime parser cache from the generated protocol so the hot parse path does
  // ZERO DB reads. Falls back to the DB resolver chain if a module is missing.
  try {
    const { loadProviderProtocol, normalizeProtocolSource } = await import(
      '../../../engines/provider-protocol-loader.js'
    )
    const source = normalizeProtocolSource(config.providerProtocolSource)
    const { protocol } = await loadProviderProtocol(source)
    await parserEngine.primeFromProtocol(protocol)
    log.info({ source }, 'Stream parser cache primed from protocol')
  } catch (err) {
    log.warn({ err }, 'Protocol parser priming skipped')
  }

  const memoizer = new ExecutionMemoizer()
  const memoryEngine = new MemoryEngine(episodicStore, semanticStore, proceduralStore, eventBus)

  // ── Stealth store (unified) ───────────────────────────────────────────
  const { PrismaStealthStore } = await import('../../../storage/impl/stealth-store-impl.js')
  const stealthStore = new PrismaStealthStore(db.prisma as never)

  const governor = new ChromeGovernor(
    govStore,
    {
      portRange: [9300, 9400],
      healthProbeIntervalMs: 30_000,
      healthProbeTimeoutMs: 5_000,
      autoRestart: true,
      maxRestarts: 3,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs: 60_000,
      profileBaseDir: config.profileBaseDir,
    },
    undefined,
    undefined,
    undefined,
    stealthStore,
  )

  let memoryFabric: import('../../../engines/memory/memory-fabric.js').MemoryFabric | undefined
  let agentBuilder: import('../../../engines/agent-builder.js').AgentBuilderEngine | undefined

  const conversationManager = new ConversationManager(
    governor,
    resolutionEngine,
    parserEngine,
    streamBlocks,
    convStore,
    eventBus,
    memoizer,
    memoryEngine,
    undefined,
    undefined,
    new NodeStoreImpl(db.prisma as never),
    contentUnitStore,
    memoryFabric,
  )

  // Wire CDP transport, trace log, and health monitor into governor
  const { CdpTransportImpl } = await import('../../../executor/cdp-transport.js')
  const cdpTransport = new CdpTransportImpl()
  governor.setCdpTransport(cdpTransport)
  governor.setTraceLog(govStore)
  governor.setHealthMonitor(govStore)

  // Shutdown hook: disconnect CDP clients and kill Chrome instances
  onShutdown(async () => {
    await cdpTransport.disconnectAll()
    await governor.killAll()
  })

  // Boot governor (seeds accounts, starts fleet)
  await governor.boot()

  // Boot onboarding pipeline (non-blocking, attaches to service container)
  const { bootOnboardingPipeline } = await import('../../onboarding-boot.js')
  bootOnboardingPipeline(governor, db).catch((err: unknown) => {
    log.warn({ err }, 'Onboarding pipeline boot failed (non-fatal)')
  })

  ctx.convStore = convStore
  ctx.resolutionEngine = resolutionEngine
  ctx.parserEngine = parserEngine
  ctx.streamBlocks = streamBlocks
  ctx.memoryEngine = memoryEngine
  ctx.governor = governor
  ctx.conversationManager = conversationManager
  ctx.cdpTransport = cdpTransport
}
