'use client';

/**
 * components/canvas/DevConsole.tsx
 * --------------------------------------------------------------------
 * Developer console overlay showing live IO events, NL injection,
 * latency monitor, and debugging tools.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useIO, useIOEvents } from './UnifiedIOProvider';
import { dispatchBehavior } from '@/shared/dispatch-behavior';
import { Icon } from './Icon';
import { Truncate } from './Truncate';
import { SectionLabel } from './SectionLabel';

interface DevConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_EVENTS = 200;

/** Small local form for sending natural-language injection commands. */
function InjectPanel({ onInject }: { onInject: (text: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setStatus('sending');
    try {
      await onInject(value.trim());
      setStatus('ok');
      setValue('');
      setTimeout(() => setStatus('idle'), 1500);
    } catch {
      setStatus('err');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 540 }}>
      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 2 }}>
        Send a natural-language command to the capability interpreter
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. open settings, send message to claude…"
          disabled={status === 'sending'}
          style={{
            flex: 1,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            background: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={status === 'sending' || !value.trim()}
          style={{
            padding: '4px 12px',
            border: '1px solid var(--border)',
            background: 'var(--secondary)',
            color: 'var(--foreground)',
            borderRadius: 4,
            cursor: status === 'sending' ? 'wait' : 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        >
          {status === 'sending' ? '…' : 'Inject'}
        </button>
      </div>
      {status === 'ok' && <div style={{ fontSize: 10, color: 'var(--color-success)' }}>✓ Dispatched</div>}
      {status === 'err' && <div style={{ fontSize: 10, color: 'var(--color-error)' }}>✗ Failed — check console</div>}
    </form>
  );
}

export function DevConsole({ isOpen, onClose }: DevConsoleProps) {
  const io = useIO();
  const events = useIOEvents();
  const [filter, setFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<ReturnType<typeof useIOEvents>[0] | null>(null);
  // Watermark: events older than this timestamp are hidden after "Clear"
  const [clearedAt, setClearedAt] = useState<number>(0);
  // Active tab (was a static render before — now functional)
  const [activeTab, setActiveTab] = useState<'Events' | 'Latency' | 'Inject'>('Events');
  const logRef = useRef<HTMLDivElement>(null);

  // Track latency from successful requests - useMemo instead of useEffect to avoid setState in effect
  const latencyData = useMemo(() => {
    const reqSuccess = events.filter((e) => e.type === 'request:success');
    return reqSuccess.map((e) => ({
      timestamp: e.timestamp,
      duration: e.durationMs ?? 0,
      url: e.url ?? '',
    })).slice(-50);
  }, [events]);

  const visibleEvents = useMemo(
    () => events.filter((e) => e.timestamp > clearedAt),
    [events, clearedAt],
  );

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return visibleEvents.slice(-MAX_EVENTS);
    const q = filter.toLowerCase();
    return visibleEvents.filter((e) =>
      (e.type ?? '').toLowerCase().includes(q) ||
      (e.url ?? '').toLowerCase().includes(q) ||
      (e.method ?? '').toLowerCase().includes(q) ||
      (e.error ?? '').toLowerCase().includes(q),
    ).slice(-MAX_EVENTS);
  }, [visibleEvents, filter]);

  const clearEvents = () => {
    // Move the watermark to now — no reload needed; avoids losing all app state.
    setClearedAt(Date.now());
    setSelectedEvent(null);
  };

  const injectNL = async (text: string) => {
    try {
      await dispatchBehavior('nl-inject', text, null, io);
    } catch (e) {
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-dev-console="true"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40vh',
        maxHeight: '60vh',
        minHeight: 300,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--secondary)', flexShrink: 0 }}>
        <Icon name="terminal" size={12} className="text-ring" />
        <SectionLabel>Dev Console</SectionLabel>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{filteredEvents.length} / {visibleEvents.length} events</span>
        <label htmlFor="dev-console-filter" className="sr-only">Filter events</label>
        <input
          id="dev-console-filter"
          type="text"
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '2px 8px',
            border: '1px solid var(--border)',
            background: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: 4,
            fontSize: 10,
            fontFamily: 'inherit',
            width: 180,
          }}
        />
        <button onClick={clearEvents} title="Clear" style={{ padding: '2px 6px', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Clear</button>
        <button onClick={onClose} title="Close" style={{ padding: '2px 6px', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--secondary)', flexShrink: 0 }}>
        {(['Events', 'Latency', 'Inject'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '4px 12px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: activeTab === tab ? 700 : 500,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              borderBottom: activeTab === tab ? '2px solid var(--ring)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', minHeight: 0 }}>
        {/* Event Log — only on Events tab */}
        {activeTab === 'Events' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }} className="scrollbar-thin" ref={logRef}>
            {filteredEvents.length === 0 ? (
              <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 24 }}>No events</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--secondary)', zIndex: 1 }}>
                    <th style={{ textAlign: 'left', padding: '2px 6px', color: 'var(--muted-foreground)', width: 80 }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '2px 6px', color: 'var(--muted-foreground)', width: 120 }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '2px 6px', color: 'var(--muted-foreground)' }}>URL</th>
                    <th style={{ textAlign: 'right', padding: '2px 6px', color: 'var(--muted-foreground)', width: 70 }}>Duration</th>
                    <th style={{ textAlign: 'right', padding: '2px 6px', color: 'var(--muted-foreground)', width: 50 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedEvent(e)}
                      style={{
                        cursor: selectedEvent === e ? 'default' : 'pointer',
                        background: selectedEvent === e ? 'color-mix(in oklch, var(--ring) 12%, transparent)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '2px 6px', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(e.timestamp).toLocaleTimeString().slice(0, 8)}.{String(e.timestamp % 1000).padStart(3, '0')}
                      </td>
                      <td style={{ padding: '2px 6px', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
                        <span style={{
                          padding: '1px 4px',
                          borderRadius: 3,
                          fontSize: 9,
                          background: e.type?.startsWith('request:error') || e.type?.startsWith('sse:error') ? 'rgba(239,68,68,0.15)' :
                            e.type?.startsWith('request:success') ? 'rgba(34,197,94,0.15)' :
                            e.type?.startsWith('sse:') ? 'rgba(59,130,246,0.15)' : 'var(--muted)',
                          color: e.type?.startsWith('request:error') || e.type?.startsWith('sse:error') ? 'var(--color-error)' :
                            e.type?.startsWith('request:success') ? 'var(--color-success)' :
                            e.type?.startsWith('sse:') ? 'var(--color-info)' : 'var(--muted-foreground)',
                        }}>
                          {e.type}
                        </span>
                      </td>
                      <td style={{ padding: '2px 6px', color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
                        <Truncate>{e.url ?? ''}</Truncate>
                      </td>
                      <td style={{ padding: '2px 6px', textAlign: 'right', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                        {e.durationMs !== undefined ? `${e.durationMs}ms` : '—'}
                      </td>
                      <td style={{ padding: '2px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {e.status !== undefined ? (
                          <span style={{ color: e.status >= 400 ? 'var(--color-error)' : 'var(--color-success)' }}>{e.status}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Latency sparkline — only on Latency tab */}
        {activeTab === 'Latency' && (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }} className="scrollbar-thin">
            {latencyData.length === 0 ? (
              <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 24 }}>No latency data yet</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: 120, gap: 2, marginBottom: 8 }}>
                  {latencyData.slice(-80).map((d, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${Math.max(4, (d.duration / 2000) * 116)}px`,
                        minHeight: 4,
                        background: d.duration > 1000 ? 'var(--color-error)' : d.duration > 500 ? 'var(--color-warning)' : 'var(--color-success)',
                        borderRadius: '1px 1px 0 0',
                        opacity: 0.8,
                        cursor: 'default',
                      }}
                      title={`${d.url} — ${d.duration}ms`}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)', display: 'flex', gap: 16 }}>
                  <span>Avg: {Math.round(latencyData.reduce((a, b) => a + b.duration, 0) / latencyData.length)}ms</span>
                  <span>P95: {Math.round([...latencyData].sort((a, b) => a.duration - b.duration)[Math.floor(latencyData.length * 0.95)]?.duration ?? 0)}ms</span>
                  <span>Max: {Math.max(...latencyData.map((d) => d.duration))}ms</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* NL Inject — only on Inject tab */}
        {activeTab === 'Inject' && (
          <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
            <InjectPanel onInject={injectNL} />
          </div>
        )}

        {/* Detail Panel — shown alongside Events tab only */}
        {activeTab === 'Events' && selectedEvent && (
          <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--background)', padding: 8, overflow: 'auto' }} className="scrollbar-thin">
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11 }}>Event Details</div>
            <pre style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
            <button onClick={() => setSelectedEvent(null)} style={{ marginTop: 8, padding: '4px 8px', border: '1px solid var(--border)', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Close</button>
          </div>
        )}
      </div>

      {/* Latency footer bar is removed — now lives inside the Latency tab panel above */}
    </div>
  );
}
