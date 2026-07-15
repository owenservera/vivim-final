// src/engines/harness/stream-capture-reconstruct.ts
// Unit 23.3 - Stream capture + reconstruction.
// Appends normalized content blocks to StreamBlockStore and notifies the sink.
// This is the cap-store "reconstruct fine-grained blocks from a captured body"
// step, vivim-styled.

import type { StreamBlockStoreContract } from '../../storage/contracts/stream-block-store.js'
import { reconstructCapture } from './content-pipeline-adapter.js'
import type { HarnessSink } from './harness-contract.js'

export interface CaptureTarget {
  conversationId: string
  messageId: string
  bindingId: string
}

/** Reconstruct blocks from a captured body and persist + emit them. */
export async function captureAndStore(
  raw: string | undefined,
  target: CaptureTarget,
  blockStore: StreamBlockStoreContract,
  sink: HarnessSink,
  startSequence: number,
): Promise<number> {
  const blocks = reconstructCapture(raw)
  if (blocks.length === 0) return startSequence

  await blockStore.storeBlocks(
    target.conversationId,
    target.messageId,
    blocks.map((b, i) => ({
      kind: b.blockKind === 'code' ? 'code' : 'text',
      content: b.blockData,
      index: startSequence + i,
    })),
  )

  blocks.forEach((b, i) => {
    sink.onBlock({
      bindingId: target.bindingId,
      messageId: target.messageId,
      sequence: startSequence + i,
      blockKind: b.blockKind,
      blockData: b.blockData,
    })
  })

  return startSequence + blocks.length
}
