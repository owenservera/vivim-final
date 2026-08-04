'use client'

import type { CanvasPalette as CPalette } from '@/canvas/types'
import { useCallback } from 'react'

export interface CanvasPaletteProps {
  palette: CPalette
  onChange: (patch: Partial<CPalette>) => void
  onClose: () => void
}

const PRESET_PALETTES: { name: string; palette: Partial<CPalette> }[] = [
  {
    name: 'Stone (default)',
    palette: {
      background: '#fafaf9',
      surface: '#ffffff',
      surfaceMuted: '#f5f5f4',
      border: '#e7e5e4',
      text: '#1c1917',
      textMuted: '#78716c',
      accent: '#0f172a',
    },
  },
  {
    name: 'Slate Dark',
    palette: {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceMuted: '#334155',
      border: '#475569',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      accent: '#38bdf8',
    },
  },
  {
    name: 'Rose',
    palette: {
      background: '#fff1f2',
      surface: '#ffffff',
      surfaceMuted: '#ffe4e6',
      border: '#fecdd3',
      text: '#1c1917',
      textMuted: '#9f1239',
      accent: '#e11d48',
    },
  },
  {
    name: 'Emerald',
    palette: {
      background: '#ecfdf5',
      surface: '#ffffff',
      surfaceMuted: '#d1fae5',
      border: '#a7f3d0',
      text: '#1c1917',
      textMuted: '#065f46',
      accent: '#059669',
    },
  },
  {
    name: 'Amber',
    palette: {
      background: '#fffbeb',
      surface: '#ffffff',
      surfaceMuted: '#fef3c7',
      border: '#fde68a',
      text: '#1c1917',
      textMuted: '#92400e',
      accent: '#d97706',
    },
  },
]

/**
 * CanvasPalette — preset palette picker + custom color inputs.
 */
export function CanvasPalette({ palette, onChange, onClose }: CanvasPaletteProps) {
  const handlePreset = useCallback(
    (preset: Partial<CPalette>) => {
      onChange(preset)
    },
    [onChange],
  )

  return (
    <div
      role="dialog"
      aria-label="Color palette"
      style={{
        position: 'absolute',
        top: 52,
        right: 136,
        width: 280,
        borderRadius: 10,
        border: `1px solid ${palette.border}`,
        background: palette.surface,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        fontSize: 13,
        color: palette.text,
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: `1px solid ${palette.border}`,
        }}
      >
        <span style={{ fontWeight: 600 }}>Color Palette</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close palette"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: palette.textMuted,
          }}
        >
          ×
        </button>
      </div>

      {/* Presets */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 11, color: palette.textMuted, marginBottom: 6, fontWeight: 500 }}>
          PRESETS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PRESET_PALETTES.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handlePreset(p.palette)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${palette.border}`,
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: palette.text,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: p.palette.background,
                    border: `1px solid ${palette.border}`,
                  }}
                />
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: p.palette.surface,
                    border: `1px solid ${palette.border}`,
                  }}
                />
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: p.palette.accent,
                  }}
                />
              </div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom colors */}
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${palette.border}` }}>
        <div style={{ fontSize: 11, color: palette.textMuted, marginBottom: 6, fontWeight: 500 }}>
          CUSTOM
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(['background', 'surface', 'border', 'text', 'textMuted', 'accent'] as const).map(
            (key) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: palette.textMuted,
                }}
              >
                <input
                  type="color"
                  value={palette[key]}
                  onChange={(e) => onChange({ [key]: e.target.value })}
                  style={{ width: 20, height: 20, border: 'none', padding: 0, cursor: 'pointer' }}
                  aria-label={key}
                />
                <span>{key}</span>
              </label>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
