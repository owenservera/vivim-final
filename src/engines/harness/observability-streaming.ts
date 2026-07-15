// src/engines/harness/observability-streaming.ts
// Unit 25.3 - Observability streaming (cap-store fine-grained blocks on the bus).
// Asserts that harness execution emits granular stream events on the
// CapabilityEventBus (complementing the coarse capability:executed) and persists
// them to StreamBlockStore. The HarnessExecutorEngine already does this via its
// sink; this module is the documented, reusable wiring + a typed helper.

import type { StreamBlockStoreContract } from '../../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { HubStreamBlock } from './harness-contract.js'

export interface HarnessObservabilityDeps {
  eventBus: CapabilityEventBus
  blockStore: StreamBlockStoreContract
}

/** Emit a granular stream block event (mirrors cap-store WS block frames). */
export function emitStreamBlock(deps: HarnessObservabilityDeps, block: HubStreamBlock): void {
  deps.eventBus.emit({ type: 'capability:streamBlock', ...block } as never)
}

/** Emit the terminal stream-done event for a harness execution. */
export function emitStreamDone(
  deps: HarnessObservabilityDeps,
  done: { ok: boolean; bindingId?: string; programId?: string; error?: string },
): void {
  deps.eventBus.emit({ type: 'capability:streamDone', ...done } as never)
}
