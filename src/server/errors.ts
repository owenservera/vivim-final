// src/server/errors.ts
// Canonical error classes for standardized error handling across all routers.
// Each error carries a machine-readable code, human-readable message, HTTP status,
// and optional details. Routers throw these; the top-level catch in each router
// converts them to errorResponse() calls.
//
// Session 3 (2026-08-07): Added JSDoc to every public export — the error
// contract is the API surface that frontend code switches on, so it must be
// discoverable via IDE hover.

// ── Error code taxonomy ──────────────────────────────────────────────────────
// Standardized codes the frontend can switch on. Keep this enum in sync with
// frontend/src/types/shared/errors.ts
//
// Each code maps to a specific HTTP status (see AppError factory methods
// below for the canonical mapping). Frontend code should switch on `code`,
// not on HTTP status, because multiple codes can map to the same status.

/**
 * Machine-readable error code. Frontend code switches on this value to
 * determine how to handle an error response.
 *
 * @see {@link AppError} for the factory methods that map each code to an HTTP status.
 */
export type ErrorCode =
  /** Service is not yet booted or a required engine is offline. Maps to HTTP 503. */
  | 'NotAvailable'
  /** Resource does not exist. Maps to HTTP 404. */
  | 'NotFound'
  /** Request body or params failed validation. Maps to HTTP 400. */
  | 'ValidationError'
  /** Capability execution failed. Maps to HTTP 500. */
  | 'ExecutionError'
  /** Unexpected internal failure. Maps to HTTP 500. */
  | 'InternalError'
  /** Operation exceeded its time budget. Maps to HTTP 504. */
  | 'TimeoutError'
  /** Authentication required or token invalid. Maps to HTTP 401. */
  | 'AuthError'
  /** Authenticated user lacks permission. Maps to HTTP 403. */
  | 'Forbidden'
  /** Resource already exists or state conflict. Maps to HTTP 409. */
  | 'Conflict'
  /** Rate limit exceeded. Maps to HTTP 429. */
  | 'RateLimited'
  /** Request body too large. Maps to HTTP 413. */
  | 'PayloadTooLarge'
  /** Endpoint exists but is not yet implemented. Maps to HTTP 501. */
  | 'NotImplemented'
  /** HTTP method not allowed on this endpoint. Maps to HTTP 405. */
  | 'MethodNotAllowed'
  /** Service temporarily unavailable (e.g. maintenance). Maps to HTTP 503. */
  | 'ServiceUnavailable'
  /** Resource is locked by another operation. Maps to HTTP 423. */
  | 'Locked'
  /** Operation is not supported on this resource/provider. Maps to HTTP 400. */
  | 'NotSupported'

// ── AppError base class ──────────────────────────────────────────────────────

/**
 * The canonical server-side error class. Routers throw `AppError` (or a
 * subclass); the top-level catch converts it to an HTTP response via
 * {@link appErrorResponse}.
 *
 * @example
 *   throw AppError.notFound(`Conversation ${id} not found`)
 *   throw AppError.validation('accountId is required')
 *   throw new AppError('Custom message', 'Conflict', 409, { resourceId })
 */
export class AppError extends Error {
  /**
   * @param message    Human-readable error message (shown to the user).
   * @param code       Machine-readable {@link ErrorCode} (frontend switches on this).
   * @param status     HTTP status code to return.
   * @param details    Optional structured details (e.g. zod validation issues).
   */
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** Factory for HTTP 404 `NotFound` errors. */
  static notFound(message: string, details?: unknown): AppError {
    return new AppError(message, 'NotFound', 404, details)
  }

  /** Factory for HTTP 400 `ValidationError` errors. */
  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, 'ValidationError', 400, details)
  }

  /** Factory for HTTP 500 `ExecutionError` errors. */
  static execution(message: string, details?: unknown): AppError {
    return new AppError(message, 'ExecutionError', 500, details)
  }

  /** Factory for HTTP 500 `InternalError` errors. */
  static internal(message: string, details?: unknown): AppError {
    return new AppError(message, 'InternalError', 500, details)
  }

  /** Factory for HTTP 503 `NotAvailable` errors. */
  static unavailable(message: string, details?: unknown): AppError {
    return new AppError(message, 'NotAvailable', 503, details)
  }

  /** Factory for HTTP 504 `TimeoutError` errors. */
  static timeout(message: string, details?: unknown): AppError {
    return new AppError(message, 'TimeoutError', 504, details)
  }

  /** Factory for HTTP 401 `AuthError` errors. */
  static auth(message: string, details?: unknown): AppError {
    return new AppError(message, 'AuthError', 401, details)
  }

  /** Factory for HTTP 403 `Forbidden` errors. */
  static forbidden(message: string, details?: unknown): AppError {
    return new AppError(message, 'Forbidden', 403, details)
  }

  /** Factory for HTTP 409 `Conflict` errors. */
  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 'Conflict', 409, details)
  }

  /** Factory for HTTP 429 `RateLimited` errors. */
  static rateLimited(message: string, details?: unknown): AppError {
    return new AppError(message, 'RateLimited', 429, details)
  }

  /** Factory for HTTP 423 `Locked` errors. */
  static locked(message: string, details?: unknown): AppError {
    return new AppError(message, 'Locked', 423, details)
  }

  /**
   * Convert any caught value into an `AppError`. If the value is already an
   * `AppError`, it is returned as-is. Otherwise a new `AppError` is created
   * with the fallback code (default `InternalError`).
   *
   * @param err           The caught value (Error, AppError, string, or unknown).
   * @param fallbackCode  The code to use if `err` is not an `AppError`.
   */
  static from(err: unknown, fallbackCode: ErrorCode = 'InternalError'): AppError {
    if (err instanceof AppError) return err
    const message = err instanceof Error ? err.message : String(err)
    return new AppError(message, fallbackCode, 500)
  }
}

// ── Error response shape (serialized) ────────────────────────────────────────
// This is the JSON shape returned to the frontend for all error responses.

/**
 * The serialized error response shape. Every error response from the server
 * follows this contract — frontend code can rely on `error` and `code` being
 * present on every non-2xx response.
 *
 * @property error    Human-readable message (safe to display to users).
 * @property code     Machine-readable {@link ErrorCode} (switch on this).
 * @property details  Optional structured details — e.g. zod validation issues,
 *                    a list of conflicting resource IDs, or retry-after hints.
 *                    Omitted when there are no structured details.
 */
export interface ErrorResponse {
  error: string
  code: ErrorCode
  details?: unknown
}
