// src/engines/harness/timeout-guard.ts
// Unit 24.4 / 23.4 - Execution timeout guard.
// Wraps a promise with an AbortSignal-backed timeout so a long-running recipe
// cannot hang the executor (cap-store equivalent: per-program execution TTL).

export interface TimeoutGuardResult<T> {
  result: T | undefined
  timedOut: boolean
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<TimeoutGuardResult<T>> {
  const controller = new AbortController()
  let timedOut = false
  const timer = new Promise<'timeout'>((resolve) => {
    setTimeout(() => {
      timedOut = true
      controller.abort()
      resolve('timeout')
    }, timeoutMs)
  })

  try {
    const completed = await Promise.race([fn(controller.signal), timer])
    if (completed === 'timeout') return { result: undefined, timedOut: true }
    return { result: completed as T, timedOut: false }
  } catch (err) {
    if (timedOut || (err instanceof Error && err.name === 'AbortError')) {
      return { result: undefined, timedOut: true }
    }
    throw err
  } finally {
    clearTimeout(timer as unknown as ReturnType<typeof setTimeout>)
  }
}
