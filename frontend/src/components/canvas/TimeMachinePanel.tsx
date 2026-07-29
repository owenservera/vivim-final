'use client';

/**
 * components/canvas/TimeMachinePanel.tsx
 * --------------------------------------------------------------------
 * Phase 8 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Provenance & Versioning.
 *
 * Dockable panel showing the version timeline for a surface:
 *   - per-surface horizontal scrubber (oldest → newest)
 *   - hover a version to preview its spec
 *   - click "Restore" to roll the surface back to that version
 *   - "Diff vs current" toggle shows a structured diff
 *
 * The panel is read-only against the version-router; restores go through
 * the MutationExecutor so they're logged + undoable.
 *
 * CONTRACT_VERSION: 1
 */

import { useCallback, useEffect, useState } from 'react';
import { useIO } from './UnifiedIOProvider';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from './Icon';
import type { MutationProvenance } from '@backend/reprogrammability/contract';

// ── Types (mirror of backend version-store.ts SurfaceVersion) ────────────────

interface SurfaceVersion {
  id: string;
  surfaceId: string;
  version: number;
  specJson: string;
  provenance: MutationProvenance;
  mutationId?: string;
  createdAt: number;
  trustWeight: number;
}

interface DiffResponse {
  ok: boolean;
  diff?: {
    surfaceId: string;
    versionA: number;
    versionB: number;
    specA: unknown;
    specB: unknown;
    jsonDiff: string;
  };
}

export interface TimeMachinePanelProps {
  /** The surface id to show the timeline for. */
  surfaceId?: string;
}

const PROVENANCE_COLORS: Record<string, string> = {
  manual: '#22c55e',
  nlcl: '#3b82f6',
  prefix: '#06b6d4',
  plugin: '#a855f7',
  'llm-harness': '#f59e0b',
  system: '#64748b',
};

function provColor(p: string): string {
  return PROVENANCE_COLORS[p] ?? '#64748b';
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function TimeMachinePanel({ surfaceId }: TimeMachinePanelProps) {
  const io = useIO();
  const [versions, setVersions] = useState<SurfaceVersion[]>([]);
  const { loading, error, setError, run } = useAsyncOperation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diffWith, setDiffWith] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const { loading: restoring, run: runRestore } = useAsyncOperation();

  // ── Refresh versions ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!surfaceId) return;
    const res = await run(() => io.get<{
      ok: boolean;
      versions?: SurfaceVersion[];
      error?: string;
    }>('/api/version', { query: { surfaceId, limit: '100' } }));
    if (res?.data?.ok && res.data.versions) {
      setVersions(res.data.versions);
    } else {
      setError(res?.data?.error ?? 'Failed to load versions');
    }
  }, [io, surfaceId, run, setError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Restore a version ────────────────────────────────────────────────────
  const restore = useCallback(
    async (versionId: string) => {
      const res = await runRestore(() => io.post<{
        ok: boolean;
        error?: string;
        record?: { ok: boolean };
      }>(`/api/version/${versionId}/restore`, {}));
      if (!res?.data?.ok) {
        setError(res?.data?.error ?? 'Restore failed');
        return;
      }
      // Refresh after restore — the restore itself adds a new version.
      await refresh();
    },
    [io, refresh, runRestore, setError],
  );

  // ── Diff two versions ─────────────────────────────────────────────────────
  const showDiff = useCallback(
    async (versionIdA: string, versionIdB: string) => {
      const res = await run(() => io.get<DiffResponse>('/api/version/diff', {
        query: { a: versionIdA, b: versionIdB },
      }));
      if (res?.data?.ok && res.data.diff) {
        setDiff(res.data.diff.jsonDiff);
      } else {
        setError('Diff failed');
      }
    },
    [io, run, setError],
  );

  if (!surfaceId) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
        Hover a surface and open Time Machine to see its version timeline.
      </div>
    );
  }

  return (
    <div
      data-surface-id="panel:time-machine"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 12,
        gap: 10,
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="history" size={14} />
        <strong style={{ fontSize: 13 }}>Time Machine</strong>
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #64748b)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <code>{surfaceId}</code>
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: 4,
            padding: '2px 6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          <Icon name="refresh" size={12} />
        </button>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 11, color: '#ef4444' }}>{error}</p>
      )}

      {loading && versions.length === 0 && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
          Loading versions…
        </p>
      )}

      {!loading && versions.length === 0 && (
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
          No versions yet. Apply a mutation to this surface to start the timeline.
        </p>
      )}

      {/* Timeline */}
      {versions.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            padding: '8px 0',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          }}
        >
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
              onDoubleClick={() => void restore(v.id)}
              title={`v${v.version} — ${v.provenance} — ${formatTime(v.createdAt)}`}
              style={{
                minWidth: 32,
                height: 32,
                background:
                  v.id === selectedId
                    ? `${provColor(v.provenance)}33`
                    : 'var(--bg-elevated, #f8fafc)',
                border: `1px solid ${provColor(v.provenance)}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: provColor(v.provenance),
                padding: '0 4px',
                flexShrink: 0,
              }}
            >
              {v.version}
            </button>
          ))}
        </div>
      )}

      {/* Selected version detail */}
      {selectedId && (() => {
        const v = versions.find((x) => x.id === selectedId);
        if (!v) return null;
        return (
          <div
            style={{
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: 4,
              padding: 10,
              background: 'var(--bg-elevated, #f8fafc)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  padding: '2px 6px',
                  background: `${provColor(v.provenance)}22`,
                  color: provColor(v.provenance),
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {v.provenance}
              </span>
              <strong>v{v.version}</strong>
              <span style={{ fontSize: 10, color: 'var(--text-muted, #64748b)' }}>
                trust: {v.trustWeight}/100
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted, #64748b)' }}>
                {formatTime(v.createdAt)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => void restore(v.id)}
                disabled={restoring}
                style={{
                  padding: '4px 10px',
                  background: 'var(--accent, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 3,
                  cursor: restoring ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  opacity: restoring ? 0.6 : 1,
                }}
              >
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (diffWith && diffWith !== v.id) {
                    void showDiff(diffWith, v.id);
                  } else {
                    setDiffWith(v.id);
                    setDiff(null);
                  }
                }}
                style={{
                  padding: '4px 10px',
                  background: 'transparent',
                  color: 'var(--text-muted, #64748b)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
                title="Pick this version, then pick another to diff"
              >
                {diffWith === v.id ? '✓ Pick 2nd' : 'Diff vs…'}
              </button>
            </div>
            <details>
              <summary style={{ fontSize: 11, cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}>
                Spec JSON
              </summary>
              <pre
                style={{
                  fontSize: 10,
                  background: 'var(--bg-canvas, #ffffff)',
                  padding: 6,
                  borderRadius: 3,
                  overflow: 'auto',
                  maxHeight: 200,
                  margin: '4px 0 0',
                }}
              >
                {v.specJson}
              </pre>
            </details>
          </div>
        );
      })()}

      {/* Diff output */}
      {diff && (
        <div
          style={{
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: 4,
            padding: 8,
            background: 'var(--bg-elevated, #f8fafc)',
            flex: 1,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon name="git" size={12} />
            <strong style={{ fontSize: 11 }}>Diff</strong>
            <button
              type="button"
              onClick={() => setDiff(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
                marginLeft: 'auto',
              }}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
          <pre
            style={{
              fontSize: 10,
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary, #0f172a)',
            }}
          >
            {diff}
          </pre>
        </div>
      )}
    </div>
  );
}
