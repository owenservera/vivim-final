'use client';

/**
 * components/canvas/ThemeSettings.tsx
 * --------------------------------------------------------------------
 * Theme settings popover — mode (light/dark/auto) + accent color grid +
 * reduced motion toggle + font scale slider.
 */

import { useState } from 'react';
import { useTheme, ACCENT_COLORS } from './ThemeProvider';

export function ThemeSettings({ onClose }: { onClose?: () => void }) {
  const { pref, setMode, setAccent, setReducedMotion, setFontScale, reset } = useTheme();
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 12,
        width: 280,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: 'var(--shadow)',
        padding: 14,
        zIndex: 100,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>Appearance</strong>
        <button
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          aria-label="Close theme settings"
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={btnStyle}
        >
          
        </button>
      </div>

      <section style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Mode</label>
        <div role="radiogroup" aria-label="Theme mode" style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {(['light', 'dark', 'auto'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={pref.mode === m}
              onClick={() => setMode(m)}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              style={{
                flex: 1,
                padding: '6px 0',
                border: '1px solid',
                borderColor: pref.mode === m ? 'var(--accent)' : 'var(--border)',
                background: pref.mode === m ? 'var(--accent-subtle)' : 'var(--bg)',
                color: 'var(--text)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: pref.mode === m ? 600 : 400,
                fontFamily: 'inherit',
              }}
            >
              {m === 'light' ? '' : m === 'dark' ? '' : ''} {m}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Accent</label>
        <div role="radiogroup" aria-label="Accent color" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginTop: 4 }}>
          {ACCENT_COLORS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={pref.accent === a.id}
              aria-label={a.label}
              onClick={() => setAccent(a.id)}
              className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: pref.accent === a.id ? '3px solid var(--text)' : '3px solid transparent',
                background: a.hex,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 12 }}>
        <label htmlFor="font-scale-slider" style={labelStyle}>Font scale ({pref.fontScale.toFixed(2)}×)</label>
        <input
          id="font-scale-slider"
          type="range"
          min={0.875}
          max={1.25}
          step={0.0625}
          value={pref.fontScale}
          onChange={(e) => setFontScale(Number(e.target.value))}
          aria-label="Font scale"
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{ width: '100%', marginTop: 4, accentColor: 'var(--accent)' }}
        />
      </section>

      <section style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text)',
          }}
        >
          <input
            type="checkbox"
            checked={pref.reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Reduced motion
        </label>
      </section>

      <button
        onClick={reset}
        aria-label="Reset theme to defaults"
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{
          width: '100%',
          padding: '6px 0',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text-muted)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
};
