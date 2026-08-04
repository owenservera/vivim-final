'use client';

import { useCallback, useEffect, useState } from 'react';
import { useIO } from '@/sdk/web';
import { Form } from '@/components/ui/form';
import { ValidatedField } from '@/components/ui/ValidatedField';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';
import { WorkspaceSettingsFormData, workspaceSettingsSchema } from '@/schema/forms';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface WorkspaceSettingsProps {
  onClose?: () => void;
}

export function WorkspaceSettings({ onClose }: WorkspaceSettingsProps) {
  const io = useIO();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<WorkspaceSettingsFormData>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: {
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
        path: '',
        extraArgs: [],
        disableGpu: false,
      },
    },
    mode: 'onChange',
  });

  const load = useCallback(async () => {
    try {
      const [workspace, config] = await Promise.all([
        io.get<{ workspacePath?: string }>('/api/setup/workspace'),
        io.get<{ fleetConfig?: Partial<WorkspaceSettingsFormData['fleetConfig']>; chromeConfig?: Partial<WorkspaceSettingsFormData['chromeConfig']> }>('/api/config/governor'),
      ]);
      form.reset({
        workspacePath: workspace.data?.workspacePath ?? 'chrome-profiles',
        fleetConfig: { ...form.getValues('fleetConfig'), ...(config.data?.fleetConfig ?? {}) },
        chromeConfig: { ...form.getValues('chromeConfig'), ...(config.data?.chromeConfig ?? {}) },
      });
    } catch {
      // use defaults on error
    } finally {
      setLoading(false);
    }
  }, [io, form]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    setSaving(true);
    try {
      await io.request('/api/setup/workspace', {
        method: 'POST',
        body: { path: form.getValues('workspacePath') },
      });
      await io.request('/api/config/governor', {
        method: 'PUT',
        body: {
          fleetConfig: form.getValues('fleetConfig'),
          chromeConfig: form.getValues('chromeConfig'),
        },
      });
      onClose?.();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
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

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormErrorSummary />

          <ValidatedField
            form={form}
            name="workspacePath"
            label="Profile Directory"
            helpText="Chrome profiles: {workspacePath}/{provider}/{account}/"
          />

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Fleet Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ValidatedField
                form={form}
                name="fleetConfig.portRange.0"
                label="Port Range Start"
              />
              <ValidatedField
                form={form}
                name="fleetConfig.portRange.1"
                label="Port Range End"
              />
              <ValidatedField
                form={form}
                name="fleetConfig.healthProbeIntervalMs"
                label="Health Probe (ms)"
              />
              <ValidatedField
                form={form}
                name="fleetConfig.maxRestarts"
                label="Max Restarts"
              />
              <ValidatedField
                form={form}
                name="fleetConfig.circuitBreakerThreshold"
                label="Circuit Breaker Threshold"
              />
              <ValidatedField
                form={form}
                name="fleetConfig.circuitBreakerResetMs"
                label="Circuit Breaker Reset (ms)"
              />
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.watch('fleetConfig.autoRestart')}
                  onChange={(e) => form.setValue('fleetConfig.autoRestart', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Auto-restart crashed Chrome instances
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Chrome Configuration</h3>
            <ValidatedField
              form={form}
              name="chromeConfig.path"
              label="Chrome Binary Path (optional)"
              helpText="Leave empty to auto-detect"
            />
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.watch('chromeConfig.disableGpu')}
                  onChange={(e) => form.setValue('chromeConfig.disableGpu', e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Disable GPU
              </label>
            </div>
          </div>

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
        </form>
      </Form>
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
