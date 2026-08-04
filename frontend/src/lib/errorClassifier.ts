// frontend/src/lib/errorClassifier.ts
// Classifies errors by type (network/auth/validation/logic) for appropriate UI treatment.

export type ErrorType = 'network' | 'auth' | 'validation' | 'logic' | 'unknown'

export interface ClassifiedError {
  type: ErrorType
  title: string
  message: string
  retryable: boolean
  originalError: unknown
}

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /network request failed/i,
  /networkerror/i,
  /econnrefused/i,
  /econnreset/i,
  /enotfound/i,
  /timeout/i,
  /aborted/i,
  /load failed/i,
]

const AUTH_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /unauthorized/i,
  /forbidden/i,
  /invalid.*token/i,
  /token.*expired/i,
  /session.*expired/i,
  /not.*authenticated/i,
]

const VALIDATION_PATTERNS = [
  /\b400\b/,
  /\b422\b/,
  /\b409\b/,
  /validation.*error/i,
  /invalid.*request/i,
  /bad.*request/i,
  /unprocessable/i,
  /conflict/i,
]

function classifyError(error: unknown): ErrorType {
  const msg = error instanceof Error ? error.message : String(error)

  if (NETWORK_PATTERNS.some((p) => p.test(msg))) return 'network'
  if (AUTH_PATTERNS.some((p) => p.test(msg))) return 'auth'
  if (VALIDATION_PATTERNS.some((p) => p.test(msg))) return 'validation'

  // Check for HTTP status codes in error objects
  if (error && typeof error === 'object') {
    const status = (error as Record<string, unknown>).status ?? (error as Record<string, unknown>).statusCode
    if (typeof status === 'number') {
      if (status === 401 || status === 403) return 'auth'
      if (status === 400 || status === 422 || status === 409) return 'validation'
    }
  }

  return 'logic'
}

const ERROR_TITLES: Record<ErrorType, string> = {
  network: 'Connection Error',
  auth: 'Authentication Error',
  validation: 'Validation Error',
  logic: 'Error',
  unknown: 'Error',
}

function isRetryable(type: ErrorType): boolean {
  return type === 'network'
}

export function classify(error: unknown): ClassifiedError {
  const type = classifyError(error)
  const msg = error instanceof Error ? error.message : String(error)

  return {
    type,
    title: ERROR_TITLES[type],
    message: msg,
    retryable: isRetryable(type),
    originalError: error,
  }
}
