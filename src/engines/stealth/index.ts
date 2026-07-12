// src/engines/stealth/index.ts
// Phase 11 — Stealth Core barrel.

export { LaunchProfileEngine } from './launch-profile-engine.js'
export type { LaunchProfile, LaunchProfilePolicy, LaunchMode } from './launch-profile-engine.js'

export { StealthModuleEngine } from './stealth-module-engine.js'
export type {
  StealthModule,
  StealthModuleProfile,
  StealthModuleConfig,
  StealthContext,
  StealthCdpProxy,
} from './stealth-module.js'

export { navigatorPatchModule, navigatorPatchConfig } from './navigator-patch-module.js'
export type { NavigatorPatchConfig } from './navigator-patch-module.js'

export { registerDefaultStealthModules } from './register-defaults.js'

export { ExtensionBridgeEngine } from './extension-bridge-engine.js'
export type { ExtensionCommand, ExtensionResponse } from './extension-bridge-engine.js'
