'use client';

/**
 * components/canvas/ThemeProvider.tsx (#4)
 * --------------------------------------------------------------------
 * Theme System — dark/light/auto + 6 accent colors + reduced motion +
 * font scale. Persisted to localStorage. CSS variables drive the UI.
 *
 * Smooth transitions: a 200ms transition on `background-color`, `color`,
 * and `border-color` is applied to the root <html> element.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemePreference, ThemeMode, AccentColor } from '../../shared/theme';
import { DEFAULT_THEME, ACCENT_COLORS, resolveTokens } from '../../shared/theme';

const STORAGE_KEY = 'vivim.theme';

interface ThemeContextValue {
  pref: ThemePreference;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setReducedMotion: (v: boolean) => void;
  setFontScale: (scale: number) => void;
  reset: () => void;
  isDark: boolean;
}

const Ctx = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePreference>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ThemePreference>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPref({ ...DEFAULT_THEME, ...parsed });
      }
    } catch {
      // ignore corrupt storage
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Persist + apply CSS variables.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
    } catch {
      // ignore
    }
    const tokens = resolveTokens(pref, systemDark);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) {
      root.style.setProperty(k, v);
    }
    root.style.setProperty('font-size', `${16 * pref.fontScale}px`);
    root.dataset.theme = pref.mode;
    root.dataset.accent = pref.accent;
    root.dataset.reducedMotion = pref.reducedMotion ? '1' : '0';
  }, [pref, systemDark]);

  const setMode = useCallback((mode: ThemeMode) => setPref((p) => ({ ...p, mode })), []);
  const setAccent = useCallback((accent: AccentColor) => setPref((p) => ({ ...p, accent })), []);
  const setReducedMotion = useCallback((reducedMotion: boolean) => setPref((p) => ({ ...p, reducedMotion })), []);
  const setFontScale = useCallback((fontScale: number) => setPref((p) => ({ ...p, fontScale })), []);
  const reset = useCallback(() => setPref(DEFAULT_THEME), []);

  const isDark = pref.mode === 'dark' || (pref.mode === 'auto' && systemDark);

  const value = useMemo<ThemeContextValue>(
    () => ({ pref, setMode, setAccent, setReducedMotion, setFontScale, reset, isDark }),
    [pref, setMode, setAccent, setReducedMotion, setFontScale, reset, isDark],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}

export { ACCENT_COLORS };
