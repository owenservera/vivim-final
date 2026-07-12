// web/sandbox/src/features/workspace-settings.tsx
// Unit 6.6 — Workspace settings: profile paths, fleet config, ports.

import { useEffect, useState } from 'react'

interface WorkspaceSettings {
  workspacePath: string
  fleetConfig: {
    portRange: [number, number]
    healthProbeIntervalMs: number
    autoRestart: boolean
    maxRestarts: number
    circuitBreakerThreshold: number
    circuitBreakerResetMs: number
  }
  chromeConfig: {
    path?: string
    extraArgs: string[]
    disableGpu: boolean
  }
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
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
}

export function WorkspaceSettings({ onClose }: { onClose?: () => void }) {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/setup/workspace').then((r) => r.json()),
      fetch('/api/config/governor').then((r) => r.json()),
    ])
      .then(([workspace, config]) => {
        setSettings({
          workspacePath: workspace.workspacePath ?? DEFAULT_SETTINGS.workspacePath,
          fleetConfig: { ...DEFAULT_SETTINGS.fleetConfig, ...(config.fleetConfig ?? {}) },
          chromeConfig: { ...DEFAULT_SETTINGS.chromeConfig, ...(config.chromeConfig ?? {}) },
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/setup/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: settings.workspacePath }),
      })
      await fetch('/api/config/governor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleetConfig: settings.fleetConfig,
          chromeConfig: settings.chromeConfig,
        }),
      })
      onClose?.()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Workspace Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>

        {/* Workspace path */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Profile Directory</label>
          <input
            type="text"
            value={settings.workspacePath}
            onChange={(e) => setSettings((s) => ({ ...s, workspacePath: e.target.value }))}
            className="w-full px-3 py-2 border rounded font-mono text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Chrome profiles: {settings.workspacePath}/{'{provider}'}/{'{account}'}/
          </p>
        </div>

        {/* Fleet config */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Fleet Configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Port Range Start</label>
              <input
                type="number"
                value={settings.fleetConfig.portRange[0]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fleetConfig: {
                      ...s.fleetConfig,
                      portRange: [Number(e.target.value), s.fleetConfig.portRange[1]],
                    },
                  }))
                }
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Port Range End</label>
              <input
                type="number"
                value={settings.fleetConfig.portRange[1]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fleetConfig: {
                      ...s.fleetConfig,
                      portRange: [s.fleetConfig.portRange[0], Number(e.target.value)],
                    },
                  }))
                }
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Health Probe (ms)</label>
              <input
                type="number"
                value={settings.fleetConfig.healthProbeIntervalMs}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fleetConfig: { ...s.fleetConfig, healthProbeIntervalMs: Number(e.target.value) },
                  }))
                }
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Max Restarts</label>
              <input
                type="number"
                value={settings.fleetConfig.maxRestarts}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fleetConfig: { ...s.fleetConfig, maxRestarts: Number(e.target.value) },
                  }))
                }
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>
          <div className="mt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.fleetConfig.autoRestart}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    fleetConfig: { ...s.fleetConfig, autoRestart: e.target.checked },
                  }))
                }
              />
              Auto-restart crashed Chrome instances
            </label>
          </div>
        </div>

        {/* Chrome config */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Chrome Configuration</h3>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Chrome Binary Path (optional)</label>
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
              className="w-full px-3 py-2 border rounded font-mono text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-gray-600 border rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
