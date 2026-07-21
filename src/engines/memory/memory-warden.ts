// src/engines/memory/memory-warden.ts
// MemoryWarden - per-agent write-gating + quota + provenance (was "Governor").
// Renamed from MemoryGovernor to avoid the Governor Canon collision with
// ChromeGovernor (audit decision D0).
//
// Enforces: execution-context skip (non-primary), StreamingContextScrubber on
// streamed context, provenance metadata on every write, per-agent write quota.

import { MemoryWardenQuotaError } from '../../errors.js'
import type { MemoryWriteMetadata } from './memory-backend.js'
import { sanitizeContext } from './streaming-context-scrubber.js'

export interface MemoryWardenDeps {
  /** Default per-agent write quota (0 = unlimited). */
  writeQuota?: number
  /** Mirror a belief into the belief store (optional). */
  mirrorToBelief?: (spec: {
    ownerKind: 'agent'
    ownerId: string
    topic: string
    claim: string
    confidence?: number
  }) => Promise<void>
}

export class MemoryWarden {
  private used = 0
  private readonly quota: number

  constructor(
    private readonly agentId: string,
    private readonly deps: MemoryWardenDeps = {},
  ) {
    this.quota = deps.writeQuota ?? 0
  }

  /**
   * Gate a memory write. Returns the (possibly scrubbed) content to persist,
   * or null to skip the write (e.g. non-primary execution context).
   */
  gateWrite(
    content: string,
    ctx: { agentContext: 'primary' | 'subagent' | 'cron' | 'flush' },
    _metadata?: MemoryWriteMetadata,
  ): string | null {
    if (ctx.agentContext !== 'primary') {
      // Sub-agents / cron / flush must not mutate the primary agent's memory.
      return null
    }
    this.checkQuota()
    const scrubbed = sanitizeContext(content)
    return scrubbed
  }

  /** Scrub streamed context delta (D5). */
  scrubStreaming(delta: string): string {
    return sanitizeContext(delta)
  }

  /** Build provenance metadata for a memory write (D7). */
  buildProvenance(
    _target: string,
    content: string,
    metadata?: MemoryWriteMetadata,
  ): MemoryWriteMetadata {
    return {
      ...metadata,
      writeOrigin: 'memory-warden',
      executionContext: 'primary',
      sessionId: metadata?.sessionId,
      platform: metadata?.platform,
      toolName: metadata?.toolName,
      oldText: metadata?.oldText,
      agentId: this.agentId,
      contentHash: this.hash(content),
      ts: Date.now(),
    }
  }

  private checkQuota(): void {
    if (this.quota > 0 && this.used >= this.quota) {
      throw new MemoryWardenQuotaError(this.agentId, this.used, this.quota)
    }
    this.used++
  }

  async mirrorToBelief(topic: string, claim: string, confidence = 0.5): Promise<void> {
    if (!this.deps.mirrorToBelief) return
    await this.deps.mirrorToBelief({
      ownerKind: 'agent',
      ownerId: this.agentId,
      topic,
      claim,
      confidence,
    })
  }

  resetQuota(): void {
    this.used = 0
  }

  private hash(s: string): string {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0
    }
    return `h${h.toString(16)}`
  }
}
