'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIO } from '@/sdk/web';

interface WorkspaceSettingsData {
  workspacePath: string;
  fleetConfig: {
    portRange: [number, number];
    healthProbeIntervalMs: number;
    autoRestart: boolean;
    maxRestarts: number;
    circuitBreakerThreshold: number;
    circuitBreakerResetMs: number;
  };
  chromeConfig: {
    path?: string;
    extraArgs: string[];
    disableGpu: boolean;
  };
}

const DEFAULTS: WorkspaceSettingsData = {
  workspacePath: 'chrome-profiles',
  fleetConfig: {
    portRange: [9300, 9400],
    healthProbeIntervalMs: 30_000,
    autoRestart: true,
    maxRestarts: 3,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60_000,
  },
  chromeConfig: {
    extraArgs: [],
    disableGpu: false,
  },
};

interface WorkspaceSettingsProps {
  onClose?: () => void;
}

export function WorkspaceSettings({ onClose }: WorkspaceSettingsProps) {
  const io = useIO();
  const [settings, setSettings] = useState<WorkspaceSettingsData>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [workspace, config] = await Promise.all([
        io.get<{ workspacePath?: string }>('/api/setup/workspace'),
        io.get<{ fleetConfig?: Partial<WorkspaceSettingsData['fleetConfig']>; chromeConfig?: Partial<WorkspaceSettingsData['chromeConfig']> }>('/api/config/governor'),
      ]);
      setSettings({
        workspacePath: workspace.data?.workspacePath ?? DEFAULTS.workspacePath,
        fleetConfig: { ...DEFAULTS.fleetConfig, ...(config.data?.fleetConfig ?? {}) },
        chromeConfig: { ...DEFAULTS.chromeConfig, ...(config.data?.chromeConfig ?? {}) },
      });
    } catch {
      // use defaults on error
    } finally {
      setLoading(false);
    }
  }, [io]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await io.request('/api/setup/workspace', {
        method: 'POST',
        body: { path: settings.workspacePath },
      });
      await io.request('/api/config/governor', {
        method: 'PUT',
        body: {
          fleetConfig: settings.fleetConfig,
          chromeConfig: settings.chromeConfig,
        },
      });
      onClose?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const updateFC = <K extends keyof WorkspaceSettingsData['fleetConfig']>(
    key: K,
    value: WorkspaceSettingsData['fleetConfig'][K],
  ) => {
    setSettings((s) => ({ ...s, fleetConfig: { ...s.fleetConfig, [key]: value } }));
  };

  if (loading) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Loading…
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Workspace Settings</h2>
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

      {/* Profile directory */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Profile Directory
        </label>
        <input
          type="text"
          value={settings.workspacePath}
          onChange={(e) => setSettings((s) => ({ ...s, workspacePath: e.target.value }))}
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        />
        <p style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          Chrome profiles: {settings.workspacePath}/{'{provider}'}/{'{account}'}/
        </p>
      </div>

      {/* Fleet config */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Fleet Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Port Range Start">
            <input
              type="number"
              value={settings.fleetConfig.portRange[0]}
              onChange={(e) =>
                updateFC('portRange', [Number(e.target.value), settings.fleetConfig.portRange[1]])
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Port Range End">
            <input
              type="number"
              value={settings.fleetConfig.portRange[1]}
              onChange={(e) =>
                updateFC('portRange', [settings.fleetConfig.portRange[0], Number(e.target.value)])
              }
              style={inputStyle}
            />
          </Field>
          <Field label="Health Probe (ms)">
            <input
              type="number"
              value={settings.fleetConfig.healthProbeIntervalMs}
              onChange={(e) => updateFC('healthProbeIntervalMs', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Max Restarts">
            <input
              type="number"
              value={settings.fleetConfig.maxRestarts}
              onChange={(e) => updateFC('maxRestarts', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Circuit Breaker Threshold">
            <input
              type="number"
              value={settings.fleetConfig.circuitBreakerThreshold}
              onChange={(e) => updateFC('circuitBreakerThreshold', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Circuit Breaker Reset (ms)">
            <input
              type="number"
              value={settings.fleetConfig.circuitBreakerResetMs}
              onChange={(e) => updateFC('circuitBreakerResetMs', Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.fleetConfig.autoRestart}
              onChange={(e) => updateFC('autoRestart', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Auto-restart crashed Chrome instances
          </label>
        </div>
      </div>

      {/* Chrome config */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Chrome Configuration</h3>
        <Field label="Chrome Binary Path (optional)">
          <input
            type="text"
            value={settings.chromeConfig.path ?? ''}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                chromeConfig: { ...s.chromeConfig, path: e.target.value || undefined },
              }))
            }
            placeholder="Auto-detect"
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
        </Field>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.chromeConfig.disableGpu}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  chromeConfig: { ...s.chromeConfig, disableGpu: e.target.checked },
                }))
              }
              style={{ accentColor: 'var(--accent)' }}
            />
            Disable GPU
          </label>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            padding: '8px 16px',
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
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            background: 'var(--accent)',
            color: 'var(--accent-foreground, #fff)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
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
          width: 520,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          padding: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 12,
};
