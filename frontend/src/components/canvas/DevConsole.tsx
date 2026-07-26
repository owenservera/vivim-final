'use client';

/**
 * components/canvas/DevConsole.tsx
 * --------------------------------------------------------------------
 * Developer console overlay showing live IO events, NL injection,
 * latency monitor, and debugging tools.
 */

import { useMemo, useRef, useState } from 'react';
import { useIO, useIOEvents } from './UnifiedIOProvider';
import { Icon, type IconName } from './Icon';

interface DevConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_EVENTS = 200;

export function DevConsole({ isOpen, onClose }: DevConsoleProps) {
  const io = useIO();
  const events = useIOEvents();
  const [filter, setFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<ReturnType<typeof useIOEvents>[0] | null>(null);
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

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return events.slice(-MAX_EVENTS);
    const q = filter.toLowerCase();
    return events.filter((e) =>
      (e.type ?? '').toLowerCase().includes(q) ||
      (e.url ?? '').toLowerCase().includes(q) ||
      (e.method ?? '').toLowerCase().includes(q) ||
      (e.error ?? '').toLowerCase().includes(q),
    ).slice(-MAX_EVENTS);
  }, [events, filter]);

  const clearEvents = () => {
    // Events are read-only from useIOEvents, but we can trigger a re-mount
    window.location.reload();
  };

  const injectNL = async (text: string) => {
    try {
      await io.post('/api/interpret', { nl: text });
    } catch (e) {
      console.error('[DevConsole] NL inject failed:', e);
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
        <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev Console</strong>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{filteredEvents.length} / {events.length} events</span>
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
            onClick={() => { /* tab switching could be added */ }}
            style={{
              padding: '4px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              borderBottom: '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', minHeight: 0 }}>
        {/* Event Log */}
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
                        color: e.type?.startsWith('request:error') || e.type?.startsWith('sse:error') ? '#ef4444' :
                          e.type?.startsWith('request:success') ? '#22c55e' :
                          e.type?.startsWith('sse:') ? '#3b82f6' : 'var(--muted-foreground)',
                      }}>
                        {e.type}
                      </span>
                    </td>
                    <td style={{ padding: '2px 6px', color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                      {e.url ?? ''}
                    </td>
                    <td style={{ padding: '2px 6px', textAlign: 'right', color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
                      {e.durationMs !== undefined ? `${e.durationMs}ms` : '—'}
                    </td>
                    <td style={{ padding: '2px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {e.status !== undefined ? (
                        <span style={{ color: e.status >= 400 ? '#ef4444' : '#22c55e' }}>{e.status}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEvent && (
          <div style={{ width: 320, borderLeft: '1px solid var(--border)', background: 'var(--background)', padding: 8, overflow: 'auto' }} className="scrollbar-thin">
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11 }}>Event Details</div>
            <pre style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
            <button onClick={() => setSelectedEvent(null)} style={{ marginTop: 8, padding: '4px 8px', border: '1px solid var(--border)', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>Close</button>
          </div>
        )}
      </div>

      {/* Latency Chart Footer */}
      {latencyData.length > 0 && (
        <div style={{ height: 60, borderTop: '1px solid var(--border)', padding: '4px 8px', background: 'var(--secondary)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 2 }}>
            {latencyData.slice(-40).map((d, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(4, (d.duration / 2000) * 50)}px`,
                  minHeight: 4,
                  background: d.duration > 1000 ? '#ef4444' : d.duration > 500 ? '#f59e0b' : '#22c55e',
                  borderRadius: '1px 1px 0 0',
                  opacity: 0.8,
                }}
                data-title={`${d.url} — ${d.duration}ms`}
              />
            ))}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 4, display: 'flex', gap: 12 }}>
            <span>Avg: {Math.round(latencyData.reduce((a, b) => a + b.duration, 0) / latencyData.length)}ms</span>
            <span>P95: {Math.round(latencyData.sort((a, b) => a.duration - b.duration)[Math.floor(latencyData.length * 0.95)]?.duration ?? 0)}ms</span>
            <span>Max: {Math.max(...latencyData.map((d) => d.duration))}ms</span>
          </div>
        </div>
      )}
    </div>
  );
}