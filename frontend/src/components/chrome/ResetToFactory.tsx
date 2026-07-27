'use client';

/**
 * components/chrome/ResetToFactory.tsx
 * --------------------------------------------------------------------
 * Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Self-Modifying Chrome.
 *
 * "Reset to Factory" action that restores all chrome surfaces to the
 * canonical-chrome.json seed. The action:
 *   1. fetches /api/chrome/factory (returns the seed specs)
 *   2. applies a `replace` mutation for each chrome surface via /api/mutation/apply
 *   3. emits a 'chrome:reset' event so any in-flight UI can refresh
 *
 * The action is wired into the MainMenu (Phase 9 §11) and is also
 * triggerable via ⌘⇧R (handled in ChromeSurface for the Composer only;
 * this component is the global reset).
 *
 * CONTRACT_VERSION: 1
 */

import { useCallback, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { Icon } from '@/components/canvas/Icon';

export interface ResetToFactoryProps {
  /** Called after a successful reset. */
  onReset?: () => void;
  /** Variant: 'menu-item' renders a button styled for a dropdown menu; 'button' renders a standalone button. */
  variant?: 'menu-item' | 'button';
}

interface FactorySpec {
  id: string;
  spec: unknown;
}

export function ResetToFactory({
  onReset,
  variant = 'button',
}: ResetToFactoryProps) {
  const io = useIO();
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reset = useCallback(async () => {
    setResetting(true);
    setError(null);
    setStatus(null);
    try {
      // 1. Fetch the canonical chrome seed.
      const factoryRes = await io.get<{
        ok: boolean;
        surfaces?: FactorySpec[];
        error?: string;
      }>('/api/chrome/factory');
      if (!factoryRes.data?.ok || !factoryRes.data.surfaces) {
        setError(factoryRes.data?.error ?? 'Failed to load factory seed');
        return;
      }

      // 2. Build a mutation plan: one `replace` per chrome surface.
      const mutations = factoryRes.data.surfaces.map((s) => ({
        op: 'replace' as const,
        target: s.id,
        provenance: 'system' as const,
        payload: s.spec,
        reason: 'Reset to factory chrome',
        idempotencyKey: `factory-reset-${s.id}-${Date.now()}`,
      }));

      // 3. Apply the plan.
      const applyRes = await io.post<{ ok: boolean; error?: string }>(
        '/api/mutation/apply',
        {
          plan: {
            id: `factory-reset-${Date.now()}`,
            mutations,
            provenance: 'system',
            description: 'Reset to factory chrome',
          },
        },
      );
      if (!applyRes.data?.ok) {
        setError(applyRes.data?.error ?? 'Reset failed');
        return;
      }

      setStatus(`Reset ${mutations.length} chrome surfaces.`);
      window.dispatchEvent(new CustomEvent('vivim:chrome-reset'));
      onReset?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setResetting(false);
    }
  }, [io, onReset]);

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={() => void reset()}
        disabled={resetting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '5px 10px',
          border: 'none',
          background: 'transparent',
          color: resetting ? 'var(--text-subtle)' : 'var(--text)',
          cursor: resetting ? 'default' : 'pointer',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'inherit',
          textAlign: 'left',
          opacity: resetting ? 0.6 : 1,
        }}
      >
        <Icon name="refresh" size={13} />
        <span style={{ flex: 1 }}>{resetting ? 'Resetting…' : 'Reset to Factory'}</span>
        {error && (
          <span style={{ fontSize: 10, color: '#ef4444' }} title={error}>!</span>
        )}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={() => void reset()}
        disabled={resetting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'transparent',
          color: 'var(--text-primary, #0f172a)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: 4,
          cursor: resetting ? 'not-allowed' : 'pointer',
          fontSize: 12,
          opacity: resetting ? 0.6 : 1,
        }}
      >
        <Icon name="refresh" size={12} />
        {resetting ? 'Resetting…' : 'Reset to Factory'}
      </button>
      {status && (
        <span style={{ fontSize: 11, color: '#22c55e' }}>{status}</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>
      )}
    </div>
  );
}
