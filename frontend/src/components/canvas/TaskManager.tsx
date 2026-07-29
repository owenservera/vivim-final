'use client';

/**
 * components/canvas/TaskManager.tsx
 * --------------------------------------------------------------------
 * Autonomous task controls — execute tasks, list/inspect, gate resolver,
 * cancel/replay, trace viewer. Uses useIO() for /api/autonomous/*.
 * CSS variables only.
 */

import { useEffect, useState, useCallback } from 'react';
import { useIO } from './UnifiedIOProvider';
import { PanelShell } from './PanelShell';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import { SectionLabel } from './SectionLabel';
import { InputField } from './InputField';
import { StatusDot } from './StatusDot';
import { Button } from './Button';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { useToast } from '@/hooks/useToast';

interface AutonomousTask {
  id: string;
  goal: string;
  status: string;
  createdAt: string;
  steps?: Array<{ name: string; status: string; durationMs?: number }>;
}

interface Gate {
  id: string;
  taskId: string;
  prompt: string;
  status: string;
}

export function TaskManager() {
  const io = useIO();
  const { loading, error, run } = useAsyncOperation();
  const [tasks, setTasks] = useState<AutonomousTask[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [goal, setGoal] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [trace, setTrace] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await io.get<{ tasks: AutonomousTask[] }>('/api/autonomous/tasks');
      if (res.ok) setTasks(res.data?.tasks ?? []);
    } catch { /* silent */ }
  }, [io]);

  const fetchGates = useCallback(async () => {
    try {
      const res = await io.get<{ gates: Gate[] }>('/api/autonomous/gates');
      if (res.ok) setGates(res.data?.gates ?? []);
    } catch { /* silent */ }
  }, [io]);

  useEffect(() => {
    fetchTasks();
    fetchGates();
    const t = setInterval(() => { fetchTasks(); fetchGates(); }, 10_000);
    return () => clearInterval(t);
  }, [fetchTasks, fetchGates]);

  const handleExecute = useCallback(async () => {
    if (!goal.trim()) return;
    const res = await run(() => io.post<{ id: string }>('/api/autonomous/execute', { goal: goal.trim() }));
    if (res?.ok) {
      showToast('ok', `Task ${res.data?.id} started`);
      setGoal('');
      fetchTasks();
    }
  }, [goal, io, run, showToast, fetchTasks]);

  const handleResolveGate = useCallback(async (gateId: string) => {
    try {
      const res = await io.post<{ ok: boolean }>(`/api/autonomous/gates/${gateId}/resolve`, { approved: true });
      if (res.ok) { showToast('ok', 'Gate resolved'); fetchGates(); }
    } catch { showToast('err', 'Gate resolve failed'); }
  }, [io, showToast, fetchGates]);

  const handleCancel = useCallback(async (taskId: string) => {
    try {
      const res = await io.post<{ ok: boolean }>(`/api/autonomous/${taskId}/cancel`, {});
      if (res.ok) { showToast('ok', 'Task cancelled'); fetchTasks(); }
    } catch { showToast('err', 'Cancel failed'); }
  }, [io, showToast, fetchTasks]);

  const handleReplay = useCallback(async (taskId: string) => {
    try {
      const res = await io.post<{ ok: boolean }>(`/api/autonomous/${taskId}/replay`, {});
      if (res.ok) { showToast('ok', 'Task replayed'); fetchTasks(); }
    } catch { showToast('err', 'Replay failed'); }
  }, [io, showToast, fetchTasks]);

  const handleShowTrace = useCallback(async (taskId: string) => {
    try {
      const res = await io.get<{ trace: unknown }>(`/api/autonomous/${taskId}/trace`);
      if (res.ok) setTrace(JSON.stringify(res.data?.trace, null, 2));
    } catch { setTrace('Failed to load trace'); }
  }, [io]);

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Task Manager</h2>

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Execute task */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Execute Task</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <InputField
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleExecute(); }}
            placeholder="Describe the autonomous task goal…"
            style={{ flex: 1 }}
          />
          <Button onClick={handleExecute} disabled={!goal.trim() || loading}>
            Run
          </Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {/* Pending gates */}
      {gates.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>Pending Gates ({gates.length})</div>
          {gates.map((g) => (
            <div key={g.id} style={{ padding: 8, background: 'color-mix(in oklch, #f59e0b 8%, var(--bg-elevated))', border: '1px solid #f59e0b', borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
              <div style={{ marginBottom: 4 }}>{g.prompt}</div>
              <button onClick={() => handleResolveGate(g.id)} style={{ padding: '3px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Approve</button>
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      <SectionLabel style={{ marginBottom: 4 }}>Tasks</SectionLabel>
      {tasks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>No tasks yet</div>}
      {tasks.map((t) => (
        <div key={t.id} style={{ padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpandedTask(expandedTask === t.id ? null : t.id)}>
            <StatusDot color={t.status === 'done' ? '#10b981' : t.status === 'running' ? '#3b82f6' : t.status === 'failed' ? '#ef4444' : 'var(--text-muted)'} />
            <span style={{ fontWeight: 600, flex: 1 }}>{t.goal}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t.status}</span>
          </div>
          {expandedTask === t.id && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ID: {t.id}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Created: {new Date(t.createdAt).toLocaleString()}</div>
              {t.steps && t.steps.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {t.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, padding: '2px 0' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'done' ? '#10b981' : s.status === 'running' ? '#3b82f6' : 'var(--text-muted)' }} />
                      <span>{s.name}</span>
                      {s.durationMs !== undefined && <span style={{ color: 'var(--text-subtle)' }}>{s.durationMs}ms</span>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleShowTrace(t.id)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'var(--text)' }}>Trace</button>
                <button onClick={() => handleCancel(t.id)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #ef4444', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#ef4444' }}>Cancel</button>
                <button onClick={() => handleReplay(t.id)} style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #3b82f6', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: '#3b82f6' }}>Replay</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Trace viewer */}
      {trace && (
        <div style={{ marginTop: 12, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Trace</span>
            <button onClick={() => setTrace(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
          <pre style={{ padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>{trace}</pre>
        </div>
      )}
    </PanelShell>
  );
}
