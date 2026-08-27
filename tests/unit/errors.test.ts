// tests/unit/errors.test.ts
// Unit tests for the typed error hierarchy in src/errors.ts.

import { describe, expect, test } from 'bun:test'
import {
  BudgetExceededError,
  CanvasMutationError,
  CanvasSpawnError,
  CapabilityCompositionError,
  CapabilityNotFoundError,
  CapStoreError,
  ConsentViolationError,
  EngineError,
  HitlGateDeniedError,
  HitlGateExpiredError,
  IntentDecompositionError,
  SandboxBudgetError,
  SandboxPermissionError,
  SandboxTimeoutError,
  SyncConflictError,
} from '../../src/errors.js'

describe('error hierarchy', () => {
  test('new subclasses extend CapStoreError and Error', () => {
    const cases: CapStoreError[] = [
      new IntentDecompositionError('x'),
      new CapabilityNotFoundError('slug'),
      new CapabilityCompositionError('x'),
      new CanvasSpawnError('x'),
      new CanvasMutationError('x'),
      new SandboxTimeoutError('h', 100),
      new SandboxBudgetError('h', 'cpu', 2, 1),
      new SandboxPermissionError('h', 'fs'),
      new ConsentViolationError('host'),
      new SyncConflictError('t', 'r'),
      new HitlGateExpiredError('g'),
      new HitlGateDeniedError('g', 'u'),
      new BudgetExceededError('cost', 2, 1),
    ]
    for (const e of cases) {
      expect(e).toBeInstanceOf(CapStoreError)
      expect(e).toBeInstanceOf(Error)
    }
  })

  test('EngineError', () => {
    const err = new EngineError('boom')
    expect(err.code).toBe('EngineError')
    expect(err.message).toBe('boom')
    expect(err.toJSON()).toEqual({ error: 'boom', code: 'EngineError', details: undefined })
  })

  test('IntentDecompositionError', () => {
    const err = new IntentDecompositionError('no match', { goal: 'foo' })
    expect(err.code).toBe('IntentDecompositionError')
    expect(err.message).toBe('no match')
    expect(err.details).toEqual({ goal: 'foo' })
    expect(err.toJSON()).toEqual({
      error: 'no match',
      code: 'IntentDecompositionError',
      details: { goal: 'foo' },
    })
  })

  test('CapabilityNotFoundError', () => {
    const err = new CapabilityNotFoundError('my-cap')
    expect(err.code).toBe('CapabilityNotFoundError')
    expect(err.message).toBe('Capability not found: my-cap')
  })

  test('CapabilityCompositionError', () => {
    const err = new CapabilityCompositionError('cyclic', { a: 'b' })
    expect(err.code).toBe('CapabilityCompositionError')
    expect(err.message).toBe('cyclic')
    expect(err.details).toEqual({ a: 'b' })
  })

  test('CanvasSpawnError', () => {
    const err = new CanvasSpawnError('failed')
    expect(err.code).toBe('CanvasSpawnError')
    expect(err.message).toBe('failed')
  })

  test('CanvasMutationError', () => {
    const err = new CanvasMutationError('read-only')
    expect(err.code).toBe('CanvasMutationError')
    expect(err.message).toBe('read-only')
  })

  test('SandboxTimeoutError', () => {
    const err = new SandboxTimeoutError('handler', 5000)
    expect(err.code).toBe('SandboxTimeoutError')
    expect(err.message).toBe('Handler handler exceeded 5000ms budget')
  })

  test('SandboxBudgetError', () => {
    const err = new SandboxBudgetError('handler', 'memory', 256, 128)
    expect(err.code).toBe('SandboxBudgetError')
    expect(err.message).toBe('handler memory 256 > 128')
  })

  test('SandboxPermissionError', () => {
    const err = new SandboxPermissionError('handler', 'fs.write')
    expect(err.code).toBe('SandboxPermissionError')
    expect(err.message).toBe('handler denied: fs.write')
  })

  test('ConsentViolationError', () => {
    const err = new ConsentViolationError('evil.com')
    expect(err.code).toBe('ConsentViolationError')
    expect(err.message).toBe('Outbound call to evil.com denied (no user consent)')
  })

  test('SyncConflictError', () => {
    const err = new SyncConflictError('messages', 'm1')
    expect(err.code).toBe('SyncConflictError')
    expect(err.message).toBe('Conflict on messages:m1')
  })

  test('HitlGateExpiredError', () => {
    const err = new HitlGateExpiredError('gate-1')
    expect(err.code).toBe('HitlGateExpiredError')
    expect(err.message).toBe('Gate gate-1 expired without resolution')
  })

  test('HitlGateDeniedError', () => {
    const err = new HitlGateDeniedError('gate-1', 'alice')
    expect(err.code).toBe('HitlGateDeniedError')
    expect(err.message).toBe('Gate gate-1 denied by alice')
  })

  test('BudgetExceededError', () => {
    const err = new BudgetExceededError('tokens', 1000, 500)
    expect(err.code).toBe('BudgetExceededError')
    expect(err.message).toBe('tokens 1000 > 500')
  })
})
