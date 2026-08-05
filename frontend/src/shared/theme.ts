/**
 * shared/theme.ts
 * --------------------------------------------------------------------
 * #4 Theme System — types for dark/light/auto + accent colors.
 * Persisted to localStorage; CSS variables drive the UI.
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

export type AccentColor =
  | 'amber' // default (matches v2)
  | 'rose'
  | 'emerald'
  | 'sky'
  | 'violet'
  | 'slate';

export interface ThemePreference {
  mode: ThemeMode;
  accent: AccentColor;
  /** Reduced motion preference (accessibility). */
  reducedMotion: boolean;
  /** Font scale (1.0 = default, 0.875 = compact, 1.125 = comfortable). */
  fontScale: number;
  /** High contrast mode (accessibility). Increases border and text contrast. */
  highContrast: boolean;
}

export const DEFAULT_THEME: ThemePreference = {
  mode: 'light',
  accent: 'amber',
  reducedMotion: false,
  fontScale: 1.0,
  highContrast: false,
};

export const ACCENT_COLORS: Array<{ id: AccentColor; label: string; hex: string }> = [
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'slate', label: 'Slate', hex: '#64748b' },
];

/** CSS variable name → value map for a given theme. */
export interface ThemeTokens {
  '--bg': string;
  '--bg-elevated': string;
  '--bg-subtle': string;
  '--border': string;
  '--border-strong': string;
  '--text': string;
  '--text-muted': string;
  '--text-subtle': string;
  '--accent': string;
  '--accent-fg': string;
  '--accent-subtle': string;
  '--shadow': string;
  '--font-scale': string;
}

export function resolveTokens(pref: ThemePreference, systemDark: boolean): ThemeTokens {
  const dark = pref.mode === 'dark' || (pref.mode === 'auto' && systemDark);
  const accent = ACCENT_COLORS.find((a) => a.id === pref.accent) ?? ACCENT_COLORS[0]!;
  const hc = pref.highContrast;
  if (dark) {
    return {
      '--bg': hc ? '#000000' : '#0f172a',
      '--bg-elevated': hc ? '#0a0a0a' : '#1e293b',
      '--bg-subtle': hc ? '#000000' : '#0f172a',
      '--border': hc ? '#404040' : '#1e293b',
      '--border-strong': hc ? '#606060' : '#334155',
      '--text': hc ? '#ffffff' : '#e2e8f0',
      '--text-muted': hc ? '#d4d4d4' : '#94a3b8',
      '--text-subtle': hc ? '#a3a3a3' : '#64748b',
      '--accent': accent.hex,
      '--accent-fg': '#0f172a',
      '--accent-subtle': `${accent.hex}22`,
      '--shadow': '0 8px 32px -8px rgba(0,0,0,0.6)',
      '--font-scale': String(pref.fontScale),
    };
  }
  return {
    '--bg': hc ? '#ffffff' : '#fafafa',
    '--bg-elevated': hc ? '#f5f5f5' : '#ffffff',
    '--bg-subtle': hc ? '#ffffff' : '#f3f4f6',
    '--border': hc ? '#000000' : '#e5e7eb',
    '--border-strong': hc ? '#404040' : '#d1d5db',
    '--text': hc ? '#000000' : '#1f2937',
    '--text-muted': hc ? '#333333' : '#6b7280',
    '--text-subtle': hc ? '#555555' : '#9ca3af',
    '--accent': accent.hex,
    '--accent-fg': '#ffffff',
    '--accent-subtle': `${accent.hex}1a`,
    '--shadow': '0 8px 32px -8px rgba(0,0,0,0.18)',
    '--font-scale': String(pref.fontScale),
  };
}
