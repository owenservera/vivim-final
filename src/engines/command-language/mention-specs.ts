import type { UnifiedCommandSpec } from './types.js'

/**
 * `@<provider>` mention specs.
 * Routes messages to specific AI providers.
 */
export const mentionSpecs: UnifiedCommandSpec[] = [
  {
    id: 'mention_claude',
    prefix: '@',
    namespace: 'provider',
    title: 'Claude Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    aliases: ['anthropic'],
    run: async () => ({
      ok: true,
      toast: 'Switched to Claude',
    }),
  },
  {
    id: 'mention_chatgpt',
    prefix: '@',
    namespace: 'provider',
    title: 'ChatGPT Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    aliases: ['gpt', 'openai'],
    run: async () => ({
      ok: true,
      toast: 'Switched to ChatGPT',
    }),
  },
  {
    id: 'mention_gemini',
    prefix: '@',
    namespace: 'provider',
    title: 'Gemini Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    aliases: ['google'],
    run: async () => ({
      ok: true,
      toast: 'Switched to Gemini',
    }),
  },
  {
    id: 'mention_deepseek',
    prefix: '@',
    namespace: 'provider',
    title: 'DeepSeek Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({
      ok: true,
      toast: 'Switched to DeepSeek',
    }),
  },
  {
    id: 'mention_qwen',
    prefix: '@',
    namespace: 'provider',
    title: 'Qwen Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({
      ok: true,
      toast: 'Switched to Qwen',
    }),
  },
  {
    id: 'mention_grok',
    prefix: '@',
    namespace: 'provider',
    title: 'Grok Provider',
    category: 'provider',
    surfaces: ['cli', 'ui', 'api'],
    run: async () => ({
      ok: true,
      toast: 'Switched to Grok',
    }),
  },
]
