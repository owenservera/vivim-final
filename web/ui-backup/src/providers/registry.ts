// web/ui/src/providers/registry.ts
// Reusable, plug-and-play adapter layer for chat providers.
//
// Adding a new provider (e.g. deepseek, qwen) is a single registry entry here —
// the chat UI (ChatPage + sub-components) renders every provider through this
// adapter, so no provider-specific component code is needed. Brand, copy, and
// composer hints live in one place.

export interface ProviderChatAdapter {
  /** Provider id as known by the backend (e.g. 'claude'). */
  id: string
  /** Human label shown in the UI. */
  displayName: string
  /** Emoji/icon glyph for the provider switcher. */
  icon: string
  /** Accent color (buttons, active states). */
  brandColor: string
  /** Text color used on brand-colored surfaces. */
  brandText: string
  /** Composer placeholder copy. */
  placeholder: string
  /** Hint shown under the composer. */
  composerHint: string
  /** Provider chat URL (for "open in browser" affordance). */
  url: string
}

// ── Registry ────────────────────────────────────────────────────────────────
// To support a new provider, add one entry below. Everything else is generic.

export const PROVIDER_ADAPTERS: Record<string, ProviderChatAdapter> = {
  claude: {
    id: 'claude',
    displayName: 'Claude',
    icon: '🪨',
    brandColor: '#d97757',
    brandText: '#ffffff',
    placeholder: 'Message Claude…',
    composerHint: 'Enter to send · Claude runs in your logged-in browser session',
    url: 'https://claude.ai/chat',
  },
  chatgpt: {
    id: 'chatgpt',
    displayName: 'ChatGPT',
    icon: '🤖',
    brandColor: '#10a37f',
    brandText: '#ffffff',
    placeholder: 'Message ChatGPT…',
    composerHint: 'Enter to send · ChatGPT runs in your logged-in browser session',
    url: 'https://chatgpt.com',
  },
  gemini: {
    id: 'gemini',
    displayName: 'Gemini',
    icon: '💎',
    brandColor: '#1a73e8',
    brandText: '#ffffff',
    placeholder: 'Message Gemini…',
    composerHint: 'Enter to send · Gemini runs in your logged-in browser session',
    url: 'https://gemini.google.com/app',
  },
}

// ── Accessors ─────────────────────────────────────────────────────────────────

/** Get the adapter for a provider id, falling back to a safe generic adapter. */
export function getProviderAdapter(providerId: string | null | undefined): ProviderChatAdapter {
  if (providerId && PROVIDER_ADAPTERS[providerId]) return PROVIDER_ADAPTERS[providerId]
  return {
    id: providerId ?? 'unknown',
    displayName: providerId ? providerId.charAt(0).toUpperCase() + providerId.slice(1) : 'Provider',
    icon: '💬',
    brandColor: '#6b7280',
    brandText: '#ffffff',
    placeholder: 'Message…',
    composerHint: 'Enter to send',
    url: '#',
  }
}

/** List of adapters, used to render the provider switcher. */
export function listProviderAdapters(): ProviderChatAdapter[] {
  return Object.values(PROVIDER_ADAPTERS)
}
