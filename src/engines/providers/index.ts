// src/engines/providers/index.ts
// Barrel exports for Provider Platform.
// Phase 8: Convert per-provider logic into a plugin interface.
// WP-03: Added unified provider plugin interface exports.

// ── Unified Provider Plugin Interface (WP-03) ────────────────────────────
export { AbstractProviderPlugin } from './abstract-provider-plugin.js'
export type {
  AntiDetectionScript,
  ProviderCapability,
  ProviderPlugin as LegacyProviderPlugin,
  RecoveryProfile,
  TypingStrategy,
} from './plugin.js'
// ── Legacy Provider Interface (Phase 8) ──────────────────────────────────
export { BaseProviderPlugin } from './plugin.js'
export {
  getProviderPluginRegistry,
  ProviderPluginRegistry,
  resetProviderPluginRegistry,
} from './plugin-registry.js'
export { ChatGPTPlugin } from './plugins/chatgpt.js'
export { ClaudePlugin } from './plugins/claude.js'
export { GeminiPlugin } from './plugins/gemini.js'
export { getBuiltinPlugins, getPluginById } from './plugins/index.js'
export type {
  HealthCheckResult,
  ProviderCapabilityDescriptor,
  ProviderHealthStatus,
  ProviderMetadata,
  ProviderPlugin,
  ProviderPluginContext,
  ProviderPluginFactory,
  ProviderPluginManifest,
} from './provider-plugin-interface.js'
export { getProviderRegistry, ProviderRegistry } from './registry.js'
