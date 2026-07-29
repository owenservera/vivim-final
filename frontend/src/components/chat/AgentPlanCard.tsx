'use client';

/**
 * components/chat/AgentPlanCard.tsx
 * --------------------------------------------------------------------
 * Phase 7 of ROADMAP-REPROGRAMMABLE-CANVAS.md — LLM Harness Escalation.
 *
 * Inline card rendered in the Composer when an LLM harness plan is returned.
 * Shows the plan as an annotated list of mutations with per-mutation
 * Apply/Skip toggles. "Confirm all" triggers the HMAC confirmation flow
 * (the user clicks Confirm → the card calls /api/llm-harness/apply with
 * the confirmation token from the plan response).
 *
 * The card is purely presentational — the parent (Composer) owns the plan
 * state and passes it in. After successful apply, the parent clears the plan.
 *
 * CONTRACT_VERSION: 1
 */

import { useState } from 'react';
import { useIO } from '@/sdk/web';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from '@/components/canvas/Icon';
import type {
  SurfaceMutationPlan,
  SurfaceMutation,
} from '@backend/reprogrammability/mutation-schema';

// ── Props ────────────────────────────────────────────────────────────────────

export interface AgentPlanCardProps {
  /** The plan returned by /api/llm-harness/plan. */
  plan: SurfaceMutationPlan;
  /** The HMAC-signed confirmation token (from the plan response). */
  confirmationToken: string;
  /** Called when the user confirms + the apply succeeds. */
  onConfirmed?: () => void;
  /** Called when the user dismisses the card. */
  onDismiss?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OP_COLORS: Record<string, string> = {
  replace: '#3b82f6',
  insert: '#22c55e',
  remove: '#ef4444',
  reorder: '#a855f7',
  restyle: '#f59e0b',
  rebind: '#06b6d4',
  set_property: '#6366f1',
  set_slot: '#ec4899',
};

function opColor(op: string): string {
  return OP_COLORS[op] ?? '#64748b';
}

// ── Component ────────────────────────────────────────────────────────────────

export function AgentPlanCard({
  plan,
  confirmationToken,
  onConfirmed,
  onDismiss,
}: AgentPlanCardProps) {
  const io = useIO();
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const { loading: applying, error, setError, run } = useAsyncOperation();

  const toggleSkip = (idx: number) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleConfirmAll = async () => {
    setError(null);
    // Filter out skipped mutations.
    const filteredPlan: SurfaceMutationPlan = {
      ...plan,
      mutations: plan.mutations.filter((_, i) => !skipped.has(i)),
    };

    if (filteredPlan.mutations.length === 0) {
      setError('All mutations skipped — nothing to apply.');
      return;
    }

    const res = await run(() => io.post<{
      ok: boolean;
      error?: string;
      result?: { ok: boolean; records: unknown[] };
    }>('/api/llm-harness/apply', {
      plan: filteredPlan,
      confirmationToken,
    }));
    if (!res?.data?.ok) {
      setError(res?.data?.error ?? 'Apply failed');
      return;
    }
    onConfirmed?.();
  };

  const activeCount = plan.mutations.length - skipped.size;

  return (
    <div
      role="region"
      aria-label="LLM harness plan"
      style={{
        margin: '8px 0',
        padding: '12px',
        background: 'var(--bg-elevated, #f8fafc)',
        border: '1px solid var(--accent, #3b82f6)',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        animation: 'scale-in 0.18s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Icon name="sparkle" size={14} style={{ color: 'var(--accent, #3b82f6)' }} />
        <strong style={{ fontSize: 13 }}>LLM Harness Plan</strong>
        {plan.description && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted, #64748b)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            — {plan.description}
          </span>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss plan"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted, #64748b)',
            padding: 2,
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Mutation list */}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {plan.mutations.map((m, i) => (
          <MutationRow
            key={`${m.op}-${m.target}-${i}`}
            mutation={m}
            index={i}
            skipped={skipped.has(i)}
            onToggleSkip={() => toggleSkip(i)}
          />
        ))}
      </ul>

      {/* Error */}
      {error && (
        <p style={{ margin: '6px 0', fontSize: 12, color: '#ef4444' }}>{error}</p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void handleConfirmAll()}
          disabled={applying || activeCount === 0}
          style={{
            padding: '6px 14px',
            background: 'var(--accent, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: applying || activeCount === 0 ? 'not-allowed' : 'pointer',
            opacity: applying || activeCount === 0 ? 0.6 : 1,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {applying
            ? 'Applying…'
            : `Confirm all (${activeCount}/${plan.mutations.length})`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            color: 'var(--text-muted, #64748b)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Discard
        </button>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #64748b)',
            flex: 1,
            textAlign: 'right',
          }}
          title="HMAC-signed token from /api/llm-harness/plan"
        >
          token: <code>{confirmationToken.slice(0, 12)}…</code>
        </span>
      </div>
    </div>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────────

function MutationRow({
  mutation,
  index,
  skipped,
  onToggleSkip,
}: {
  mutation: SurfaceMutation;
  index: number;
  skipped: boolean;
  onToggleSkip: () => void;
}) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '6px 8px',
        background: skipped
          ? 'transparent'
          : 'var(--bg-canvas, #ffffff)',
        border: `1px solid ${skipped ? 'var(--border-subtle, #e2e8f0)' : `${opColor(mutation.op)}33`}`,
        borderRadius: '4px',
        fontSize: 12,
        opacity: skipped ? 0.5 : 1,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          padding: '2px 6px',
          background: `${opColor(mutation.op)}22`,
          color: opColor(mutation.op),
          borderRadius: '3px',
          fontWeight: 600,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {mutation.op}
      </span>
      <code style={{ flex: 1, fontSize: 11, color: 'var(--text-primary, #0f172a)' }}>
        {mutation.target}
      </code>
      {mutation.reason && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #64748b)',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '40%',
          }}
          title={mutation.reason}
        >
          {mutation.reason}
        </span>
      )}
      <button
        type="button"
        onClick={onToggleSkip}
        title={skipped ? 'Include this mutation' : 'Skip this mutation'}
        style={{
          background: 'transparent',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          cursor: 'pointer',
          padding: '2px 8px',
          fontSize: 10,
          borderRadius: '3px',
          color: skipped ? 'var(--text-muted, #64748b)' : 'var(--accent, #3b82f6)',
        }}
      >
        {skipped ? 'Skip' : '✓'}
      </button>
      <span style={{ fontSize: 10, color: 'var(--text-muted, #64748b)' }}>#{index + 1}</span>
    </li>
  );
}
