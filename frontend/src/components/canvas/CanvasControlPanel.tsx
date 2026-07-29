'use client';

/**
 * components/canvas/CanvasControlPanel.tsx
 * --------------------------------------------------------------------
 * Mutation controls — undo/redo, DSL input, history list.
 * Uses useMutation() SDK hook. CSS variables only.
 */

import { useEffect, useState, useCallback } from 'react';
import { useMutation } from '@/sdk/web/use-mutation';
import { PanelShell } from './PanelShell';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import { TextArea } from './TextArea';
import { Truncate } from './Truncate';
import { SectionLabel } from './SectionLabel';
import { useToast } from '@/hooks/useToast';

export function CanvasControlPanel() {
  const { status, history, loading, error, apply, preview, undo, redo, refreshStatus, refreshHistory } = useMutation({ pollStatus: true, pollMs: 5000 });
  const [dsl, setDsl] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => { refreshStatus(); refreshHistory(); }, [refreshStatus, refreshHistory]);

  const handleApply = useCallback(async () => {
    if (!dsl.trim()) return;
    const result = await apply({ dsl: dsl.trim() });
    if (result.ok) {
      showToast('ok', 'Mutation applied');
      setDsl('');
    } else {
      showToast('err', result.error);
    }
  }, [dsl, apply, showToast]);

  const handlePreview = useCallback(async () => {
    if (!dsl.trim()) return;
    const result = await preview({ dsl: dsl.trim() });
    if (result.ok) {
      setPreviewResult(JSON.stringify(result.entries, null, 2));
    } else {
      setPreviewResult(`Error: ${result.error}`);
    }
  }, [dsl, preview]);

  const handleUndo = useCallback(async () => {
    const result = await undo();
    if (result.ok) showToast('ok', 'Undone');
    else showToast('err', result.error);
  }, [undo, showToast]);

  const handleRedo = useCallback(async () => {
    const result = await redo();
    if (result.ok) showToast('ok', 'Redone');
    else showToast('err', result.error);
  }, [redo, showToast]);

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Mutation Controls</h2>

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 11 }}>
        <span style={{ color: 'var(--text-muted)' }}>History: {status.historyLength}</span>
        <span style={{ color: status.canUndo ? 'var(--text)' : 'var(--text-subtle)' }}>Can Undo: {status.canUndo ? '✓' : '—'}</span>
        <span style={{ color: status.canRedo ? 'var(--text)' : 'var(--text-subtle)' }}>Can Redo: {status.canRedo ? '✓' : '—'}</span>
      </div>

      {/* Undo/Redo buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={handleUndo} disabled={!status.canUndo || loading} style={{ ...btnStyle, opacity: status.canUndo && !loading ? 1 : 0.4 }}>Undo</button>
        <button onClick={handleRedo} disabled={!status.canRedo || loading} style={{ ...btnStyle, opacity: status.canRedo && !loading ? 1 : 0.4 }}>Redo</button>
      </div>

      {/* DSL input */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>DSL Input</div>
        <TextArea
          value={dsl}
          onChange={(e) => setDsl(e.target.value)}
          placeholder="Enter mutation DSL…"
          rows={4}
          variant="mono"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handleApply} disabled={!dsl.trim() || loading} style={btnStyle}>Apply</button>
        <button onClick={handlePreview} disabled={!dsl.trim() || loading} style={{ ...btnStyle, background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}>Preview</button>
      </div>

      {/* Preview result */}
      {previewResult && (
        <div style={{ padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', marginBottom: 16, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
          {previewResult}
        </div>
      )}

      {/* History */}
      <SectionLabel style={{ marginBottom: 4 }}>History</SectionLabel>
      {history.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No mutations yet</div>}
      {history.slice(0, 20).map((h) => (
        <div key={h.id} style={{ padding: '4px 8px', background: 'var(--bg-elevated)', border: `1px solid var(--border)`, borderLeft: `3px solid ${h.ok ? '#10b981' : '#ef4444'}`, borderRadius: 4, fontSize: 10, marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>{new Date(h.appliedAt).toLocaleTimeString()}</span>
          <Truncate style={{ flex: 1 }}>{h.mutation.op ?? 'mutation'}</Truncate>
          <span style={{ color: h.ok ? '#10b981' : '#ef4444', fontSize: 9 }}>{h.ok ? 'OK' : 'FAIL'}</span>
        </div>
      ))}

      <ErrorBanner error={error} style={{ marginTop: 8 }} />
    </PanelShell>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 12px', background: 'var(--accent)', color: 'var(--accent-fg)',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  fontWeight: 600, fontFamily: 'inherit',
};
