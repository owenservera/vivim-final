'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/shared/api-config';

interface Profile {
  providerId: string;
  accountSlug: string;
  loginState: string;
  profileDir: string;
  debugPort: number;
}

const LOGIN_STATE_COLORS: Record<string, { bg: string; fg: string }> = {
  logged_in: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
  logged_out: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
  unknown: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
};

const PROVIDER_ICONS: Record<string, string> = {
  chatgpt: '🤖',
  claude: '🧠',
  gemini: '✨',
};

interface ProviderManagerProps {
  onClose?: () => void;
}

export function ProviderManager({ onClose }: ProviderManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAddWizard, setShowAddWizard] = useState(false);

  const loadProfiles = useCallback(async () => {
    try {
      const resp = await fetch(getApiUrl('/api/setup/profiles'));
      const data = await resp.json();
      setProfiles(data.profiles ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleRemove = async (providerId: string, accountSlug: string) => {
    try {
      await fetch(getApiUrl(`/api/setup/profiles/${providerId}/${accountSlug}`), {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
    setProfiles((prev) =>
      prev.filter((p) => !(p.providerId === providerId && p.accountSlug === accountSlug)),
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '90vw',
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Provider Accounts</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {profiles.map((p) => {
            const lc = LOGIN_STATE_COLORS[p.loginState] ?? LOGIN_STATE_COLORS.unknown;
            return (
              <div
                key={`${p.providerId}-${p.accountSlug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>
                    {PROVIDER_ICONS[p.providerId] ?? '🌐'}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                      {p.providerId}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {p.accountSlug}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: lc.bg,
                      color: lc.fg,
                      fontWeight: 600,
                    }}
                  >
                    {p.loginState}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(p.providerId, p.accountSlug)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
              No providers configured.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAddWizard(true)}
          style={{
            width: '100%',
            padding: '8px 16px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--accent)',
            color: 'var(--accent-foreground, #fff)',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          + Add Provider
        </button>

        {showAddWizard && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border)',
            }}
          >
            <input
              type="text"
              placeholder="Provider ID (e.g. chatgpt)"
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 12,
                fontFamily: 'inherit',
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddWizard(false)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddWizard(false);
                  loadProfiles();
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: 6,
                  background: 'var(--accent)',
                  color: 'var(--accent-foreground, #fff)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
