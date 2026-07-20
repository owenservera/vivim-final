// src/engines/harness/harness-contract.ts
// Unit 21.1 - Harness executor contract (DI seam).
// Mirrors cap-store's "program -> recipe -> CDP injector" boundary, but the
// actual CDP injection happens ONLY in ChromeGovernor (Governor Canon). This
// file defines the contract the rest of v14 depends on, so engines never reach
// past the governor.

import type { CapabilityStore } from '../../storage/contracts/capability-store.js'
import type { ProgramStore } from '../../storage/contracts/program-store.js'
import type { StreamBlockStoreContract } from '../../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { StreamParserEngine } from '../stream-parser.js'

/** What the governor needs to find the right slave for a (provider,account). */
export interface SlaveResolver {
  resolve(providerId: string, accountId: string): Promise<string | null>
}

/** Per-step / per-execution sink so the kernel/oracle gets cap-store-style blocks. */
export interface HarnessSink {
  onBlock(block: HubStreamBlock): void
  onDone(result: HarnessExecutionResult): void
  onError(error: unknown): void
}

export interface HubStreamBlock {
  bindingId: string
  messageId: string
  sequence: number
  /** ContentBlock kind (text/code/error/...). */
  blockKind: string
  blockData: unknown
}

/** Everything the HarnessExecutor needs — injected, never constructed inside. */
export interface HarnessExecutorDeps {
  governor: ChromeGovernor
  /** Program resolution (recipe source of truth) — Store Contracts boundary. */
  programStore: ProgramStore
  /** Outcome/telemetry sink only (createOutcome); program lookup lives on programStore. */
  store: CapabilityStore
  blockStore: StreamBlockStoreContract
  eventBus: CapabilityEventBus
  slaveResolver: SlaveResolver
  /** Provider-aware stream parser for reconstructing captured bodies into ContentBlocks. */
  parser: StreamParserEngine
  /** Default timeout for a full recipe execution, ms. */
  defaultTimeoutMs?: number
}

export interface HarnessExecutionRequest {
  capabilitySlug: string
  providerId: string
  accountId: string
  bindingId?: string
  programId?: string
  input: Record<string, unknown>
  conversationId?: string
  messageId?: string
}

export interface HarnessExecutionResult {
  ok: boolean
  bindingId?: string
  programId?: string
  slaveId?: string
  stepsCompleted: number
  captured?: unknown
  error?: string
  durationMs: number
}

export interface HarnessExecutor {
  execute(req: HarnessExecutionRequest): Promise<HarnessExecutionResult>
}
