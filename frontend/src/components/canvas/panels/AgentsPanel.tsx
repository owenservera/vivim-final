'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { useIO } from '../UnifiedIOProvider';

export interface AgentsPanelProps {
  workspaceId?: string;
}

export function AgentsPanel({ workspaceId }: AgentsPanelProps) {
  const [agents, setAgents] = useState<Array<{ name: string; status: string; steps: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const io = useIO();

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    io.get<{ ok: boolean; agents: Array<{ name: string; status: string; steps: unknown[] }> }>(`/api/agent/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((res) => {
        if (res.data?.ok) setAgents(res.data.agents.map((a) => ({ name: a.name, status: a.status, steps: a.steps.length })));
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [workspaceId, io]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Agents</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>Loading agents…</div>}
        {error && <div style={{ padding: 12, fontSize: 11, color: 'var(--destructive)' }}>{error}</div>}
        {!loading && !error && agents.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
            No agents in this workspace.
          </div>
        )}
        {!loading && !error && agents.map((a, i) => (
          <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text)' }}>
            <span style={{ fontWeight: 500 }}>{a.name}</span>{' '}
            <span style={{ color: 'var(--muted-foreground)' }}>• {a.steps} steps • {a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
