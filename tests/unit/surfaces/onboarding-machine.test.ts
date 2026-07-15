import { describe, expect, it } from 'bun:test'
import {
  type OnboardingState,
  createInitialState,
  deserializeOnboarding,
  reduceOnboarding,
  serializeOnboarding,
} from '../../../web/sandbox/src/onboarding/onboarding-machine'

describe('onboarding machine (37.2)', () => {
  it('walks through provider connect + sample task under airgap', () => {
    let s: OnboardingState = createInitialState({ airgap: true })
    expect(s.step).toBe('welcome')
    s = reduceOnboarding(s, { type: 'next' }) // connect
    s = reduceOnboarding(s, { type: 'setProvider', kind: 'local' })
    s = reduceOnboarding(s, { type: 'next' }) // airgap skips consent -> sample
    expect(s.step).toBe('sample')
    s = reduceOnboarding(s, { type: 'complete' })
    expect(s.completed).toBe(true)
    expect(s.step).toBe('done')
  })

  it('cloud path requires explicit consent step when not airgapped', () => {
    let s = createInitialState({ airgap: false })
    s = reduceOnboarding(s, { type: 'next' }) // connect
    s = reduceOnboarding(s, { type: 'setProvider', kind: 'cloud' })
    s = reduceOnboarding(s, { type: 'next' }) // consent (not skipped)
    expect(s.step).toBe('consent')
  })

  it('skip persists completion', () => {
    const s = reduceOnboarding(createInitialState({ airgap: true }), { type: 'skip' })
    expect(s.skipped).toBe(true)
    expect(s.completed).toBe(true)
  })

  it('reopen resets to welcome but keeps provider choice', () => {
    let s = createInitialState({ airgap: false })
    s = reduceOnboarding(s, { type: 'setProvider', kind: 'cloud' })
    s = reduceOnboarding(s, { type: 'complete' })
    const reopened = reduceOnboarding(s, { type: 'reopen' })
    expect(reopened.step).toBe('welcome')
    expect(reopened.completed).toBe(false)
    expect(reopened.providerKind).toBe('cloud')
  })

  it('serializes and rehydrates', () => {
    const s = reduceOnboarding(createInitialState({ airgap: true }), { type: 'skip' })
    const round = deserializeOnboarding(serializeOnboarding(s))
    expect(round?.skipped).toBe(true)
    expect(deserializeOnboarding(null)).toBeNull()
  })
})
