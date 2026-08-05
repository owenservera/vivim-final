// src/server/errors.ts
// Canonical error classes for standardized error handling across all routers.
// Each error carries a machine-readable code, human-readable message, HTTP status,
// and optional details. Routers throw these; the top-level catch in each router
// converts them to errorResponse() calls.

// ── Error code taxonomy ──────────────────────────────────────────────────────
// Standardized codes the frontend can switch on. Keep this enum in sync with
// frontend/src/types/shared/errors.ts

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
  | 'MethodNotAllowed'
  | 'ServiceUnavailable'
  | 'Locked'
  | 'NotSupported'

// ── AppError base class ──────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** Convenience factory methods */
  static notFound(message: string, details?: unknown): AppError {
    return new AppError(message, 'NotFound', 404, details)
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, 'ValidationError', 400, details)
  }

  static execution(message: string, details?: unknown): AppError {
    return new AppError(message, 'ExecutionError', 500, details)
  }

  static internal(message: string, details?: unknown): AppError {
    return new AppError(message, 'InternalError', 500, details)
  }

  static unavailable(message: string, details?: unknown): AppError {
    return new AppError(message, 'NotAvailable', 503, details)
  }

  static timeout(message: string, details?: unknown): AppError {
    return new AppError(message, 'TimeoutError', 504, details)
  }

  static auth(message: string, details?: unknown): AppError {
    return new AppError(message, 'AuthError', 401, details)
  }

  static forbidden(message: string, details?: unknown): AppError {
    return new AppError(message, 'Forbidden', 403, details)
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 'Conflict', 409, details)
  }

  static rateLimited(message: string, details?: unknown): AppError {
    return new AppError(message, 'RateLimited', 429, details)
  }

  static locked(message: string, details?: unknown): AppError {
    return new AppError(message, 'Locked', 423, details)
  }

  /** Convert any caught value into an AppError. */
  static from(err: unknown, fallbackCode: ErrorCode = 'InternalError'): AppError {
    if (err instanceof AppError) return err
    const message = err instanceof Error ? err.message : String(err)
    return new AppError(message, fallbackCode, 500)
  }
}

// ── Error response shape (serialized) ────────────────────────────────────────
// This is the JSON shape returned to the frontend for all error responses.

export interface ErrorResponse {
  error: string
  code: ErrorCode
  details?: unknown
}
