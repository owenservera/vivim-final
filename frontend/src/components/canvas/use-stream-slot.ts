'use client'

/**
 * components/canvas/use-stream-slot.ts (V6 #1)
 * --------------------------------------------------------------------
 * Streaming-Native Nodes. A single hook that replaces useResolvedNodes
 * + manual fetches. Each node opens an NDJSON stream to
 * /api/canvas/node/:id/execute and renders events as they arrive.
 *
 * The canvas shows thinking — a node literally grows its content in
 * front of you. Latency becomes a feature.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StreamEvent, StreamSession, StreamState } from '../../shared/streaming'
import { STREAM_STATE_INDICATOR } from '../../shared/streaming'

// R3-13: Maximum events to retain in memory (backpressure cap)
const MAX_EVENTS = 500

export interface UseStreamSlotOptions {
  nodeId: string
  capabilityId: string
  input?: Record<string, unknown>
  /** Auto-start the stream on mount. */
  autoStart?: boolean
  /** Auto-reconnect on error. */
  autoReconnect?: boolean
}

export interface UseStreamSlotResult {
  session: StreamSession | null
  state: StreamState
  events: StreamEvent[]
  accumulatedText: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  traceId: string
  completedAt: number | undefined
  /** Start the stream. */
  start: () => void
  /** Pause the stream (stops reading but keeps the session). */
  pause: () => void
  /** Resume a paused stream. */
  resume: () => void
  /** Stop the stream and clear the session. */
  stop: () => void
  /** Indicator info for the current state. */
  indicator: { icon: string; color: string; label: string }
}

export function useStreamSlot(opts: UseStreamSlotOptions): UseStreamSlotResult {
  const { nodeId, capabilityId, input, autoStart = false, autoReconnect = true } = opts
  const [state, setState] = useState<StreamState>('idle')
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [accumulatedText, setAccumulatedText] = useState('')
  const [tokensIn, setTokensIn] = useState(0)
  const [tokensOut, setTokensOut] = useState(0)
  const [costUsd, setCostUsd] = useState(0)
  const [traceId, setTraceId] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [lastEventAt, setLastEventAt] = useState(0)
  const [completedAt, setCompletedAt] = useState<number | undefined>()
  const [error, setError] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const pausedRef = useRef(false)

  const start = useCallback(() => {
    if (state === 'streaming' || state === 'connecting') return
    setState('connecting')
    setEvents([])
    setAccumulatedText('')
    setTokensIn(0)
    setTokensOut(0)
    setCostUsd(0)
    setError(undefined)
    setStartedAt(Date.now())
    setCompletedAt(undefined)
    pausedRef.current = false

    const controller = new AbortController()
    abortRef.current = controller

    fetch('/api/canvas/node/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, capabilityId, input: input ?? {} }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Stream failed: ${res.status}`)
        setState('streaming')
        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')
        const decoder = new TextDecoder()
        let buffer = ''
        let eventIndex = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            if (pausedRef.current) continue
            try {
              const evt = JSON.parse(line) as StreamEvent & { traceId?: string }
              evt.index = eventIndex++
              evt.timestamp = Date.now()
              setEvents((prev) => {
                const next = [...prev, evt]
                // R3-13: Backpressure — cap event history to prevent unbounded growth
                return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
              })
              setLastEventAt(evt.timestamp)
              if (evt.traceId) setTraceId(evt.traceId)

              if (evt.kind === 'text' && evt.content) {
                setAccumulatedText((prev) => prev + evt.content)
              }
              if (evt.kind === 'thinking') {
                setState('thinking')
              }
              if (evt.kind === 'text' || evt.kind === 'code') {
                setState('streaming')
              }
              if (evt.kind === 'cost') {
                if (evt.tokensIn) setTokensIn((prev) => prev + evt.tokensIn!)
                if (evt.tokensOut) setTokensOut((prev) => prev + evt.tokensOut!)
                if (evt.costUsd) setCostUsd((prev) => prev + evt.costUsd!)
              }
              if (evt.kind === 'error') {
                setError(evt.message ?? 'Unknown error')
                setState('error')
              }
              if (evt.kind === 'complete') {
                setCompletedAt(Date.now())
                setState('complete')
              }
            } catch {
              // skip malformed line
            }
          }
        }
        if (state !== 'error') {
          setCompletedAt(Date.now())
          setState('complete')
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(String(err))
        setState('error')
        if (autoReconnect) {
          setTimeout(() => startRef.current?.(), 2000)
        }
      })
  }, [nodeId, capabilityId, input, state, autoReconnect])

  // Ref to avoid circular dependency in auto-reconnect.
  const startRef = useRef<(() => void) | null>(null)
  // eslint-disable-next-line react-hooks/immutability
  startRef.current = start

  const pause = useCallback(() => {
    pausedRef.current = true
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    setState('streaming')
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState('idle')
  }, [])

  useEffect(() => {
    if (autoStart) start()
    return () => {
      abortRef.current?.abort()
    }
  }, [autoStart, start])

  const session: StreamSession | null =
    state === 'idle' && !startedAt
      ? null
      : {
          id: `stream:${nodeId}`,
          nodeId,
          capabilityId,
          state,
          events,
          accumulatedText,
          tokensIn,
          tokensOut,
          costUsd,
          startedAt: startedAt || Date.now(),
          lastEventAt,
          completedAt,
          error,
          traceId,
        }

  return {
    session,
    state,
    events,
    accumulatedText,
    tokensIn,
    tokensOut,
    costUsd,
    traceId,
    completedAt,
    start,
    pause,
    resume,
    stop,
    indicator: STREAM_STATE_INDICATOR[state],
  }
}
