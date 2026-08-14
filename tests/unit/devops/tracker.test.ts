import { describe, expect, it } from 'bun:test'
import {
  computeStats,
  parseUnits,
  type UnitState,
  updateHeader,
  updateState,
} from '../../../devops/tracker.ts'

const SAMPLE = [
  '**Total units:** 3 | **Done:** 1 | **Blocked:** 0 | **Pending:** 2',
  '',
  '## Phase 2: Providers (2 units)',
  '',
  '- [x] 2.1 — ProviderRegistrar           → `src/engines/provider-registrar.ts`',
  '- [ ] 2.2 — RegistrationAuditor        → `src/engines/registration-auditor.ts`',
  '',
  '## Phase 3: Governor (1 units)',
  '',
  '- [ ] 3.1 — ChromeGovernor             → `src/engines/chrome-governor.ts`',
  '',
  '## Last Updated',
  '',
  '2026-07-09',
].join('\n')

describe('tracker.ts', () => {
  it('parses units with phase, state, and file', () => {
    const units = parseUnits(SAMPLE.split('\n'))
    expect(units.length).toBe(3)
    expect(units[0]).toMatchObject({
      id: '2.1',
      name: 'ProviderRegistrar',
      phase: 2,
      state: 'done',
      file: 'src/engines/provider-registrar.ts',
    })
  })

  it('computes stats from states', () => {
    const stats = computeStats(parseUnits(SAMPLE.split('\n')))
    expect(stats).toEqual({ total: 3, done: 1, blocked: 0, pending: 2 })
  })

  it('updates a single unit state without disturbing other lines', () => {
    const next = updateState(SAMPLE.split('\n'), '2.2', 'done' as UnitState)
    expect(next[5]).toBe(
      '- [x] 2.2 — RegistrationAuditor        → `src/engines/registration-auditor.ts`',
    )
    expect(next[0]).toContain('Done:** 1') // header unchanged by updateState
    expect(next[7]).toContain('Phase 3') // section header untouched
  })

  it('recomputes header stats and bumps Last Updated', () => {
    let lines = updateState(SAMPLE.split('\n'), '2.2', 'done' as UnitState)
    lines = updateHeader(lines, computeStats(parseUnits(lines)))
    expect(lines[0]).toContain('Done:** 2')
    expect(lines[0]).toContain('Pending:** 1')
    expect(lines[lines.length - 1]?.trim()).toBe(new Date().toISOString().slice(0, 10))
  })

  it('throws on unknown unit id', () => {
    expect(() => updateState(SAMPLE.split('\n'), '9.9', 'done' as UnitState)).toThrow()
  })

  it('parses the revised phase-header format (no unit count, trailing ✓)', () => {
    const lines = [
      '## Phase 1: Skeleton ✓',
      '',
      '- [x] 1.1 — Prisma Schema              → `prisma/schema.prisma`',
      '- [ ] 1.2 - Seed SQL (CHECK constraints) → `prisma/seed.sql`',
      '',
      '## Phase 2: Provider Knowledge Graph (12 units)',
      '',
      '- [ ] 2.1 — ProviderRegistrar → `src/engines/provider-registrar.ts`',
    ]
    const units = parseUnits(lines)
    expect(units.length).toBe(3)
    expect(units[0]).toMatchObject({ id: '1.1', phase: 1, phaseName: 'Skeleton', state: 'done' })
    // hyphen separator is accepted too
    expect(units[1]).toMatchObject({
      id: '1.2',
      phase: 1,
      name: 'Seed SQL (CHECK constraints)',
      state: 'pending',
    })
    expect(units[2]).toMatchObject({ id: '2.1', phase: 2, phaseName: 'Provider Knowledge Graph' })
  })
})
