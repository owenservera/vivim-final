// src/engines/stealth/register-defaults.ts
// 11.2 — Registers the built-in stealth modules. Phase 11 ships navigator_patch;
// Phase 12 (canvas_noise), Phase 13 (webgl_spoof), Phase 14 (ua_spoof) register
// their own modules when those phases land.

import { navigatorPatchModule } from './navigator-patch-module.js'
import type { StealthModuleEngine } from './stealth-module-engine.js'

export function registerDefaultStealthModules(engine: StealthModuleEngine): void {
  engine.registerModule(navigatorPatchModule)
  // Phase 12-14 modules register themselves on their respective phases:
  //   engine.registerModule(canvasNoiseModule)
  //   engine.registerModule(webglSpoofModule)
  //   engine.registerModule(uaSpoofModule)
}
