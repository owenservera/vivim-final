'use client';

/**
 * components/canvas/panels/SettingsPanel.tsx
 * --------------------------------------------------------------------
 * Settings panel - theme, variant, workspace settings.
 * Minimal, focused on the most common adjustments.
 */

import { useCallback, useState } from 'react';
import { Icon } from '../Icon';
import { useLiveConfig } from '../LiveConfigProvider';
import { useTheme, ACCENT_COLORS } from '../ThemeProvider';

export function SettingsPanel() {
  const { workspaceId, setWorkspace, variant, setVariant } = useLiveConfig();
  const { pref, setMode, setAccent } = useTheme();
  const [draftVariant, setDraftVariant] = useState(variant ?? '');

  const handleSetVariant = useCallback(() => {
    setVariant(draftVariant || undefined);
  }, [draftVariant, setVariant]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 16 }}>
      {/* Theme section */}
      <section>
        <div className="text-label" style={{ marginBottom: 8 }}>Theme</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['light', 'dark', 'auto'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMode(t)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid',
                borderColor: pref.mode === t ? 'var(--ring)' : 'var(--border)',
                borderRadius: 'calc(var(--radius) - 4px)',
                background: pref.mode === t ? 'color-mix(in oklch, var(--ring) 10%, transparent)' : 'var(--background)',
                color: pref.mode === t ? 'var(--ring)' : 'var(--foreground)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Accent color */}
      <section>
        <div className="text-label" style={{ marginBottom: 8 }}>Accent Color</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setAccent(c.id)}
              title={c.label}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: pref.accent === c.id ? '2px solid var(--foreground)' : '2px solid var(--border)',
                background: c.hex,
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
                transform: pref.accent === c.id ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </section>

      {/* Variant */}
      <section>
        <div className="text-label" style={{ marginBottom: 8 }}>Variant</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={draftVariant}
            onChange={(e) => setDraftVariant(e.target.value)}
            placeholder="opus, voice, etc."
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 4px)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSetVariant();
            }}
          />
          <button
            onClick={handleSetVariant}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 4px)',
              background: 'var(--secondary)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>
          Current: {variant ?? 'default'}
        </div>
      </section>

      {/* Workspace */}
      <section>
        <div className="text-label" style={{ marginBottom: 8 }}>Workspace</div>
        <div style={{
          padding: '8px 12px',
          border: '1px solid var(--border)',
          borderRadius: 'calc(var(--radius) - 4px)',
          background: 'var(--background)',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--muted-foreground)',
        }}>
          {workspaceId}
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section style={{ marginTop: 'auto' }}>
        <div className="text-label" style={{ marginBottom: 8 }}>Keyboard Shortcuts</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Command Palette</span>
            <kbd style={{ padding: '1px 5px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, fontFamily: 'var(--font-mono)' }}>Cmd+K</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Toggle Panels</span>
            <kbd style={{ padding: '1px 5px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, fontFamily: 'var(--font-mono)' }}>Cmd+.</kbd>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Dev Console</span>
            <kbd style={{ padding: '1px 5px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, fontFamily: 'var(--font-mono)' }}>Cmd+`</kbd>
          </div>
        </div>
      </section>
    </div>
  );
}
