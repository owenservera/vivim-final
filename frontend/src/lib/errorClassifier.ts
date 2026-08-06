// frontend/src/lib/errorClassifier.ts
// Classifies errors by type (network/auth/validation/logic) for appropriate UI treatment.
// P1-3: Now uses backend error codes instead of string pattern matching when available.

export type ErrorType = 'network' | 'auth' | 'validation' | 'logic' | 'unknown'

export interface ClassifiedError {
  type: ErrorType
  title: string
  message: string
  retryable: boolean
  originalError: unknown
}

/** Canonical mapping from backend ErrorCode to ErrorType */
const CODE_TO_TYPE: Record<string, ErrorType> = {
  NotFound: 'validation',
  ValidationError: 'validation',
  Conflict: 'validation',
  PayloadTooLarge: 'validation',
  AuthError: 'auth',
  Forbidden: 'auth',
  NotAvailable: 'network',
  TimeoutError: 'network',
  RateLimited: 'network',
  InternalError: 'logic',
  ExecutionError: 'logic',
  NotImplemented: 'logic',
}

/** Status codes that map to each error type */
const STATUS_TO_TYPE: Partial<Record<number, ErrorType>> = {
  401: 'auth',
  403: 'auth',
  400: 'validation',
  409: 'validation',
  422: 'validation',
  404: 'validation',
  408: 'network',
  429: 'network',
  500: 'logic',
  502: 'network',
  503: 'network',
  504: 'network',
}

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /network request failed/i,
  /networkerror/i,
  /econnrefused/i,
  /econnreset/i,
  /enotfound/i,
  /load failed/i,
]

function classifyByCode(code: string | undefined): ErrorType | null {
  if (!code) return null
  return CODE_TO_TYPE[code] ?? null
}

function classifyByStatus(status: number | undefined): ErrorType | null {
  if (!status) return null
  return STATUS_TO_TYPE[status] ?? null
}

function classifyByMessage(error: unknown): ErrorType | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (NETWORK_PATTERNS.some((p) => p.test(msg))) return 'network'
  if (/unauthorized|forbidden|invalid.*token|token.*expired|session.*expired/i.test(msg))
    return 'auth'
  if (/validation.*error|invalid.*request|bad.*request|unprocessable|conflict/i.test(msg))
    return 'validation'
  return null
}

function classifyError(error: unknown, code?: string): ErrorType {
  // Priority: backend code > HTTP status > message patterns > fallback
  return (
    classifyByCode(code) ??
    classifyByStatus(
      error && typeof error === 'object'
        ? (((error as Record<string, unknown>).status ??
            (error as Record<string, unknown>).statusCode) as number | undefined)
        : undefined,
    ) ??
    classifyByMessage(error) ??
    'logic'
  )
}

const ERROR_TITLES: Record<ErrorType, string> = {
  network: 'Connection Error',
  auth: 'Authentication Error',
  validation: 'Validation Error',
  logic: 'Error',
  unknown: 'Error',
}

function isRetryable(type: ErrorType, code?: string): boolean {
  if (type === 'network') return true
  if (code === 'TimeoutError' || code === 'NotAvailable' || code === 'RateLimited') return true
  return false
}

export function classify(error: unknown, code?: string): ClassifiedError {
  const type = classifyError(error, code)
  const msg = error instanceof Error ? error.message : String(error)

  return {
    type,
    title: ERROR_TITLES[type],
    message: msg,
    retryable: isRetryable(type, code),
    originalError: error,
  }
}
