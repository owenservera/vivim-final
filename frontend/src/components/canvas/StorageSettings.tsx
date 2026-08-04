'use client';

/**
 * components/canvas/StorageSettings.tsx
 * --------------------------------------------------------------------
 * Data storage settings panel — shows current location, disk usage,
 * change location with progress, rollback, and cleanup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBase } from '@/lib/ws-url';

// ── Types ──────────────────────────────────────────────────────────────────

interface StorageBreakdown {
  database: number;
  chromeProfiles: number;
  parserCache: number;
  logs: number;
  other: number;
}

interface StorageStatus {
  dataDir: string;
  dbPath: string;
  profileBaseDir: string;
  totalBytes: number;
  breakdown: StorageBreakdown;
  archivedLocations: Array<{ path: string; archivedAt: number; sizeBytes: number }>;
}

interface MigrationProgress {
  phase: string;
  sourceDir: string;
  targetDir: string;
  totalBytes: number;
  copiedBytes: number;
  fileCount: number;
  copiedFiles: number;
  startedAt: number;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function StorageSettings() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [moving, setMoving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await apiFetch<StorageStatus>('/api/storage/status');
      setStatus(s);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProgress = useCallback(async () => {
    try {
      const p = await apiFetch<MigrationProgress>('/api/storage/progress');
      setProgress(p);
      if (p.phase === 'done' || p.phase === 'failed' || p.phase === 'rolled_back' || p.phase === 'idle') {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setMoving(false);
        fetchStatus();
      }
    } catch {
      // non-fatal
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleMove = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', 'true');
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Extract directory path from the first file's webkitRelativePath
      const relativePath = file.webkitRelativePath || file.name;
      const dirName = relativePath.split('/')[0];
      // Use the API to trigger relocation — user provides path via prompt
      const targetDir = prompt('Enter the full path for the new data directory:');
      if (!targetDir) return;

      setMoving(true);
      setError(null);
      try {
        await apiFetch('/api/storage/move', {
          method: 'POST',
          body: JSON.stringify({ targetDir }),
        });
        // Start polling for progress
        pollRef.current = setInterval(fetchProgress, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMoving(false);
      }
    });
    input.click();
  }, [fetchProgress]);

  const handleRollback = useCallback(async () => {
    if (!confirm('Revert to the previous data location?')) return;
    try {
      setMoving(true);
      await apiFetch('/api/storage/rollback', { method: 'POST' });
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setMoving(false);
    }
  }, [fetchStatus]);

  const handleCleanup = useCallback(async () => {
    if (!confirm('Delete old archived data? This cannot be undone.')) return;
    try {
      const result = await apiFetch<{ cleaned: string[]; count: number }>('/api/storage/cleanup', {
        method: 'POST',
      });
      alert(`Cleaned up ${result.count} archived location(s)`);
      fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchStatus]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
        Loading storage info…
      </div>
    );
  }

  if (error && !status) {
    return (
      <div style={errorBoxStyle}>
        {error}
        <button onClick={fetchStatus} style={retryBtnStyle}>Retry</button>
      </div>
    );
  }

  const usedPct = status ? Math.min(100, (status.totalBytes / (1024 * 1024 * 1024)) * 100) : 0;

  return (
    <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui', color: 'var(--text)' }}>
      {/* Error banner */}
      {error && (
        <div style={{ ...errorBoxStyle, marginBottom: 12 }}>
          {error}
          <button onClick={() => setError(null)} style={retryBtnStyle}>Dismiss</button>
        </div>
      )}

      {/* Migration progress */}
      {progress && progress.phase !== 'idle' && progress.phase !== 'done' && (
        <div style={progressBoxStyle}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Migration: {progress.phase}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 8 }}>
            {progress.phase === 'copy' && (
              <>
                {formatBytes(progress.copiedBytes)} / {formatBytes(progress.totalBytes)} copied
                ({progress.copiedFiles} / {progress.fileCount} files)
              </>
            )}
            {progress.phase === 'verify' && 'Verifying file integrity…'}
            {progress.phase === 'switch' && 'Switching database connection…'}
            {progress.phase === 'preflight' && 'Validating target location…'}
            {progress.error && <span style={{ color: 'var(--color-error)' }}> — {progress.error}</span>}
          </div>
          {progress.phase === 'copy' && progress.totalBytes > 0 && (
            <div style={progressBarTrackStyle}>
              <div
                style={{
                  ...progressBarFillStyle,
                  width: `${Math.min(100, (progress.copiedBytes / progress.totalBytes) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Current location */}
      {status && (
        <>
          <div style={cardStyle}>
            <div style={labelStyle}>Location</div>
            <div style={{ fontSize: 13, wordBreak: 'break-all', marginBottom: 8 }}>
              {status.dataDir}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
              {formatBytes(status.totalBytes)} used
            </div>
          </div>

          {/* Breakdown */}
          <div style={cardStyle}>
            <div style={labelStyle}>Storage Breakdown</div>
            {Object.entries(status.breakdown).map(([key, bytes]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                <span>{formatBytes(bytes)}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button onClick={handleMove} disabled={moving} style={primaryBtnStyle}>
              {moving ? 'Moving…' : 'Change Location'}
            </button>
            {status.archivedLocations.length > 0 && (
              <button onClick={handleRollback} disabled={moving} style={secondaryBtnStyle}>
                Rollback
              </button>
            )}
            {status.archivedLocations.length > 0 && (
              <button onClick={handleCleanup} disabled={moving} style={dangerBtnStyle}>
                Cleanup Old Data
              </button>
            )}
          </div>

          {/* Archived locations */}
          {status.archivedLocations.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 12 }}>
              <div style={labelStyle}>Archived Locations</div>
              {status.archivedLocations.map((loc) => (
                <div key={loc.path} style={{ fontSize: 12, marginBottom: 4 }}>
                  <div style={{ wordBreak: 'break-all' }}>{loc.path}</div>
                  <div style={{ color: 'var(--text-subtle)' }}>
                    {formatBytes(loc.sizeBytes)} — archived {new Date(loc.archivedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-subtle)',
  marginBottom: 8,
};

const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--color-error-surface)',
  border: '1px solid var(--color-error)',
  borderRadius: 8,
  color: 'var(--color-error)',
  fontSize: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const progressBoxStyle: React.CSSProperties = {
  padding: 12,
  background: 'var(--color-info-surface)',
  border: '1px solid var(--color-info)',
  borderRadius: 8,
  marginBottom: 12,
};

const progressBarTrackStyle: React.CSSProperties = {
  height: 6,
  background: 'var(--border)',
  borderRadius: 3,
  overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  background: 'var(--color-info)',
  borderRadius: 3,
  transition: 'width 0.3s ease',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
};

const dangerBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--color-error-surface)',
  color: 'var(--color-error)',
  border: '1px solid var(--color-error)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
};

const retryBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  background: 'transparent',
  color: 'inherit',
  border: '1px solid currentColor',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
};
