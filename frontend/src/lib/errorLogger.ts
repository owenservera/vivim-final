// frontend/src/lib/errorLogger.ts
// Lightweight error logger that buffers errors and sends to backend when available.

import { classify, type ClassifiedError } from './errorClassifier'

interface LogEntry {
  id: string
  error: ClassifiedError
  context?: string
  timestamp: number
  url?: string
  componentStack?: string
}

const MAX_BUFFER = 50
const FLUSH_INTERVAL = 10_000

let buffer: LogEntry[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let enabled = true

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function flush() {
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)

  // Try to send to backend logger endpoint
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9420'
    fetch(`${backendUrl}/api/error-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: batch }),
      keepalive: true,
    }).catch(() => {
  // [audit] log the error with context here
      // Silent — logging should never break the app
    })
  } catch {
  // [audit] log the error with context here
    // Silent
  }
}

function startFlushTimer() {
  if (flushTimer) return
  flushTimer = setInterval(flush, FLUSH_INTERVAL)
}

export function logError(error: unknown, context?: string, componentStack?: string): ClassifiedError {
  const classified = classify(error)

  if (!enabled) return classified

  const entry: LogEntry = {
    id: genId(),
    error: classified,
    context,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    componentStack,
  }

  buffer.push(entry)
  if (buffer.length >= MAX_BUFFER) flush()

  // Console output for dev
  if (process.env.NODE_ENV !== 'production') {
    // [audit] removed: console.error(`[ErrorLogger:${classified.type}] ${context ?? 'uncaught'}`, classified.message)
  }

  startFlushTimer()
  return classified
}

export function flushErrors() {
  flush()
}

export function disableErrorLogging() {
  enabled = false
}

export function enableErrorLogging() {
  enabled = true
}
