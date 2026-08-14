// src/engines/code-audit/stream.ts
// Real-time feedback surface. Two transport shapes:
//   1. In-process callbacks (AuditStreamCallbacks) for embedding the engine in
//      a live CLI/agent loop.
//   2. NDJSON file sink for tailing/piping into other tooling.
// Also provides the CapabilityEventBus mirror helper (the event bus itself is
// created by the orchestrator; this module stays transport-agnostic).

import { closeSync, openSync, writeSync } from 'node:fs'
import type {
  AuditPhase,
  AuditStreamCallbacks,
  Finding,
  PhaseResult,
  StreamEvent,
} from './types.js'

export class NdjsonWriter {
  private fd: number
  constructor(path: string) {
    this.fd = openSync(path, 'w')
  }
  write(event: StreamEvent): void {
    writeSync(this.fd, `${JSON.stringify(event)}\n`)
  }
  close(): void {
    try {
      closeSync(this.fd)
    } catch {
      // [audit] log the error with context here
      /* already closed */
    }
  }
}

export function emitEvent(cb: AuditStreamCallbacks | undefined, event: StreamEvent): void {
  if (!cb) return
  switch (event.type) {
    case 'phase:start':
      cb.onPhase?.(event.phase, {
        phase: event.phase,
        status: 'COMPLETED',
        durationMs: 0,
        findingsCount: 0,
      })
      break
    case 'phase:end':
      cb.onPhase?.(event.phase, {
        phase: event.phase,
        status: event.status,
        durationMs: event.durationMs,
        findingsCount: event.findingsCount,
      })
      break
    case 'finding':
      cb.onFinding?.(event.finding)
      break
    case 'tick':
      cb.onTick?.({
        elapsedMs: event.elapsedMs,
        filesScanned: event.filesScanned,
        findingsSoFar: event.findingsSoFar,
      })
      break
    default:
      break
  }
  cb.onProgress?.(event)
}

export type BusEmitter = (event: StreamEvent) => void

export interface StreamSink {
  emit(event: StreamEvent): void
  close(): void
}

/** Compose callbacks + optional NDJSON sink + optional bus mirror into one. */
export function composeSink(
  callbacks: AuditStreamCallbacks | undefined,
  ndjson?: NdjsonWriter,
  bus?: BusEmitter,
): StreamSink {
  return {
    emit(event: StreamEvent) {
      emitEvent(callbacks, event)
      ndjson?.write(event)
      bus?.(event)
    },
    close() {
      ndjson?.close()
    },
  }
}

export function phaseEvent(phase: AuditPhase): { start: StreamEvent; end: StreamEvent } {
  const ts = new Date().toISOString()
  return {
    start: { type: 'phase:start', phase, ts },
    end: { type: 'phase:end', phase, status: 'COMPLETED', durationMs: 0, findingsCount: 0, ts },
  }
}

export function resultToEvent(phase: AuditPhase, result: PhaseResult): StreamEvent {
  return {
    type: 'phase:end',
    phase,
    status: result.status,
    durationMs: result.durationMs,
    findingsCount: result.findingsCount,
    ts: new Date().toISOString(),
  }
}

export function findingEvent(finding: Finding): StreamEvent {
  return { type: 'finding', finding, ts: new Date().toISOString() }
}
