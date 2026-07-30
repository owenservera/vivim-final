// src/engines/providers/index.ts
// Barrel exports for Provider Platform.
// Phase 8: Convert per-provider logic into a plugin interface.

export { BaseProviderPlugin } from './plugin.js'
export { ProviderRegistry, getProviderRegistry } from './registry.js'
export type { ProviderPlugin, TypingStrategy, AntiDetectionScript, RecoveryProfile, ProviderCapability } from './plugin.js'
export { getBuiltinPlugins, getPluginById } from './plugins/index.js'
export { ChatGPTPlugin } from './plugins/chatgpt.js'
export { ClaudePlugin } from './plugins/claude.js'
export { GeminiPlugin } from './plugins/gemini.js'
