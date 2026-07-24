'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWsUrl } from '@/sdk/backend-client';

type Tab = 'events' | 'inject' | 'latency';

interface FirehoseEvent {
  _seq: number;
  _ts: number;
  type: string;
  [key: string]: unknown;
}

interface LatencySample {
  capabilityId: string;
  latencyMs: number;
  traceId: string;
}

const LATENCY_BUDGETS: Record<string, number> = {
  resolve: 100,
  recall: 200,
  ensure: 3000,
  type: 200,
  submit: 100,
  capture: 60000,
  parse: 100,
  store: 50,
};

interface DevConsoleProps {
  open: boolean;
  onClose: () => void;
}

function wsUrl(): string {
  return getWsUrl();
}

function eventColor(type: string): string {
  if (type.includes('error') || type.includes('failed')) return '#ef4444';
  if (type.includes('complete') || type.includes('created')) return '#22c55e';
  if (type.includes('drift') || type.includes('degraded')) return '#f59e0b';
  return 'var(--accent)';
}

export function DevConsole({ open, onClose }: DevConsoleProps) {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<FirehoseEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('');
  const seqRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const [injectText, setInjectText] = useState('');
  const [injectResult, setInjectResult] = useState('');
  const [injectBusy, setInjectBusy] = useState(false);
  const [latency, setLatency] = useState<LatencySample[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new events
  useEffect(() => {
    if (tab === 'events' && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [events, tab]);

  // Firehose WS connection
  useEffect(() => {
    if (!open) return;
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: 'hello', sessionId: `dev-${Date.now()}`, role: 'frontend' }),
      );
      ws.send(JSON.stringify({ type: 'dev:subscribe' }));
      setConnected(true);
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === 'dev:subscribed') return;
      const fe = { _seq: seqRef.current++, _ts: Date.now(), ...msg } as FirehoseEvent;
      setEvents((prev) => {
        const next = prev.length > 500 ? prev.slice(prev.length - 500) : prev;
        return [...next, fe];
      });
      if (msg.type === 'capability:executed') {
        setLatency((prev) => [
          ...prev.slice(-99),
          {
            capabilityId: String(msg.capabilityId ?? '?'),
            latencyMs: Number(msg.latencyMs ?? 0),
            traceId: String(msg.traceId ?? ''),
          },
        ]);
      }
    };
    return () => {
      try {
        ws.send(JSON.stringify({ type: 'dev:unsubscribe' }));
      } catch {}
      ws.close();
      wsRef.current = null;
    };
  }, [open]);

  const sendInject = useCallback(async () => {
    const text = injectText.trim();
    if (!text) return;
    setInjectBusy(true);
    setInjectResult('');
    try {
      const resp = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await resp.json();
      setInjectResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setInjectResult(`ERROR: ${(err as Error).message}`);
    } finally {
      setInjectBusy(false);
    }
  }, [injectText]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return events;
    const f = filter.toLowerCase();
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(f));
  }, [events, filter]);

  const avgLatency = useMemo(() => {
    if (!latency.length) return 0;
    return Math.round(latency.reduce((s, l) => s + l.latencyMs, 0) / latency.length);
  }, [latency]);

  if (!open) return null;

  const tabs: Tab[] = ['events', 'inject', 'latency'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '44rem',
          maxWidth: '92vw',
          height: '100%',
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'ui-sans-serif, system-ui',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <strong style={{ fontSize: 13 }}>Dev Console</strong>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              background: connected ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: connected ? '#22c55e' : '#ef4444',
              fontWeight: 600,
            }}
          >
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {events.length} events
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  borderRadius: 4,
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? 'var(--accent-foreground, #fff)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              title="Close (Ctrl+`)"
              style={{
                padding: '3px 8px',
                border: 'none',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Events tab */}
        {tab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="filter events…"
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 11,
                  fontFamily: 'ui-monospace, monospace',
                }}
              />
            </div>
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                padding: 6,
              }}
            >
              {filtered.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-subtle)' }}>
                  No events yet — drive the system.
                </div>
              )}
              {filtered.map((e) => (
                <div
                  key={e._seq}
                  style={{
                    display: 'flex',
                    gap: 6,
                    padding: '2px 4px',
                    borderRadius: 2,
                  }}
                >
                  <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>
                    {new Date(e._ts).toLocaleTimeString()}
                  </span>
                  <span style={{ color: eventColor(e.type), flexShrink: 0 }}>
                    {e.type}
                  </span>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(stripMeta(e)).slice(0, 200)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inject tab */}
        {tab === 'inject' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              padding: 10,
              gap: 8,
            }}
          >
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Send raw text to <code style={{ color: 'var(--text)' }}>POST /api/interpret</code>.
            </p>
            <textarea
              value={injectText}
              onChange={(e) => setInjectText(e.target.value)}
              placeholder="e.g. list providers"
              rows={3}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                resize: 'none',
              }}
            />
            <button
              type="button"
              onClick={sendInject}
              disabled={injectBusy}
              style={{
                alignSelf: 'flex-start',
                padding: '4px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--accent)',
                color: 'var(--accent-foreground, #fff)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              {injectBusy ? 'Sending…' : 'Inject →'}
            </button>
            <pre
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 8,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                whiteSpace: 'pre-wrap',
              }}
            >
              {injectResult || '—'}
            </pre>
          </div>
        )}

        {/* Latency tab */}
        {tab === 'latency' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 10, gap: 8, overflow: 'auto' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Avg exec latency:{' '}
              <span style={{ color: avgLatency > 1000 ? '#ef4444' : '#22c55e' }}>
                {avgLatency}ms
              </span>{' '}
              over {latency.length} samples
            </div>
            {latency
              .slice()
              .reverse()
              .map((l, i) => {
                const over = l.latencyMs > 1000;
                const pct = Math.min(100, Math.round((l.latencyMs / 3000) * 100));
                return (
                  <div key={`${l.traceId}-${i}`} style={{ fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.capabilityId}
                      </span>
                      <span style={{ color: over ? '#ef4444' : 'var(--text-muted)', flexShrink: 0 }}>
                        {l.latencyMs}ms
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: 'var(--border)',
                        borderRadius: 2,
                        marginTop: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 2,
                          background: over ? '#ef4444' : '#22c55e',
                          transition: 'width 0.2s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            <div
              style={{
                marginTop: 8,
                borderTop: '1px solid var(--border)',
                paddingTop: 6,
                fontSize: 10,
                color: 'var(--text-subtle)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Budgets:{' '}
              {Object.entries(LATENCY_BUDGETS)
                .map(([k, v]) => `${k}≤${v}`)
                .join('  ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function stripMeta(e: FirehoseEvent): Record<string, unknown> {
  const { _seq, _ts, ...rest } = e;
  return rest;
}
