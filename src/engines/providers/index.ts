// src/engines/providers/index.ts
// Barrel exports for Provider Platform.
// Phase 8: Convert per-provider logic into a plugin interface.
// WP-03: Added unified provider plugin interface exports.

// ── Legacy Provider Interface (Phase 8) ──────────────────────────────────
export { BaseProviderPlugin } from './plugin.js'
export { ProviderRegistry, getProviderRegistry } from './registry.js'
export type {
  ProviderPlugin as LegacyProviderPlugin,
  TypingStrategy,
  AntiDetectionScript,
  RecoveryProfile,
  ProviderCapability,
} from './plugin.js'
export { getBuiltinPlugins, getPluginById } from './plugins/index.js'
export { ChatGPTPlugin } from './plugins/chatgpt.js'
export { ClaudePlugin } from './plugins/claude.js'
export { GeminiPlugin } from './plugins/gemini.js'

// ── Unified Provider Plugin Interface (WP-03) ────────────────────────────
export { AbstractProviderPlugin } from './abstract-provider-plugin.js'
export {
  ProviderPluginRegistry,
  getProviderPluginRegistry,
  resetProviderPluginRegistry,
} from './plugin-registry.js'
export type {
  ProviderPlugin,
  ProviderPluginFactory,
  ProviderPluginManifest,
  ProviderMetadata,
  ProviderPluginContext,
  ProviderCapabilityDescriptor,
  HealthCheckResult,
  ProviderHealthStatus,
} from './provider-plugin-interface.js'
