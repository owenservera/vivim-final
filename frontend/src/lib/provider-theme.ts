/**
 * lib/provider-theme.ts
 * --------------------------------------------------------------------
 * Canonical source of provider metadata — labels, colors, icons.
 *
 * All provider-themed components should import from here instead of
 * defining their own maps. Adding a new provider requires touching
 * ONLY this file.
 *
 * Harvested from 4 duplicated definitions:
 *   - components/chat/ConversationList.tsx (PROVIDER_LABELS + PROVIDER_COLORS)
 *   - components/chat/ThreadHeader.tsx (PROVIDER_BADGES)
 *   - components/canvas/panels/ConversationsPanel.tsx (PROVIDER_COLORS flat)
 *   - components/canvas/panels/ProvidersPanel.tsx (PROVIDER_COLORS + PROVIDER_ICONS)
 */

export interface ProviderTheme {
  /** Display label (e.g. "ChatGPT") */
  label: string;
  /** CSS color for text/badges (hex) */
  color: string;
  /** CSS background for highlight strips (rgba, ~12-15% opacity) */
  bg: string;
  /** CSS foreground for text on bg (hex, same as color) */
  fg: string;
  /** Emoji icon */
  icon: string;
}

export const PROVIDER_THEME: Record<string, ProviderTheme> = {
  chatgpt: {
    label: 'ChatGPT',
    color: 'rgb(34,197,94)',
    bg: 'rgba(34,197,94,0.15)',
    fg: 'rgb(34,197,94)',
    icon: '🤖',
  },
  claude: {
    label: 'Claude',
    color: 'rgb(249,115,22)',
    bg: 'rgba(249,115,22,0.15)',
    fg: 'rgb(249,115,22)',
    icon: '🧠',
  },
  gemini: {
    label: 'Gemini',
    color: 'rgb(59,130,246)',
    bg: 'rgba(59,130,246,0.15)',
    fg: 'rgb(59,130,246)',
    icon: '✨',
  },
  deepseek: {
    label: 'DeepSeek',
    color: 'rgb(139,92,246)',
    bg: 'rgba(139,92,246,0.15)',
    fg: 'rgb(139,92,246)',
    icon: '🔍',
  },
  qwen: {
    label: 'Qwen',
    color: 'rgb(236,72,153)',
    bg: 'rgba(236,72,153,0.15)',
    fg: 'rgb(236,72,153)',
    icon: '🌐',
  },
  grok: {
    label: 'Grok',
    color: 'rgb(107,114,128)',
    bg: 'rgba(107,114,128,0.15)',
    fg: 'rgb(107,114,128)',
    icon: '⚡',
  },
};

/**
 * Get theme for a provider, with fallback for unknown providers.
 */
export function getProviderTheme(providerId?: string | null): ProviderTheme {
  if (!providerId) return FALLBACK_THEME;
  return PROVIDER_THEME[providerId] ?? FALLBACK_THEME;
}

const FALLBACK_THEME: ProviderTheme = {
  label: 'Unknown',
  color: 'var(--text-muted)',
  bg: 'var(--bg-subtle)',
  fg: 'var(--text-muted)',
  icon: '❓',
};
