// src/engines/memory/streaming-context-scrubber.ts
// StreamingContextScrubber - drop <memory-context> spans from streamed model
// deltas so an agent never sees its own injected memory echoed back (decision D5).
//
// Hermes port: MemoryManager._scrub_streaming_context (memory_manager.py).
// Holds partial open/close tag tails across deltas (tags may be split).

const OPEN = '<memory-context>'
const CLOSE = '</memory-context>'

export class StreamingContextScrubber {
  private buffer = ''
  private inSpan = false

  /** Feed a streaming delta; returns the scrubbed remainder. */
  feed(delta: string): string {
    this.buffer += delta
    let out = ''
    let i = 0
    while (i < this.buffer.length) {
      if (!this.inSpan) {
        const openIdx = this.buffer.indexOf(OPEN, i)
        if (openIdx === -1) {
          // no open tag; safe to emit everything except a possible partial open tail
          const tail = this.tailPartialOpen(this.buffer, i)
          out += this.buffer.slice(i, tail.start)
          this.buffer = this.buffer.slice(tail.start)
          return out
        }
        out += this.buffer.slice(i, openIdx)
        this.inSpan = true
        i = openIdx + OPEN.length
      } else {
        const closeIdx = this.buffer.indexOf(CLOSE, i)
        if (closeIdx === -1) {
          // span open, no close yet; hold (could be split). Emit nothing.
          this.buffer = this.buffer.slice(i)
          return out
        }
        // drop span content; resume after close
        this.inSpan = false
        i = closeIdx + CLOSE.length
      }
    }
    this.buffer = ''
    return out
  }

  private tailPartialOpen(s: string, from: number): { start: number } {
    // detect a trailing substring that is a prefix of OPEN
    const max = Math.min(s.length, from + OPEN.length - 1)
    for (let end = s.length; end > from; end--) {
      const piece = s.slice(from, end)
      if (OPEN.startsWith(piece)) return { start: from }
    }
    void max
    return { start: s.length }
  }

  /** Discard any unterminated span; emit held non-tag tail. */
  flush(): string {
    const remainder = this.inSpan ? '' : this.buffer
    this.buffer = ''
    this.inSpan = false
    return remainder
  }
}

/** One-shot sanitize for non-streaming context blocks. */
export function sanitizeContext(text: string): string {
  const scrubber = new StreamingContextScrubber()
  return scrubber.feed(text) + scrubber.flush()
}
