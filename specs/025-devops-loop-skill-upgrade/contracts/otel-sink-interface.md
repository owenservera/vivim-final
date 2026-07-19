# Contract: OtelSink (FR-009)

**Module**: `src/engines/otel-sink.ts`

**Interface**:
```ts
import type { CapabilityEventBus } from '@/engines/capability-event-bus.js'

export interface OtelSpanInput {
  engine: string
  method: string
  durationMs: number
  ok: boolean
  attributes?: Record<string, unknown>
}

export class OtelSink {
  constructor(bus: CapabilityEventBus, opts?: { endpoint?: string })
  start(): void   // subscribes to trace_entry events
  stop(): void    // unsubscribes
}
```

**Behavior**:
- On `trace_entry` event, map to OTel span with gen_ai semantics:
  - `gen_ai.request.model` ← attributes.model
  - `gen_ai.usage.prompt_tokens` ← attributes.promptTokens
  - `gen_ai.usage.completion_tokens` ← attributes.completionTokens
  - `gen_ai.response.cost_usd` ← attributes.costUsd
- Export via OTLP HTTP if `endpoint` set; no-op otherwise.
- Never throws into the event bus (errors swallowed + logged).

**Constitution**: Subscribes to CapabilityEventBus (cross-cutting layer), no CDP.
