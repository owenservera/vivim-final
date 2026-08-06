// frontend/src/types/shared/errors.ts
// Canonical error types mirroring src/server/errors.ts on the backend.
// These define the error contract between frontend and backend.
//
// Work Item 03: Error handling standardization.
// Status: ACTIVE — utility functions used by errorClassifier and UI error displays.

/** Machine-readable error codes returned by the backend. */
export type ErrorCode =
  | 'NotAvailable'
  | 'NotFound'
  | 'ValidationError'
  | 'ExecutionError'
  | 'InternalError'
  | 'TimeoutError'
  | 'AuthError'
  | 'Forbidden'
  | 'Conflict'
  | 'RateLimited'
  | 'PayloadTooLarge'
  | 'NotImplemented'

/** Standardized error response shape from the backend. */
export interface ApiErrorResponse {
  error: string
  code: ErrorCode
  details?: unknown
}

/** User-friendly messages for common error codes. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NotAvailable: 'Service is temporarily unavailable. Please try again later.',
  NotFound: 'The requested resource was not found.',
  ValidationError: 'The request contains invalid data. Please check and try again.',
  ExecutionError: 'An error occurred while processing your request.',
  InternalError: 'An unexpected error occurred. Please try again.',
  TimeoutError: 'The request timed out. Please try again.',
  AuthError: 'Authentication required. Please sign in.',
  Forbidden: 'You do not have permission to perform this action.',
  Conflict: 'There is a conflict with the current state. Please refresh.',
  RateLimited: 'Too many requests. Please wait a moment and try again.',
  PayloadTooLarge: 'The request data is too large.',
  NotImplemented: 'This feature is not yet implemented.',
}

/**
 * Get a user-friendly error message for a backend error code.
 * Falls back to the raw error string if the code is unknown.
 */
export function getUserMessage(
  error: ApiErrorResponse | { error?: string; code?: string },
): string {
  const code = error.code as ErrorCode | undefined
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code]
  }
  return error.error ?? 'An unknown error occurred.'
}

/** HTTP status codes that are safe to retry. */
export const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

/**
 * Determine if an error is transient and worth retrying.
 */
export function isRetryable(status: number, code?: string): boolean {
  if (RETRYABLE_STATUS_CODES.has(status)) return true
  if (code === 'TimeoutError' || code === 'NotAvailable' || code === 'RateLimited') return true
  return false
}
