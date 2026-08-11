// frontend/src/types/shared/index.ts
// Barrel export for all shared type modules.

export * from './api-contract'
export * from './domain'
export { type ErrorCode, getUserMessage, isRetryable, ERROR_MESSAGES } from './errors'
export type { ApiErrorResponse as ServerApiErrorResponse } from './errors'
export * from './ws-events'
