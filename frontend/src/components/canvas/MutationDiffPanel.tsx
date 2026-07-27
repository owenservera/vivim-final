'use client';

/**
 * components/canvas/MutationDiffPanel.tsx
 * --------------------------------------------------------------------
 * Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
 *
 * Dockable side panel showing the diff for the currently-previewed
 * mutation (or mutation plan). It renders one card per mutation in the
 * plan, with:
 *   - the op (replace/insert/remove/reorder/restyle/rebind/set_property/set_slot)
 *   - the target surface id
 *   - the provenance tag
 *   - the before/after spec, side-by-side (or stacked on narrow widths)
 *   - errors (if the preview failed for that mutation)
 *
 * The panel is "controlled" — the parent (Composer or Reprogram-Modal)
 * owns the preview state and passes it in. The panel is purely presentational.
 *
 * CONTRACT_VERSION: 1
 */

import { useMemo, useState } from 'react';
import type {
  SurfaceMutation,
  SurfaceMutationPlan,
} from '../../../mini-services/backend/src/reprogrammability/mutation-schema.js';
import type { SurfaceSpec } from '../../../mini-services/backend/src/reprogrammability/schema/spec.js';
import type { PreviewEntry } from '@/sdk/web/use-mutation';

// ── Props ────────────────────────────────────────────────────────────────────

export interface MutationDiffPanelProps {
  /**
   * The plan being previewed. If null/undefined, the panel renders an
   * "empty" state asking the user to type a mutation.
   */
  plan?: SurfaceMutationPlan | null;
  /**
   * The preview entries returned by /api/mutation/preview. Each entry
   * corresponds to one mutation in the plan; entries[i] describes the
   * before/after for plan.mutations[i].
   */
  entries?: PreviewEntry[] | null;
  /** Whether a preview request is in flight. */
  loading?: boolean;
  /** Error message from the preview request, if any. */
  error?: string | null;
  /** Called when the user clicks "Apply". */
  onApply?: () => void;
  /** Called when the user clicks "Discard". */
  onDiscard?: () => void;
  /** Called when the user clicks "Edit JSON". */
  onEdit?: () => void;
  /** Whether an apply request is in flight. */
  applying?: boolean;
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

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/** Render a spec as pretty JSON, truncating if too long. */
function SpecView({ spec, label, color }: { spec?: SurfaceSpec | null; label: string; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const json = useMemo(() => {
    if (!spec) return '';
    try {
      return JSON.stringify(spec, null, 2);
    } catch {
      return String(spec);
    }
  }, [spec]);

  const truncated = !expanded && json.length > 600 ? `${json.slice(0, 600)}…` : json;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--bg-elevated, #f8fafc)',
        border: `1px solid ${color}33`,
        borderRadius: 4,
        padding: 8,
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        fontSize: 11,
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        color: 'var(--text, #0f172a)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-sans, system-ui)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 'inherit', whiteSpace: 'pre-wrap' }}>
        {truncated || '(empty)'}
      </pre>
      {json.length > 600 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginTop: 6,
            padding: '2px 6px',
            fontSize: 10,
            background: 'transparent',
            border: `1px solid ${color}`,
            color,
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans, system-ui)',
          }}
        >
          {expanded ? 'Show less' : `Show all (${json.length} chars)`}
        </button>
      )}
    </div>
  );
}

