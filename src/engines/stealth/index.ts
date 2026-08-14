// src/engines/stealth/index.ts
// Phase 11 — Stealth Core barrel.

export type { ExtensionCommand, ExtensionResponse } from './extension-bridge-engine.js'
export { ExtensionBridgeEngine } from './extension-bridge-engine.js'
export type { LaunchMode, LaunchProfile, LaunchProfilePolicy } from './launch-profile-engine.js'
export { LaunchProfileEngine } from './launch-profile-engine.js'
export type { NavigatorPatchConfig } from './navigator-patch-module.js'
export { navigatorPatchConfig, navigatorPatchModule } from './navigator-patch-module.js'

export { registerDefaultStealthModules } from './register-defaults.js'
export type {
  StealthCdpProxy,
  StealthContext,
  StealthModule,
  StealthModuleConfig,
  StealthModuleProfile,
} from './stealth-module.js'
export { StealthModuleEngine } from './stealth-module-engine.js'
