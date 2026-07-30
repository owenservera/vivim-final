import { useToast } from '@/hooks/useToast'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

describe('useToast', () => {
  test('initial state is null', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toast).toBeNull()
  })

  test('showToast sets toast state', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('ok', 'Saved!')
    })

    expect(result.current.toast).toEqual({ kind: 'ok', msg: 'Saved!' })
  })

  test('showToast with error kind', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('err', 'Failed!')
    })

    expect(result.current.toast).toEqual({ kind: 'err', msg: 'Failed!' })
  })

  test('auto-dismisses after specified time', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast(1000))

    act(() => {
      result.current.showToast('ok', 'Temp')
    })
    expect(result.current.toast).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.toast).toBeNull()
    vi.useRealTimers()
  })

  test('clearToast clears immediately', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useToast(5000))

    act(() => {
      result.current.showToast('ok', 'Clear me')
    })
    expect(result.current.toast).not.toBeNull()

    act(() => {
      result.current.clearToast()
    })

    expect(result.current.toast).toBeNull()
    vi.useRealTimers()
  })

  test('new toast replaces old one', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('ok', 'First')
    })
    expect(result.current.toast?.msg).toBe('First')

    act(() => {
      result.current.showToast('err', 'Second')
    })
    expect(result.current.toast?.msg).toBe('Second')
    expect(result.current.toast?.kind).toBe('err')
  })
})
