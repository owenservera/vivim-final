/**
 * @module engines/parsers/sse-parser
 *
 * Generic SSE (Server-Sent Events) frame parser.
 * Provider-agnostic: parses raw SSE streams into typed frames.
 *
 * @example
 * ```ts
 * const parser = createSSEParser();
 * const frames = parser.feed('event: message\ndata: {"text": "hello"}\n\n');
 * // → [{ type: 'event', value: '{"text": "hello"}', eventType: 'message' }]
 * ```
 */

// ── Types ────────────────────────────────────────────────────────

export interface SSEFrame {
  /** Whether this frame came from a named event or bare data. */
  type: 'event' | 'data'
  /** The payload data string. */
  value: string
  /** Event type from `event:` lines (undefined for bare data frames). */
  eventType?: string
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create a stateful SSE parser that accumulates partial chunks.
 *
 * Buffers incomplete lines between calls. Each `feed()` returns
 * zero or more complete frames (separated by blank lines in the stream).
 *
 * Thread-safety: not thread-safe; use one parser per stream.
 */
export function createSSEParser(): { feed(chunk: string): SSEFrame[] } {
  let buffer = ''

  return {
    feed(chunk: string): SSEFrame[] {
      buffer += chunk
      const frames: SSEFrame[] = []
      const lines = buffer.split('\n')
      // The last element may be incomplete — keep it in the buffer.
      buffer = lines.pop() ?? ''

      let currentData = ''
      let currentEvent = ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          currentData += (currentData ? '\n' : '') + line.slice(5).trim()
        } else if (line.trim() === '') {
          // Blank line = end of event
          if (currentData || currentEvent) {
            frames.push({
              type: currentEvent ? 'event' : 'data',
              value: currentData,
              eventType: currentEvent || undefined,
            })
            currentData = ''
            currentEvent = ''
          }
        }
        // Comments (lines starting with ':') and other lines are silently ignored.
      }

      return frames
    },
  }
}
