// src/engines/stealth/stealth-profile-store.ts
// Unit 11.3 — Stealth profile store contract (re-export from canonical).
// Engines depend on this contract; implementations live in storage/impl/.

export type {
  LaunchMode,
  LaunchProfileRow,
  ModuleProfileRow,
  StealthPolicyRow,
  StealthProfileStore,
} from '../../storage/contracts/stealth-store.js'
