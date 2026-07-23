'use client';

/**
 * components/canvas/WorkspaceSwitcher.tsx
 * --------------------------------------------------------------------
 * Workspace switcher. Lists the global workspace + children. Switching
 * re-couples routeSyncWorkspace under a new traceId and emits
 * `workspace:switched` → SSE → canvas re-resolves.
 *
 * Phase 2 §2: "There is ALWAYS a global workspace. Users can create
 * child workspaces. All workspaces are viewable from a workspace
 * switcher."
 */

import { useEffect, useState } from 'react';
import type { WorkspaceTaxonomy } from '../../shared/workspace';

export interface WorkspaceSwitcherProps {
  currentWorkspaceId: string;
  onSwitch: (workspaceId: string) => void;
  /** Optional onCreate — if provided, shows a "+ New workspace" button. */
  onCreate?: () => void;
}

export function WorkspaceSwitcher({
  currentWorkspaceId,
  onSwitch,
  onCreate,
}: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceTaxonomy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/workspace/list')
      .then((r) => r.json())
      .then((data: { ok: boolean; workspaces: WorkspaceTaxonomy[] }) => {
        if (!cancelled && data.ok) {
          setWorkspaces(data.workspaces);
        }
      })
      .catch(() => {
        // network error — keep the empty list
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: 11,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        Workspaces
      </div>
      {loading && <div style={{ color: '#9ca3af' }}>Loading…</div>}
      {workspaces.map((ws) => {
        const isCurrent = ws.id === currentWorkspaceId;
        return (
          <button
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            style={{
              padding: '4px 8px',
              border: '1px solid',
              borderColor: isCurrent ? '#fbbf24' : '#e5e7eb',
              background: isCurrent ? '#fffbeb' : 'white',
              borderRadius: 4,
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
              color: '#374151',
            }}
          >
            <div style={{ fontWeight: isCurrent ? 600 : 400 }}>
              {ws.displayName}
              {ws.kind === 'global' && (
                <span style={{ color: '#9ca3af', marginLeft: 4 }}>(global)</span>
              )}
            </div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>
              z={ws.zDepth} · {ws.surfaces.length} surfaces
            </div>
          </button>
        );
      })}
      {onCreate && (
        <button
          onClick={onCreate}
          style={{
            padding: '4px 8px',
            border: '1px dashed #d1d5db',
            background: 'transparent',
            borderRadius: 4,
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
            color: '#6b7280',
          }}
        >
          + New workspace
        </button>
      )}
    </div>
  );
}
