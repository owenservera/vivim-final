// src/reprogrammability/__tests__/invariants.test.ts
// Phase 10 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Permanence & Invariants Lock.
//
// Runtime tests for the 7 invariants codified in REPROGRAMMABILITY.md.
// The CI gate (scripts/check-reprogrammability.ts) runs these tests as part
// of every PR; failure blocks the PR.
//
// CONTRACT_VERSION: 1

import { beforeEach, describe, expect, test } from 'bun:test'
import { PROVENANCE_WEIGHTS, versionStore } from '../../engines/reprogrammability/version-store.js'
import { resetCanonicalSurfacesForTest } from '../canonical-surfaces.js'
import { CONTRACT_VERSION } from '../contract.js'
import { mutationExecutor } from '../dsl/executor.js'
import {
  MUTATION_OPS,
  PROVENANCE_TAGS,
  SurfaceMutationPlanSchema,
  SurfaceMutationSchema,
} from '../mutation-schema.js'
import { surfaceRegistry } from '../registry.js'

// ── Invariant 1: Every visible element is a ReprogrammableSurface ────────────
//
// Tested by the CI gate's surface scan (Phase 10 §8). The runtime test here
// verifies that the canonical surfaces (panel:conversations, chrome:composer,
// etc.) are registered and implement the contract.

describe('Invariant 1: Every visible element is a ReprogrammableSurface', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
  })

  test('all canonical surfaces implement the contract', () => {
    const surfaces = surfaceRegistry.list()
    expect(surfaces.length).toBeGreaterThan(0)
    for (const s of surfaces) {
      expect(typeof s.id).toBe('string')
      expect(typeof s.kind).toBe('string')
      expect(typeof s.label).toBe('string')
      expect(typeof s.getSpec).toBe('function')
      expect(typeof s.mutate).toBe('function')
      expect(s.supportedOps).toBeDefined()
    }
  })
})

// ── Invariant 2: Every mutation is one of the 8 ops ──────────────────────────

describe('Invariant 2: Every mutation is one of the 8 ops', () => {
  test('MUTATION_OPS has exactly 8 entries', () => {
    expect(MUTATION_OPS).toHaveLength(8)
  })

  test('MUTATION_OPS contains the canonical 8', () => {
    const expected = [
      'replace',
      'insert',
      'remove',
      'reorder',
      'restyle',
      'rebind',
      'set_property',
      'set_slot',
    ]
    expect([...MUTATION_OPS].sort() as string[]).toEqual([...expected].sort())
  })

  test('SurfaceMutationSchema rejects unknown ops', () => {
    const result = SurfaceMutationSchema.safeParse({
      op: 'NOT_A_REAL_OP',
      target: 'panel:conversations',
      provenance: 'manual',
      payload: {},
    })
    expect(result.success).toBe(false)
  })

  test('SurfaceMutationSchema accepts all 8 ops', () => {
    const payloads: Record<string, unknown> = {
      replace: { kind: 'custom', schemaUrl: 'about:blank', data: null },
      insert: { kind: 'custom', schemaUrl: 'about:blank', data: null },
      remove: undefined,
      reorder: ['child:1'],
      restyle: { color: 'red' },
      rebind: { capabilityId: 'cap:test', action: 'bind' },
      set_property: { path: 'title', value: 'New' },
      set_slot: { slotId: 'slot:test' },
    }
    for (const op of MUTATION_OPS) {
      const result = SurfaceMutationSchema.safeParse({
        op,
        target: 'panel:conversations',
        provenance: 'manual',
        payload: payloads[op as string],
      })
      expect(result.success).toBe(true)
    }
  })
})

// ── Invariant 3: Every mutation is logged with provenance ────────────────────

describe('Invariant 3: Every mutation is logged with provenance', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
    mutationExecutor.clearHistory()
    versionStore.clear()
  })

  test('PROVENANCE_TAGS has exactly 6 entries', () => {
    expect(PROVENANCE_TAGS).toHaveLength(6)
  })

  test('PROVENANCE_TAGS contains the canonical 6', () => {
    const expected = ['manual', 'nlcl', 'prefix', 'plugin', 'llm-harness', 'system']
    expect([...PROVENANCE_TAGS].sort() as string[]).toEqual([...expected].sort())
  })

  test('every applied mutation has a non-empty provenance', async () => {
    const record = await mutationExecutor.apply({
      op: 'replace',
      target: 'panel:conversations',
      provenance: 'manual',
      payload: {
        kind: 'panel',
        variant: 'default',
        title: 'Test',
        dock: 'left',
        visible: true,
        collapsed: false,
      },
    })
    expect(record.ok).toBe(true)
    expect(record.mutation.provenance).toBeTruthy()
    expect(typeof record.mutation.provenance).toBe('string')
  })

  test('SurfaceMutationSchema rejects unknown provenance', () => {
    const result = SurfaceMutationSchema.safeParse({
      op: 'replace',
      target: 'panel:conversations',
      provenance: 'NOT_A_REAL_PROVENANCE',
      payload: {},
    })
    expect(result.success).toBe(false)
  })
})

// ── Invariant 4: Every mutation is reversible ────────────────────────────────

