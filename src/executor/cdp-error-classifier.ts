// src/executor/cdp-error-classifier.ts
// Classifies CDP/protocol errors into known categories so the retry engine
// can select appropriate strategies per error type.

export type CdpErrorType =
  | 'timeout'
  | 'protocol_error'
  | 'chrome_crash'
  | 'page_navigation'
  | 'dialog_blocking'
  | 'rate_limited'
  | 'unknown'

interface ErrorClassification {
  type: CdpErrorType
  message: string
}

/**
 * Classify a CDP or transport error into a known category.
 * Used by ChromeGovernor, ConversationManager, and RetryEngine
 * to determine retry strategy, circuit breaker impact, and user messaging.
 */
export function classifyCdpError(err: Error | string): ErrorClassification {
  const msg = typeof err === 'string' ? err : err.message
  const lower = msg.toLowerCase()

  // Page navigation / redirect (check before timeout since nav errors may include "timeout")
  if (
    lower.includes('navigation') ||
    lower.includes('page moved') ||
    lower.includes('frame detached') ||
    lower.includes('target destroyed')
  ) {
    return { type: 'page_navigation', message: msg }
  }

  // Timeout patterns
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('cdp command timed')
  ) {
    return { type: 'timeout', message: msg }
  }

  // Protocol / connection errors
  if (
    lower.includes('protocol error') ||
    lower.includes('cdp command failed') ||
    lower.includes('websocket') ||
    lower.includes('not connected') ||
    lower.includes('connection') ||
    lower.includes('session lost') ||
    lower.includes('re-attach failed') ||
    lower.includes('cdp client not connected')
  ) {
    return { type: 'protocol_error', message: msg }
  }

  // Chrome crash / process death
  if (
    lower.includes('chrome crashed') ||
    lower.includes('target closed') ||
    lower.includes('browser has disconnected') ||
    lower.includes('process exited') ||
    lower.includes('slave not running')
  ) {
    return { type: 'chrome_crash', message: msg }
  }

  // Dialog / modal blocking
  if (
    lower.includes('dialog') ||
    lower.includes('modal') ||
    lower.includes('alert') ||
    lower.includes('confirm') ||
    lower.includes('beforeunload')
  ) {
    return { type: 'dialog_blocking', message: msg }
  }

  // Rate limiting
  if (
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('429') ||
    lower.includes('throttle')
  ) {
    return { type: 'rate_limited', message: msg }
  }

  return { type: 'unknown', message: msg }
}

/**
 * Returns the recommended retry delay in ms for a given error type.
 */
export function retryDelayForError(type: CdpErrorType): number {
  switch (type) {
    case 'timeout':
      return 2000
    case 'protocol_error':
      return 1000
    case 'chrome_crash':
      return 5000
    case 'page_navigation':
      return 1000
    case 'dialog_blocking':
      return 500
    case 'rate_limited':
      return 10_000
    case 'unknown':
      return 2000
  }
}

/**
 * Returns true if the error type is recoverable (retryable).
 */
export function isRecoverable(type: CdpErrorType): boolean {
  return type !== 'unknown'
}
