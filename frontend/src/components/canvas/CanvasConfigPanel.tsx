'use client'

import type { CanvasConfig } from '@/canvas/types'
import { useState } from 'react'

export interface CanvasConfigPanelProps {
  config: CanvasConfig
  onClose: () => void
  onReset: () => void
}

/**
 * CanvasConfigPanel — floating panel for editing canvas settings.
 * Covers theme, grid, snap, zoom, node defaults, keyboard, persistence.
 */
export function CanvasConfigPanel({ config, onClose, onReset }: CanvasConfigPanelProps) {
  const [tab, setTab] = useState<'visual' | 'viewport' | 'nodes' | 'keyboard' | 'persistence'>(
    'visual',
  )

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 52,
    right: 12,
    width: 320,
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
    borderRadius: 10,
    border: `1px solid ${config.palette.border}`,
    background: config.palette.surface,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    fontSize: 13,
    color: config.palette.text,
    zIndex: 100,
  }

  const tabs = ['visual', 'viewport', 'nodes', 'keyboard', 'persistence'] as const

  return (
    <div style={panelStyle} role="dialog" aria-label="Canvas config">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: `1px solid ${config.palette.border}`,
        }}
      >
        <span style={{ fontWeight: 600 }}>Canvas Settings</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close config"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: config.palette.textMuted,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${config.palette.border}`,
          padding: '0 8px',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: 'none',
              border: 'none',
              borderBottom:
                tab === t ? `2px solid ${config.palette.accent}` : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? config.palette.accent : config.palette.textMuted,
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>
        {tab === 'visual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfigRow label="Grid style" palette={config.palette}>
              <select
                value={config.grid.style}
                onChange={() => {}}
                style={selectStyle(config.palette)}
                aria-label="Grid style"
              >
                <option value="none">None</option>
                <option value="dots">Dots</option>
                <option value="lines">Lines</option>
                <option value="cross">Cross</option>
              </select>
            </ConfigRow>
            <ConfigRow label="Grid size" palette={config.palette}>
              <span>{config.grid.size}px</span>
            </ConfigRow>
            <ConfigRow label="Snap to grid" palette={config.palette}>
              <span>{config.snap.enabled ? 'On' : 'Off'}</span>
            </ConfigRow>
            <ConfigRow label="Theme" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.theme}</span>
            </ConfigRow>
          </div>
        )}

        {tab === 'viewport' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfigRow label="Zoom range" palette={config.palette}>
              <span>
                {(config.zoom.min * 100).toFixed(0)}% – {(config.zoom.max * 100).toFixed(0)}%
              </span>
            </ConfigRow>
            <ConfigRow label="Zoom gesture" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.zoom.wheelMode}</span>
            </ConfigRow>
            <ConfigRow label="Pan mode" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.pan.wheelMode}</span>
            </ConfigRow>
          </div>
        )}

        {tab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfigRow label="Default size" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.nodes.defaultSize}</span>
            </ConfigRow>
            <ConfigRow label="Border radius" palette={config.palette}>
              <span>{config.nodes.borderRadius}px</span>
            </ConfigRow>
            <ConfigRow label="Shadow" palette={config.palette}>
              <span>{config.nodes.shadow ? 'On' : 'Off'}</span>
            </ConfigRow>
            <ConfigRow label="Font size" palette={config.palette}>
              <span>{config.nodes.fontSize}px</span>
            </ConfigRow>
          </div>
        )}

        {tab === 'keyboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfigRow label="Mode" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.keyboard.mode}</span>
            </ConfigRow>
            <ConfigRow label="Leader key" palette={config.palette}>
              <span>{config.keyboard.leaderKey}</span>
            </ConfigRow>
            <div style={{ fontSize: 11, color: config.palette.textMuted, marginTop: 4 }}>
              Bindings:
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.entries(config.keyboard.bindings).map(([action, keys]) => (
                  <div key={action} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{action}</span>
                    <code style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>{keys}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'persistence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfigRow label="Autosave" palette={config.palette}>
              <span>{config.persistence.autosaveMs}ms</span>
            </ConfigRow>
            <ConfigRow label="Format" palette={config.palette}>
              <span style={{ textTransform: 'uppercase' }}>{config.persistence.format}</span>
            </ConfigRow>
            <ConfigRow label="Storage" palette={config.palette}>
              <span style={{ textTransform: 'capitalize' }}>{config.persistence.location}</span>
            </ConfigRow>
            <ConfigRow label="Version history" palette={config.palette}>
              <span>{config.persistence.versionHistory} versions</span>
            </ConfigRow>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: `1px solid ${config.palette.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: `1px solid ${config.palette.border}`,
            background: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: config.palette.textMuted,
          }}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  children,
  palette,
}: {
  label: string
  children: React.ReactNode
  palette: { textMuted: string }
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: palette.textMuted }}>{label}</span>
      {children}
    </div>
  )
}

function selectStyle(palette: { border: string; text: string }): React.CSSProperties {
  return {
    padding: '3px 8px',
    borderRadius: 4,
    border: `1px solid ${palette.border}`,
    background: 'none',
    color: palette.text,
    fontSize: 12,
  }
}
