'use client';

/**
 * components/canvas/MutationHistoryPanel.tsx
 * --------------------------------------------------------------------
 * Phase 4 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Composer-as-Builder.
 *
 * Dockable side panel showing the recent mutation history, with
 * undo/redo controls. Uses the useMutation() hook from src/sdk/web.
 *
 * Each history entry is rendered as a row:
 *   - op badge (color-coded)
 *   - target surface id
 *   - provenance tag
 *   - applied time
 *   - "view" button (calls onView with the record)
 *
 * The panel is self-contained: it polls /api/mutation/status and
 * /api/mutation/history on mount and after each undo/redo.
 *
 * CONTRACT_VERSION: 1
 */

import { useMemo } from 'react';
import { useMutation, type AppliedMutationRecord } from '@/sdk/web/use-mutation';

// ── Props ────────────────────────────────────────────────────────────────────

export interface MutationHistoryPanelProps {
  /** Called when the user clicks "View" on a history record. */
  onView?: (record: AppliedMutationRecord) => void;
  /** Called when the user clicks "Undo". */
  onUndo?: (record: AppliedMutationRecord | null) => void;
  /** Called when the user clicks "Redo". */
  onRedo?: (record: AppliedMutationRecord | null) => void;
  /** Whether to enable live polling. Default: true. */
  poll?: boolean;
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

function relativeTime(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return `${Math.max(1, Math.floor(delta / 1000))}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

// ── Row component ────────────────────────────────────────────────────────────

function HistoryRow({
  record,
  onView,
}: {
  record: AppliedMutationRecord;
  onView?: (record: AppliedMutationRecord) => void;
}) {
  const color = opColor(record.mutation.op);
  return (
    <div
      data-history-row
      data-history-op={record.mutation.op}
      data-history-target={record.mutation.target}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        fontSize: 11,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color,
          padding: '1px 5px',
          background: `${color}1a`,
          borderRadius: 2,
        }}
      >
        {record.mutation.op}
      </span>
      <code
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text, #0f172a)',
          wordBreak: 'break-all',
          flex: 1,
          minWidth: 0,
        }}
        title={record.mutation.target}
      >
        {record.mutation.target}
      </code>
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-muted, #64748b)',
          padding: '1px 5px',
          background: 'var(--bg-elevated, #f1f5f9)',
          borderRadius: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {record.mutation.provenance}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted, #94a3b8)',
        }}
        title={new Date(record.appliedAt).toLocaleString()}
      >
        {relativeTime(record.appliedAt)}
      </span>
      {onView && (
        <button
          type="button"
          onClick={() => onView(record)}
          style={{
            fontSize: 10,
            padding: '1px 6px',
            background: 'transparent',
            border: '1px solid var(--border, #e2e8f0)',
            color: 'var(--text, #475569)',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          View
        </button>
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
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 8 }} aria-hidden>
        📜
      </div>
      No mutations yet. Apply a mutation from the Composer to see it here.
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function MutationHistoryPanel({
  onView,
  onUndo,
  onRedo,
  poll = true,
}: MutationHistoryPanelProps) {
  const { history, status, undo, redo, refreshHistory, refreshStatus, loading } = useMutation({
    pollStatus: poll,
    pollMs: 5000,
  });

  // The most recent record (for "View" link).
  const mostRecent = useMemo(() => history[0] ?? null, [history]);

  const handleUndo = async () => {
    const r = await undo();
    if (r.ok) {
      onUndo?.(r.record);
    } else {
      onUndo?.(null);
    }
    void refreshHistory();
    void refreshStatus();
  };

  const handleRedo = async () => {
    const r = await redo();
    if (r.ok) {
      onRedo?.(r.record);
    } else {
      onRedo?.(null);
    }
    void refreshHistory();
    void refreshStatus();
  };

  return (
    <div
      data-phase="4"
      data-mutation-history-panel
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
          Mutation History
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted, #64748b)',
            padding: '1px 6px',
            background: 'var(--bg-elevated, #f1f5f9)',
            borderRadius: 8,
          }}
        >
          {history.length} {history.length === 1 ? 'entry' : 'entries'}
        </span>
        <button
          type="button"
          onClick={() => {
            void refreshHistory();
            void refreshStatus();
          }}
          title="Refresh"
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            padding: '2px 8px',
            background: 'transparent',
            border: '1px solid var(--border, #e2e8f0)',
            color: 'var(--text-muted, #64748b)',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          ⟳
        </button>
      </div>

      {/* Undo / Redo controls */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          gap: 6,
          flexShrink: 0,
          background: 'var(--bg-elevated, #f8fafc)',
        }}
      >
        <button
          type="button"
          onClick={handleUndo}
          disabled={!status.canUndo || loading}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            color: status.canUndo && !loading ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)',
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 3,
            cursor: status.canUndo && !loading ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.6 : 1,
          }}
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!status.canRedo || loading}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            color: status.canRedo && !loading ? 'var(--text, #0f172a)' : 'var(--text-muted, #94a3b8)',
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 3,
            cursor: status.canRedo && !loading ? 'pointer' : 'not-allowed',
            opacity: loading ? 0.6 : 1,
          }}
        >
          ↷ Redo
        </button>
      </div>

      {/* History list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
        }}
        className="scrollbar-thin"
      >
        {history.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {history.map((r) => (
              <HistoryRow key={r.id} record={r} onView={onView} />
            ))}
            {/* The most-recent record is at history[0]; if onView is provided and the user
                wants to see it as a diff, they can click "View" — the parent will route it
                to MutationDiffPanel. */}
            {!onView && mostRecent && (
              <div
                style={{
                  padding: 8,
                  fontSize: 10,
                  color: 'var(--text-muted, #94a3b8)',
                  textAlign: 'center',
                }}
              >
                Most recent: <code>{mostRecent.mutation.target}</code> ({mostRecent.mutation.op})
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
