// src/components/canvas/__tests__/BuilderProvider.test.ts
// Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
//
// Tests the `coerceToPlan()` helper that converts NLCL `output` (shape: unknown)
// into a `SurfaceMutationPlan` (or null). This is the most fragile seam in
// Phase 4 — it bridges the NLCL engine's free-form output and the strict
// mutation schema. The tests cover:
//   - null/undefined/primitive outputs → null
//   - single-mutation shape → wrapped plan
//   - plan shape → passthrough
//   - malformed mutations (missing op/target) → null
//   - rollback / parentPlanId / description fields preserved

import { describe, expect, test } from 'vitest';
import { coerceToPlan } from '../BuilderProvider';

describe('Phase 4 — coerceToPlan', () => {
  test('returns null for null/undefined/primitive outputs', () => {
    expect(coerceToPlan(null)).toBeNull();
    expect(coerceToPlan(undefined)).toBeNull();
    expect(coerceToPlan(42)).toBeNull();
    expect(coerceToPlan('not a plan')).toBeNull();
    expect(coerceToPlan(true)).toBeNull();
  });

  test('returns null for empty object', () => {
    expect(coerceToPlan({})).toBeNull();
  });

  test('returns null for object with mutations but empty array', () => {
    expect(coerceToPlan({ mutations: [] })).toBeNull();
  });

  test('returns null for mutations array with non-mutation entries', () => {
    expect(
      coerceToPlan({
        mutations: [{ foo: 'bar' }],
      }),
    ).toBeNull();
  });

  test('wraps a single mutation into a plan', () => {
    const single = {
      op: 'replace',
      target: 'panel:conversations',
      provenance: 'nlcl',
      payload: { kind: 'panel', label: 'Conversations', slot: 'left' },
    };
    const plan = coerceToPlan(single);
    expect(plan).not.toBeNull();
    expect(plan!.mutations).toHaveLength(1);
    expect(plan!.mutations[0]!.op).toBe('replace');
    expect(plan!.mutations[0]!.target).toBe('panel:conversations');
    expect(plan!.mutations[0]!.provenance).toBe('nlcl');
    expect(plan!.provenance).toBe('nlcl');
    expect(plan!.id).toMatch(/^plan-\d+$/);
    expect(plan!.description).toContain('replace');
    expect(plan!.description).toContain('panel:conversations');
  });

  test('passes through a plan with all fields preserved', () => {
    const planInput = {
      id: 'plan-abc-123',
      mutations: [
        {
          op: 'restyle',
          target: 'card:doc-1',
          provenance: 'manual',
          payload: { backgroundColor: '#ff0000' },
        },
        {
          op: 'rebind',
          target: 'card:doc-1',
          provenance: 'manual',
          payload: { capabilityId: 'cap:document:edit', action: 'bind' },
        },
      ],
      provenance: 'manual',
      description: 'Make the doc card red and editable',
      rollback: [
        {
          op: 'restyle',
          target: 'card:doc-1',
          provenance: 'system',
          payload: { backgroundColor: '#ffffff' },
        },
      ],
      parentPlanId: 'plan-parent-xyz',
    };
    const plan = coerceToPlan(planInput);
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-abc-123');
    expect(plan!.mutations).toHaveLength(2);
    expect(plan!.mutations[0]!.op).toBe('restyle');
    expect(plan!.mutations[1]!.op).toBe('rebind');
    expect(plan!.provenance).toBe('manual');
    expect(plan!.description).toBe('Make the doc card red and editable');
    expect(plan!.rollback).toHaveLength(1);
    expect(plan!.rollback![0]!.op).toBe('restyle');
    expect(plan!.parentPlanId).toBe('plan-parent-xyz');
  });

  test('synthesizes id and description if missing from plan', () => {
    const minimal = {
      mutations: [
        {
          op: 'hide',
          target: 'panel:conversations',
          provenance: 'nlcl',
          payload: {},
        },
      ],
      provenance: 'nlcl',
    };
    // Note: 'hide' is not in the canonical op set — but coerceToPlan does
    // light validation only (just `op: string, target: string`). It does
    // NOT enforce the contract. That's intentional — the backend's Zod
    // schema does the strict validation on /api/mutation/apply.
    const plan = coerceToPlan(minimal);
    expect(plan).not.toBeNull();
    expect(plan!.id).toMatch(/^plan-\d+$/);
    expect(plan!.description).toBeUndefined();
  });

  test('defaults provenance to "nlcl" if missing from plan shape', () => {
    const plan = coerceToPlan({
      mutations: [
        { op: 'replace', target: 'card:doc-1', provenance: 'nlcl', payload: {} },
      ],
      // no provenance at plan level
    });
    expect(plan).not.toBeNull();
    expect(plan!.provenance).toBe('nlcl');
  });

  test('handles all 8 canonical ops in single-mutation form', () => {
    const ops = [
      'replace',
      'insert',
      'remove',
      'reorder',
      'restyle',
      'rebind',
      'set_property',
      'set_slot',
    ];
    for (const op of ops) {
      const plan = coerceToPlan({
        op,
        target: 'panel:test',
        provenance: 'manual',
        payload: op === 'remove' ? undefined : { foo: 'bar' },
      });
      expect(plan).not.toBeNull();
      expect(plan!.mutations[0]!.op).toBe(op);
    }
  });

  test('returns null for object missing target', () => {
    expect(coerceToPlan({ op: 'replace', provenance: 'manual', payload: {} })).toBeNull();
  });

  test('returns null for object missing op', () => {
    expect(coerceToPlan({ target: 'panel:foo', provenance: 'manual', payload: {} })).toBeNull();
  });

  test('returns null for object missing provenance', () => {
    expect(coerceToPlan({ op: 'replace', target: 'panel:foo', payload: {} })).toBeNull();
  });

  test('returns null for object with wrong-typed fields', () => {
    expect(
      coerceToPlan({
        op: 123,
        target: 'panel:foo',
        provenance: 'manual',
      }),
    ).toBeNull();
    expect(
      coerceToPlan({
        op: 'replace',
        target: 42,
        provenance: 'manual',
      }),
    ).toBeNull();
  });
});
