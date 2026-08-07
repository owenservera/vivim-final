// src/engines/protocol-loop-parser.ts
// ProtocolLoopParser — loop-mode streaming parse for autonomous agent workflows.
// Processes protocol frames from stdin/buffer and emits typed events.

import { catchDebug } from '../lib/catch-logger.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface ProtocolFrame {
  id: string
  type: string
  payload: unknown
  timestamp: number
}

export interface LoopState {
  running: boolean
  cycleCount: number
  lastFrame?: ProtocolFrame
  error?: string
}

// ── ProtocolLoopParser ──────────────────────────────────────────────────

export class ProtocolLoopParser {
  private state: LoopState = { running: false, cycleCount: 0 }
  private frameBuffer: string[] = []
  private bufferPosition = 0

  constructor(
    private readonly eventBus: CapabilityEventBus,
    private readonly registry?: UnifiedCapabilityRegistry,
  ) {}

  // Process a stream of protocol frames
  async processStream(input: AsyncIterable<string> | string): Promise<void> {
    if (typeof input === 'string') {
      this.processString(input)
      return
    }

    for await (const chunk of input) {
      this.processString(chunk)
    }
  }

  // Process a string buffer for protocol frames
  private processString(buffer: string): void {
    const lines = buffer.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const frame = JSON.parse(line) as ProtocolFrame
        this.emitFrame(frame)
      } catch {
        catchDebug(_err, 'engines:protocol-loop-parser:56')
        // Not a valid JSON frame — ignore
      }
    }
  }

  // Emit a parsed frame to the event bus
  private emitFrame(frame: ProtocolFrame): void {
    this.state.cycleCount++
    this.state.lastFrame = frame

    // Emit as capability:* event
    this.eventBus.emit({
      type: `capability:${frame.type}`,
      frameId: frame.id,
      payload: frame.payload,
      timestamp: frame.timestamp,
    })

    // If registry provided, also check for matching capability
    if (this.registry) {
      const capability = this.registry.get(frame.type)
      if (capability) {
        this.eventBus.emit({
          type: 'capability:executed',
          capabilityId: frame.type,
          frameId: frame.id,
          ok: true,
        })
      }
    }
  }

  // Get current loop state
  getState(): LoopState {
    return { ...this.state }
  }

  // Reset state (for next loop)
  reset(): void {
    this.state = { running: false, cycleCount: 0 }
    this.frameBuffer = []
  }

  // Parse a single frame from a string
  parseFrame(line: string): ProtocolFrame | null {
    try {
      const parsed = JSON.parse(line) as ProtocolFrame
      if (parsed.id && parsed.type && parsed.payload !== undefined) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }
}
