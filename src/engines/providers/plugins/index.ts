// src/engines/providers/plugins/index.ts
// Barrel exports for provider plugins.
// Phase 8: Adding a provider requires zero core code changes.

export { ChatGPTPlugin } from './chatgpt.js'
export { ClaudePlugin } from './claude.js'
export { GeminiPlugin } from './gemini.js'

import type { ProviderPlugin } from '../plugin.js'
import { ChatGPTPlugin } from './chatgpt.js'
import { ClaudePlugin } from './claude.js'
import { GeminiPlugin } from './gemini.js'

/**
 * Get all built-in provider plugins.
 */
export function getBuiltinPlugins(): ProviderPlugin[] {
  return [
    new ChatGPTPlugin(),
    new ClaudePlugin(),
    new GeminiPlugin(),
  ]
}

/**
 * Get a plugin by ID.
 */
export function getPluginById(id: string): ProviderPlugin | undefined {
  return getBuiltinPlugins().find((p) => p.id === id)
}
