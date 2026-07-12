> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-11: Stealth Core Architecture

**Phase:** 11 | **Units:** 4 | **Goal:** Re-programmable multi-mode launch + pluggable module system

## Problem

The current launcher hardcodes a single launch mode with bot-signal args. There's no way to switch between attach/extension/cdp modes, no module registry, no per-provider stealth config.

## Architecture: Three Independent Engines

```
┌─────────────────────────────────────────────────────────────┐
│                     FleetSupervisor                          │
│  spawn(provider, account)                                   │
│    → LaunchProfileEngine.resolve(providerId)                │
│      → returns LaunchProfile { mode, args, stealthProfileId }│
│    → launchChrome(profile.args) OR attachToExisting(port)   │
│    → StealthModuleEngine.applyProfile(slaveId, profileId)   │
│      → iterates active modules, injects via CDP             │
│    → return ChromeSlave                                     │
└─────────────────────────────────────────────────────────────┘
```

Each engine is independently usable:

| Engine | Responsibility | Used Standalone? |
|--------|---------------|-----------------|
| LaunchProfileEngine | Select launch mode + args | Yes — any caller can resolve a profile |
| StealthModuleEngine | Apply modules to a running Chrome | Yes — can apply modules to any CDP-connected Chrome |
| StealthProfileStore | Persist profile/module config in DB | Yes — CRUD for profiles |
| ExtensionBridgeEngine | Extension-based interaction (no CDP) | Yes — alternative to CDP entirely |

## Units

| Unit | Title | Engine |
|------|-------|--------|
| 11.1 | LaunchProfileEngine | `src/engines/launch-profile-engine.ts` |
| 11.2 | StealthModuleEngine | `src/engines/stealth-module-engine.ts` |
| 11.3 | StealthProfile store | `src/storage/contracts/stealth-store.ts` |
| 11.4 | ExtensionBridgeEngine | `src/engines/extension-bridge-engine.ts` |