/** One mutation card. */
function MutationCard({ entry, mutation, index }: { entry?: PreviewEntry; mutation: SurfaceMutation; index: number }) {
  const hasError = !!entry?.error;
  const color = opColor(mutation.op);

  return (
    <div
      data-mutation-card
      data-mutation-op={mutation.op}
      data-mutation-target={mutation.target}
      data-mutation-error={hasError ? 'true' : 'false'}
      style={{
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: 10,
        background: hasError ? 'rgba(239, 68, 68, 0.05)' : 'var(--card, #fff)',
        marginBottom: 8,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color,
            padding: '2px 6px',
            background: `${color}1a`,
            borderRadius: 3,
          }}
        >
          {mutation.op}
        </span>
        <code
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            color: 'var(--text, #0f172a)',
            wordBreak: 'break-all',
          }}
        >
          {mutation.target}
        </code>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted, #64748b)',
            padding: '2px 6px',
            background: 'var(--bg-elevated, #f1f5f9)',
            borderRadius: 3,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
          title="Provenance — who/what produced this mutation"
        >
          {mutation.provenance}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted, #94a3b8)' }}>
          #{index + 1}
        </span>
      </div>

      {/* Error */}
      {hasError && (
        <div
          role="alert"
          style={{
            padding: '6px 8px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 3,
            fontSize: 11,
            color: '#b91c1c',
            marginBottom: 8,
          }}
        >
          <strong>Preview error:</strong> {entry!.error}
        </div>
      )}

      {/* Before / After */}
      {!hasError && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexDirection: 'row',
          }}
        >
          <SpecView spec={entry?.beforeSpec} label="Before" color="#94a3b8" />
          <SpecView spec={entry?.afterSpec} label="After" color={color} />
        </div>
      )}

      {/* Payload summary */}
      {!hasError && mutation.op !== 'remove' && (
        <details style={{ marginTop: 8 }}>
          <summary
            style={{
              fontSize: 10,
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            Payload
          </summary>
          <pre
            style={{
              margin: '6px 0 0',
              padding: 8,
              background: 'var(--bg-elevated, #f8fafc)',
              borderRadius: 3,
              fontSize: 11,
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              overflowX: 'auto',
              color: 'var(--text, #0f172a)',
            }}
          >
            {JSON.stringify(mutation.payload, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--text-muted, #94a3b8)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden>
        ⚡
      </div>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text, #475569)' }}>
        No mutation previewed
      </div>
      <div>
        Type a command in the Composer (e.g. <code style={{ fontSize: 11 }}>/hide panel:conversations</code>)
        to preview a mutation here.
      </div>
    </div>
  );
}

// ── Loading state ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--text-muted, #94a3b8)',
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 8 }} aria-hidden>
        ⏳
      </div>
      Previewing mutation…
    </div>
  );
}

// ── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ error }: { error: string }) {
  return (
    <div
      role="alert"
      style={{
        margin: 12,
        padding: 10,
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 4,
        fontSize: 12,
        color: '#b91c1c',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Preview failed</div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>{error}</div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MutationDiffPanel({
  plan,
  entries,
  loading,
  error,
  onApply,
  onDiscard,
  onEdit,
  applying,
}: MutationDiffPanelProps) {
  const hasPlan = !!plan && plan.mutations.length > 0;
  const allOk = hasPlan && (entries?.length ?? 0) > 0 && entries!.every((e) => !e.error);

  return (
    <div
      data-phase="4"
      data-mutation-diff-panel
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--background, #fff)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text, #0f172a)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Mutation Preview
        </span>
        {hasPlan && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted, #64748b)',
              padding: '1px 6px',
              background: 'var(--bg-elevated, #f1f5f9)',
              borderRadius: 8,
            }}
          >
            {plan!.mutations.length} {plan!.mutations.length === 1 ? 'mutation' : 'mutations'}
          </span>
        )}
        {plan?.description && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted, #64748b)',
              marginLeft: 'auto',
              fontStyle: 'italic',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={plan.description}
          >
            {plan.description}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          minHeight: 0,
        }}
        className="scrollbar-thin"
      >
        {loading && <LoadingState />}
        {!loading && error && <ErrorState error={error} />}
        {!loading && !error && !hasPlan && <EmptyState />}
        {!loading && !error && hasPlan && (
          <>
            {plan!.mutations.map((m, i) => (
              <MutationCard
                key={`${m.target}-${i}`}
                entry={entries?.[i]}
                mutation={m}
                index={i}
              />
            ))}
            {plan!.mutations.length === 0 && <EmptyState />}
          </>
        )}
      </div>

      {/* Footer: action buttons */}
      {hasPlan && !loading && !error && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            gap: 6,
            flexShrink: 0,
            background: 'var(--bg-elevated, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={onApply}
            disabled={!allOk || applying}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: allOk && !applying ? 'var(--accent, #3b82f6)' : 'var(--text-muted, #94a3b8)',
              border: 'none',
              borderRadius: 3,
              cursor: allOk && !applying ? 'pointer' : 'not-allowed',
              opacity: applying ? 0.7 : 1,
            }}
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text, #0f172a)',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Edit JSON
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#dc2626',
              background: 'transparent',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