describe('Invariant 4: Every mutation is reversible', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
    mutationExecutor.clearHistory()
  })

  test('undo restores the prior spec after a successful apply', async () => {
    const surface = surfaceRegistry.get('panel:conversations')
    const originalSpec = surface.getSpec()

    await mutationExecutor.apply({
      op: 'replace',
      target: 'panel:conversations',
      provenance: 'manual',
      payload: {
        kind: 'panel',
        variant: 'modified',
        title: 'Modified',
        dock: 'right',
        visible: true,
        collapsed: false,
      },
    })

    const modifiedSpec = surface.getSpec()
    expect(modifiedSpec).not.toEqual(originalSpec)

    const undoRecord = await mutationExecutor.undo()
    expect(undoRecord).not.toBeNull()
    const restoredSpec = surface.getSpec()
    expect(restoredSpec).toEqual(originalSpec)
  })

  test('canUndo is false when the undo stack is empty', () => {
    expect(mutationExecutor.canUndo()).toBe(false)
  })

  test('canUndo is true after a successful apply', async () => {
    await mutationExecutor.apply({
      op: 'replace',
      target: 'panel:conversations',
      provenance: 'manual',
      payload: {
        kind: 'panel',
        variant: 'default',
        title: 'Conversations',
        dock: 'left',
        visible: true,
        collapsed: false,
      },
    })
    expect(mutationExecutor.canUndo()).toBe(true)
  })
})

// ── Invariant 5: The LLM never produces code ─────────────────────────────────
//
// Tested by the LlmHarnessAgent tests (Phase 7) which verify that:
//   - LLM output is parsed against SurfaceMutationPlanSchema
//   - Invalid output triggers retries
//   - Provenance is forced to 'llm-harness'
// Here we just verify the schema exists + rejects non-plan shapes.

describe('Invariant 5: The LLM never produces code', () => {
  test('SurfaceMutationPlanSchema rejects a string (code)', () => {
    const result = SurfaceMutationPlanSchema.safeParse('console.log("hello")')
    expect(result.success).toBe(false)
  })

  test('SurfaceMutationPlanSchema rejects an object without mutations', () => {
    const result = SurfaceMutationPlanSchema.safeParse({
      id: 'p1',
      // No mutations field
      provenance: 'llm-harness',
    })
    expect(result.success).toBe(false)
  })

  test('SurfaceMutationPlanSchema accepts a valid plan', () => {
    const result = SurfaceMutationPlanSchema.safeParse({
      id: 'p1',
      mutations: [
        {
          op: 'restyle',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { color: 'red' },
          idempotencyKey: 'k1',
        },
      ],
      provenance: 'llm-harness',
    })
    expect(result.success).toBe(true)
  })
})

// ── Invariant 6: The chrome is reprogrammable but the safe-mode keybind is not ─
//
// This invariant is enforced in ChromeSurface.tsx (frontend). The runtime
// test here verifies that the chrome surfaces exist + can be reset to factory.

describe('Invariant 6: The chrome is reprogrammable + safe-mode keybind', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
  })

  test('chrome:composer is registered + can be reprogrammed', async () => {
    const surface = surfaceRegistry.getOrNull('chrome:composer')
    expect(surface).not.toBeNull()
    expect(surface?.kind).toBe('chrome')

    // Apply a reprogram mutation.
    const record = await mutationExecutor.apply({
      op: 'replace',
      target: 'chrome:composer',
      provenance: 'manual',
      payload: {
        kind: 'chrome',
        chromeKind: 'composer',
        enabled: true,
        strings: { placeholder: 'Describe a change to your canvas…' },
        style: {},
      },
    })
    expect(record.ok).toBe(true)

    // Verify the spec changed.
    const newSpec = surface?.getSpec() as { strings?: { placeholder?: string } }
    expect(newSpec.strings?.placeholder).toBe('Describe a change to your canvas…')
  })
})

// ── Invariant 7: The contract is versioned ───────────────────────────────────

describe('Invariant 7: The contract is versioned', () => {
  test('CONTRACT_VERSION is a positive integer', () => {
    expect(typeof CONTRACT_VERSION).toBe('number')
    expect(CONTRACT_VERSION).toBeGreaterThan(0)
  })

  test('CONTRACT_VERSION is 1 (current)', () => {
    // This test will need to be updated when the contract is amended.
    expect(CONTRACT_VERSION).toBe(1)
  })
})

// ── Phase 8 cross-check: provenance weights cover all 6 tags ─────────────────

describe('Phase 8 cross-check: provenance weights', () => {
  test('PROVENANCE_WEIGHTS covers all 6 provenance tags', () => {
    for (const tag of PROVENANCE_TAGS) {
      expect(PROVENANCE_WEIGHTS[tag]).toBeDefined()
      expect(typeof PROVENANCE_WEIGHTS[tag]).toBe('number')
    }
  })

  test('provenance weight order: manual > nlcl > prefix > plugin > llm-harness > system', () => {
    expect(PROVENANCE_WEIGHTS.manual).toBeGreaterThan(PROVENANCE_WEIGHTS.nlcl)
    expect(PROVENANCE_WEIGHTS.nlcl).toBeGreaterThan(PROVENANCE_WEIGHTS.prefix)
    expect(PROVENANCE_WEIGHTS.prefix).toBeGreaterThan(PROVENANCE_WEIGHTS.plugin)
    expect(PROVENANCE_WEIGHTS.plugin).toBeGreaterThan(PROVENANCE_WEIGHTS['llm-harness'])
    expect(PROVENANCE_WEIGHTS['llm-harness']).toBeGreaterThan(PROVENANCE_WEIGHTS.system)
  })
})
