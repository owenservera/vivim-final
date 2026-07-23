'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';

interface Capability {
  id: string;
  slug: string;
  label: string;
  description?: string;
  category?: string;
  surface?: string;
}

export function CapabilityCatalog() {
  const io = useIO();
  const [caps, setCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [executing, setExecuting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ slug: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.get<{ capabilities?: Capability[] } | Capability[]>('/api/capabilities?surface=ui');
      const data = res.data;
      setCaps(Array.isArray(data) ? data : (data?.capabilities ?? []));
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const execute = async (cap: Capability) => {
    setExecuting(cap.id);
    setResult(null);
    try {
      const res = await io.post<{ ok?: boolean }>(`/api/capabilities/${cap.id}/execute`, {});
      const ok = res.data?.ok === true;
      setResult(`${cap.label}: ${ok ? 'OK' : 'failed'} — ${JSON.stringify(res.data).slice(0, 200)}`);
      setToast({ slug: cap.slug, ok });
      setTimeout(() => setToast(null), 2000);
    } catch (e: unknown) {
      setResult(`${cap.label}: error — ${String(e)}`);
      setToast({ slug: cap.slug, ok: false });
      setTimeout(() => setToast(null), 2000);
    } finally {
      setExecuting(null);
    }
  };

  const filtered = search
    ? caps.filter(
        (c) =>
          c.slug.toLowerCase().includes(search.toLowerCase()) ||
          (c.label?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
          (c.description?.toLowerCase() ?? '').includes(search.toLowerCase()),
      )
    : caps;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter capabilities…"
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {filtered.length} / {caps.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ padding: 24, textAlign: 'center', color: '#ef4444', fontSize: 12 }}>
            {error}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
            {search ? 'No capabilities match your filter.' : 'No capabilities available.'}
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 8,
          }}
        >
          {filtered.map((cap) => (
            <div
              key={cap.id}
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <strong style={{ fontSize: 12 }}>{cap.label ?? cap.slug}</strong>
                {cap.category && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {cap.category}
                  </span>
                )}
              </div>
              {cap.description && (
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginBottom: 8,
                  }}
                >
                  {cap.description}
                </p>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <code
                  style={{
                    fontSize: 10,
                    color: 'var(--text-subtle)',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {cap.slug}
                </code>
                <button
                  type="button"
                  onClick={() => execute(cap)}
                  disabled={executing === cap.id}
                  style={{
                    padding: '3px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: 'var(--accent)',
                    color: 'var(--accent-foreground, #fff)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontFamily: 'inherit',
                  }}
                >
                  {executing === cap.id ? '…' : 'Run'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {result && (
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            fontSize: 11,
            color: 'var(--text)',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {result}
          <button
            type="button"
            onClick={() => setResult(null)}
            style={{
              marginLeft: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            padding: '8px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: toast.ok ? '#22c55e' : '#ef4444',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'ui-sans-serif, system-ui',
            zIndex: 1300,
            pointerEvents: 'none',
          }}
        >
          {toast.ok ? '✓' : '✗'} {toast.slug}
        </div>
      )}
    </div>
  );
}
