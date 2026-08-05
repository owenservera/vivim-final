// src/lib/catch-logger.ts
// Normalized error logging for catch blocks.
// Replaces silent `catch { }` with observable error handling.

import { getLogger } from './logger.js'

const log = getLogger('catch')

/**
 * Log a caught error at debug level (intentional best-effort).
 * Use when the catch is expected and the pipeline continues.
 */
export function catchDebug(err: unknown, ctx: string): void {
  log.debug({ err }, ctx)
}

/**
 * Log a caught error at warn level (unexpected but non-fatal).
 * Use when the catch masks a real error that should be investigated.
 */
export function catchWarn(err: unknown, ctx: string): void {
  log.warn({ err }, ctx)
}

/**
 * Returns an inline catch handler that logs at debug level.
 * Usage: `catch (e) { catchDebugFn('context name')(e) }`
 */
export function catchDebugFn(ctx: string): (err: unknown) => void {
  return (err: unknown) => catchDebug(err, ctx)
}

/**
 * Returns an inline catch handler that logs at warn level.
 * Usage: `catch (e) { catchWarnFn('context name')(e) }`
 */
export function catchWarnFn(ctx: string): (err: unknown) => void {
  return (err: unknown) => catchWarn(err, ctx)
}
