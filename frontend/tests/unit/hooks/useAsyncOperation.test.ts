import { useAsyncOperation } from '@/hooks/useAsyncOperation'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

describe('useAsyncOperation', () => {
  test('initial state', () => {
    const { result } = renderHook(() => useAsyncOperation())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  test('run returns result on success', async () => {
    const { result } = renderHook(() => useAsyncOperation())

    let value: string | null = null
    await act(async () => {
      value = await result.current.run(async () => 'hello')
    })

    expect(value).toBe('hello')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  test('run returns null on error', async () => {
    const { result } = renderHook(() => useAsyncOperation())

    let value: string | null = 'initial'
    await act(async () => {
      value = await result.current.run(async () => {
        throw new Error('boom')
      })
    })

    expect(value).toBeNull()
    expect(result.current.error).toBe('boom')
    expect(result.current.loading).toBe(false)
  })

  test('run handles non-Error thrown values', async () => {
    const { result } = renderHook(() => useAsyncOperation())

    await act(async () => {
      await result.current.run(async () => {
        throw 'string error'
      })
    })

    expect(result.current.error).toBe('Operation failed')
  })

  test('clearError clears the error', async () => {
    const { result } = renderHook(() => useAsyncOperation())

    await act(async () => {
      await result.current.run(async () => {
        throw new Error('fail')
      })
    })

    expect(result.current.error).toBe('fail')

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  test('setError sets error manually', () => {
    const { result } = renderHook(() => useAsyncOperation())

    act(() => {
      result.current.setError('manual error')
    })

    expect(result.current.error).toBe('manual error')
  })

  test('loading is true during run', async () => {
    const { result } = renderHook(() => useAsyncOperation())
    let resolvePromise: (v: string) => void

    act(() => {
      result.current.run(
        () =>
          new Promise<string>((r) => {
            resolvePromise = r
          }),
      )
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolvePromise!('done')
    })

    expect(result.current.loading).toBe(false)
  })
})
