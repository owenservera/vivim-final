'use client';

/**
 * components/canvas/cards/ShellCard.tsx
 * --------------------------------------------------------------------
 * CLI shell card. The canvas becomes a first-class CLI surface
 * (FRONTEND=BACKEND two-way). The user types a command; the card
 * POSTs to /api/canvas/shell which dispatches through the SAME
 * CommandRegistry the thin CLI client uses.
 *
 * Output streams back as ShellCommandResult. History is kept in
 * component state; the card is itself a sandboxed CanvasDefinition.
 */

import { useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';

interface HistoryEntry {
  command: string;
  result?: {
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    capabilityId?: string;
  };
  pending: boolean;
}

export function ShellCard({ workspaceId }: { workspaceId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      command: 'help',
      pending: false,
      result: {
        ok: true,
        exitCode: 0,
        stdout: 'Type a command above. Try: admin db status, list automations, open video <url>',
        stderr: '',
        durationMs: 0,
      },
    },
  ]);
  const [input, setInput] = useState('');
  const io = useIO();

  const submit = async () => {
    const command = input.trim();
    if (!command) return;
    setInput('');
    const entry: HistoryEntry = { command, pending: true };
    setHistory((h) => [...h, entry]);
    try {
      const res = await io.post<{
        ok: boolean;
        exitCode: number;
        stdout: string;
        stderr: string;
        durationMs: number;
        capabilityId?: string;
      }>('/api/canvas/shell', { command, workspaceId });
      const result = res.data;
      setHistory((h) =>
        h.map((e, i) => (i === h.length - 1 ? { ...e, pending: false, result } : e)),
      );
    } catch (err) {
      setHistory((h) =>
        h.map((e, i) =>
          i === h.length - 1
            ? {
                ...e,
                pending: false,
                result: {
                  ok: false,
                  exitCode: 1,
                  stdout: '',
                  stderr: String(err),
                  durationMs: 0,
                },
              }
            : e,
        ),
      );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--font-mono)',
        background: '#0f172a',
        color: 'var(--text)',
        fontSize: 12,
      }}
    >
      <header
        style={{
          padding: '4px 10px',
          borderBottom: '1px solid var(--border)',
          background: '#1e293b',
          color: 'var(--text-muted)',
          fontSize: 10,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          shell · <code style={{ color: 'var(--text-muted)' }}>{workspaceId}</code>
        </span>
        <span style={{ color: 'var(--text-subtle)' }}>cap:canvas:shell-command</span>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ color: 'var(--accent)' }}>
              <span style={{ color: 'var(--text-subtle)' }}>$</span> {entry.command}
            </div>
            {entry.pending && <div style={{ color: 'var(--text-muted)' }}>…</div>}
            {entry.result && (
              <div style={{ marginTop: 2 }}>
                {entry.result.stdout && (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                    {entry.result.stdout}
                  </pre>
                )}
                {entry.result.stderr && (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-error)' }}>
                    {entry.result.stderr}
                  </pre>
                )}
                <div style={{ color: 'var(--text-subtle)', fontSize: 10, marginTop: 2 }}>
                  exit={entry.result.exitCode} · {entry.result.durationMs}ms
                  {entry.result.capabilityId ? ` · ${entry.result.capabilityId}` : ''}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '6px 8px',
          borderTop: '1px solid var(--border)',
          background: '#1e293b',
          display: 'flex',
          gap: 6,
        }}
      >
        <span style={{ color: 'var(--accent)' }}>$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="type a command, e.g. admin db status"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        />
      </div>
    </div>
  );
}
