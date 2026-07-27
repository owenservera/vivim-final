// src/framing/adapters/noop.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// A no-op adapter used for testing and as a reference implementation.
// It frames requests to an empty FramedRequest and parses responses by
// echoing the chunk as a text block. Real adapters replace this.
//
// FRAME_VERSION: 1

import type {
  FramingAdapter,
  FramedRequest,
  ParseContext,
  HealthCheckResult,
} from '../adapter.js'
import type { NormalizedRequest } from '../schemas.js'
import type { ContentPart } from '../../schema/streaming.js'

export class NoopFramingAdapter implements FramingAdapter {
  readonly providerId: string
  readonly transport = 'api' as const

  constructor(providerId = 'noop') {
    this.providerId = providerId
  }

  async frameRequest(_req: NormalizedRequest): Promise<FramedRequest> {
    return {
      apiUrl: 'https://example.invalid/noop',
      apiHeaders: { 'Content-Type': 'application/json' },
      apiBody: { ok: true },
    }
  }

  async *parseResponse(
    chunk: unknown,
    ctx: ParseContext,
  ): AsyncGenerator<ContentPart, void, unknown> {
    // Echo the chunk as a text block.
    const text =
      typeof chunk === 'string'
        ? chunk
        : JSON.stringify(chunk) ?? ''
    yield {
      type: 'text',
      text,
      state: ctx.chunkIndex === 0 ? 'streaming' : 'done',
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      providerId: this.providerId,
      healthy: true,
      checks: [{ name: 'noop', passed: true, detail: 'always healthy' }],
      checkedAt: Date.now(),
    }
  }
}
