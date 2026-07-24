import { describe, expect, it } from 'bun:test'
import { withTimeout } from '../../../../src/engines/harness/timeout-guard.js'

describe('timeout-guard', () => {
  it('returns result when fn completes before timeout', async () => {
    const result = await withTimeout(async () => 'done', 1000)
    expect(result.result).toBe('done')
    expect(result.timedOut).toBe(false)
  })

  it('returns timedOut=true when fn exceeds timeout', async () => {
    const result = await withTimeout(async () => {
      await new Promise((r) => setTimeout(r, 200))
      return 'done'
    }, 50)
    expect(result.result).toBeUndefined()
    expect(result.timedOut).toBe(true)
  })

  it('passes AbortSignal to fn', async () => {
    let signalReceived = false
    await withTimeout(async (_signal) => {
      signalReceived = true
      return 'ok'
    }, 1000)
    expect(signalReceived).toBe(true)
  })

  it('propagates non-timeout errors', async () => {
    await expect(
      withTimeout(async () => {
        throw new Error('boom')
      }, 1000),
    ).rejects.toThrow('boom')
  })

  it('returns timedOut on AbortError after cancellation', async () => {
    const result = await withTimeout(async (signal) => {
      await new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const err = new DOMException('aborted', 'AbortError')
          reject(err)
        })
      })
      return 'ok'
    }, 50)
    expect(result.timedOut).toBe(true)
  })
})
