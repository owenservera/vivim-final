// src/engines/stealth/register-defaults.ts
// 11.2 — Registers the built-in stealth modules.
// P0 modules (always active): navigator_patch, cdp_artifact_cleaner, webgl_spoof.
// P1 modules (opt-in via profile): canvas_noise, audio_context, font_screen, etc.

import { CdpArtifactCleanerModule } from './cdp-artifact-cleaner.js'
import { navigatorPatchModule } from './navigator-patch-module.js'
import type { StealthModuleEngine } from './stealth-module-engine.js'
import { WebGlSpoofModule } from './webgl-spoof-engine.js'

export function registerDefaultStealthModules(engine: StealthModuleEngine): void {
  // P0 — always active, lowest detection risk
  engine.registerModule(navigatorPatchModule)
  engine.registerModule(new CdpArtifactCleanerModule())
  engine.registerModule(new WebGlSpoofModule())
  // P1 — active in "full-stealth" profile (register here, enable per-profile):
  //   engine.registerModule(new CanvasNoiseModule())
  //   engine.registerModule(new AudioContextModule())
  //   engine.registerModule(new FontScreenModule())
  //   engine.registerModule(new ProfileWarmupModule())
  //   engine.registerModule(new NetworkFingerprintModule())
  // P2 — behavioral (register here, enable in "paranoid" profile):
  //   engine.registerModule(new HumanMouseModule())
  //   engine.registerModule(new HumanKeyboardModule())
  //   engine.registerModule(new HumanScrollModule())
  //   engine.registerModule(new BehavioralPatternModule())
}
