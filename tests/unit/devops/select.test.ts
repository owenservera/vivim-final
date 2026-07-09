import { describe, expect, it } from 'bun:test'
import { selectFrom } from '../../../devops/select.ts'
import type { Unit } from '../../../devops/tracker.ts'

function unit(id: string, phase: number, state: Unit['state'], name = `Unit ${id}`): Unit {
  return { id, name, phase, phaseName: `Phase ${phase}`, state, lineIndex: 0 }
}

describe('selectFrom', () => {
  it('selects first pending unit when deps done and phase open', () => {
    const units = [
      unit('1.1', 1, 'done'),
      unit('2.1', 2, 'pending'),
      unit('2.2', 2, 'pending', 'needs 2.1'),
    ]
    const deps = new Map([['2.2', ['2.1']]])
    const sel = selectFrom(units, deps)
    expect(sel?.id).toBe('2.1')
  })

  it('blocks a unit whose dependency is not done', () => {
    const units = [
      unit('1.1', 1, 'done'),
      unit('2.1', 2, 'pending'),
      unit('2.2', 2, 'pending', 'needs 2.1'),
    ]
    const deps = new Map([['2.2', ['2.1']]])
    const sel = selectFrom(units, deps)
    expect(sel?.id).toBe('2.1') // 2.2 is blocked waiting on 2.1
  })

  it('enforces phase gate: phase N needs all earlier phases done', () => {
    const units = [
      unit('1.1', 1, 'done'),
      unit('2.1', 2, 'pending'), // phase 2 not fully done
      unit('3.1', 3, 'pending'),
    ]
    const deps = new Map<string, string[]>([])
    const sel = selectFrom(units, deps)
    expect(sel?.id).toBe('2.1') // 3.1 must wait for phase 2 complete
  })

  it('resumes in_progress units before pending', () => {
    const units = [unit('1.1', 1, 'done'), unit('2.1', 2, 'in_progress'), unit('2.2', 2, 'pending')]
    const deps = new Map<string, string[]>([])
    const sel = selectFrom(units, deps)
    expect(sel?.id).toBe('2.1')
    expect(sel?.resume).toBe(true)
  })

  it('returns null when only blocked units remain', () => {
    const units = [unit('1.1', 1, 'done'), unit('2.1', 2, 'blocked')]
    const sel = selectFrom(units, new Map())
    expect(sel).toBeNull()
  })

  it('expands range deps via the dep map (3.1-3.4 already loaded by deps.ts)', () => {
    const units = [
      unit('1.1', 1, 'done'),
      unit('3.1', 3, 'done'),
      unit('3.2', 3, 'done'),
      unit('3.3', 3, 'done'),
      unit('3.4', 3, 'done'),
      unit('3.5', 3, 'pending', 'needs 3.1-3.4'),
    ]
    const deps = new Map([['3.5', ['3.1', '3.2', '3.3', '3.4']]])
    const sel = selectFrom(units, deps)
    expect(sel?.id).toBe('3.5')
  })
})
