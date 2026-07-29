'use client';

/**
 * components/canvas/CapabilityCatalog.tsx
 * --------------------------------------------------------------------
 * Searchable grid of capabilities — every registered capability shown
 * with slug, name, category, surfaces, description, and Execute button.
 * Clicking Execute reveals an optional JSON input field.
 * Uses useCapability() SDK hook. CSS variables only (no Tailwind).
 */

import { useEffect, useState, useCallback } from 'react';
import { useCapability } from '@/sdk/web/use-capability';
import type { Capability } from '@/types/api';
import { PanelShell } from './PanelShell';
import { SectionLabel } from './SectionLabel';
import { InputField } from './InputField';
import { TextArea } from './TextArea';
import { Toast } from './Toast';
import { useToast } from '@/hooks/useToast';

export function CapabilityCatalog() {
  const { capabilities, loading, error, refresh, execute } = useCapability();
  const [filter, setFilter] = useState('');
  const { toast, showToast } = useToast();
  const [executingSlug, setExecutingSlug] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  const handleExecute = useCallback(async (cap: Capability) => {
    // If input field is open for this cap, parse and execute
    if (executingSlug === cap.slug) {
      let parsedInput: Record<string, unknown> = {};
      if (inputValue.trim()) {
        try {
          parsedInput = JSON.parse(inputValue);
        } catch {
          showToast('err', 'Invalid JSON input');
          return;
        }
      }
      setExecutingSlug(null);
      setInputValue('');
      const result = await execute(cap.slug, parsedInput);
      if (result?.error) {
        showToast('err', result.error);
      } else {
        showToast('ok', `${cap.slug} executed`);
      }
    } else {
      // Show input field
      setExecutingSlug(cap.slug);
      setInputValue('');
    }
  }, [executingSlug, inputValue, execute, showToast]);

  const filtered = filter
    ? capabilities.filter(
        (c) =>
          c.slug.toLowerCase().includes(filter.toLowerCase()) ||
          c.name.toLowerCase().includes(filter.toLowerCase()) ||
          (c.category ?? '').toLowerCase().includes(filter.toLowerCase()),
      )
    : capabilities;

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Capabilities</h2>

      {/* Toast */}
      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Filter */}
      <InputField
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search capabilities by slug, name, or category…"
        style={{ marginBottom: 12 }}
      />

      {/* Badge count */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        {filtered.length} capabilities
      </div>

      {/* Loading */}
      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>Loading…</div>}

      {/* Error */}
      {error && (
        <div style={{ padding: 16, background: 'color-mix(in oklch, #ef4444 12%, var(--bg-elevated))', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: 12 }}>
          {error}
          <button onClick={refresh} style={{ marginLeft: 8, padding: '2px 8px', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
          {filter ? 'No capabilities match your filter' : 'No capabilities available'}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {filtered.map((cap) => (
          <div key={cap.id} style={{ padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{cap.name || cap.slug}</div>
            {cap.category && (
              <SectionLabel style={{ marginBottom: 4 }}>
                {cap.category}
              </SectionLabel>
            )}
            {cap.description && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>{cap.description}</div>
            )}
            {/* Surface badges */}
            {cap.surfaces && cap.surfaces.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {cap.surfaces.map((s) => (
                  <span key={s} style={{ padding: '1px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{cap.slug}</div>
            {/* Input field (shown when Execute is clicked) */}
            {executingSlug === cap.slug && (
              <div style={{ marginBottom: 6 }}>
                <TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={3}
                  variant="mono"
                  style={{ padding: '4px 6px', fontSize: 10 }}
                />
              </div>
            )}
            <button onClick={() => handleExecute(cap)} style={{ padding: '4px 10px', background: executingSlug === cap.slug ? 'var(--accent-hover, #2563eb)' : 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
              {executingSlug === cap.slug ? 'Confirm' : 'Execute'}
            </button>
            {executingSlug === cap.slug && (
              <button onClick={() => { setExecutingSlug(null); setInputValue(''); }} style={{ marginLeft: 4, padding: '4px 8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
