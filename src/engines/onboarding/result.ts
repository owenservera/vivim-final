// src/engines/onboarding/result.ts
// Tiny Result type — local to the onboarding pipeline.
//
// The blueprint (§6 L13) proposes adopting `neverthrow` as a new dep. To avoid
// introducing a new runtime dependency in this commit, we use a minimal local
// Result<T, E> type that satisfies the same shape (isOk/isErr, value, error).
// When `neverthrow` is adopted repo-wide per the blueprint's library plan,
// this file can be deleted and the imports swapped with no call-site changes.

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isOk<T, E>(r: Result<T, E>): r is { readonly ok: true; readonly value: T } {
  return r.ok
}

export function isErr<T, E>(r: Result<T, E>): r is { readonly ok: false; readonly error: E } {
  return !r.ok
}
