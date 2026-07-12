# Phase 9: Sovereign Data & Local-First

**Status:** PROPOSED
**Units:** 9
**Depends on:** Phase 1
**Produces:** Encryption-at-rest for sensitive data, multi-device sync, airgap-by-default, and full offline operation.

---

## Goal

The sovereign-data engines exist (`EncryptionEngine`, `ExportEngine`, `AirGapEngine`, `SyncEngine`, `LocalModelAdapter`, `TelemetryAudit`) but are opt-in and largely unwired. Phase 9 makes local-first the **default** and adds encryption-at-rest for sensitive columns so the entire SQLite DB is safe to sync across devices.

---

## Units

### 9.1 Encryption-at-rest for sensitive columns
**Source:** v3 Overview §1.10
**Depends on:** —
**Produces:** `provider_config.config_value` (when `is_secret=1`), `mux_response.response`, `provenance_node.cdpParamsJson` (when sensitive) stored encrypted.

`EncryptionEngine` (existing AES-256-GCM + PBKDF2) wraps individual field values. Master key derived from user passphrase on startup; locked when idle > N minutes. New Prisma middleware intercepts reads/writes of encrypted fields transparently.

### 9.2 Database-level encryption option (SQLCipher)
**Source:** v3 Overview §1.10
**Depends on:** 9.1
**Produces:** Alternative to field-level encryption: full-DB encryption via SQLCipher (or sqlite-wasm encryption extension).

User chooses at first run: field-level (selective, slower per query) or full-DB (transparent, requires `PRAGMA key`). ADR-002 documents the trade-off.

### 9.3 Multi-device sync v2
**Source:** v3 Overview §1.10
**Depends on:** 9.1
**Produces:** `SyncEngine` actually syncs across devices via a relay; conflict resolution via last-write-wins + manual queue.

Each device pairs via 6-digit code (existing). Changes recorded in `sync_log`. Periodic sync pushes encrypted log entries to relay, pulls peer entries, applies in chronological order. Conflicts (same record modified on two devices) go to a manual resolution queue.

### 9.4 Airgap-by-default
**Source:** v3 Overview §1.10
**Depends on:** 5.1, 5.8
**Produces:** Fresh install defaults to `airgap_enabled: true`; cloud providers require explicit consent.

`config.defaultAirgap = true` for new installs. `ProviderConsent` required before any cloud provider is used. `AirGapEngine` probes for local Ollama on first run; if found, set as default provider; if not, prompt user to install or opt into cloud.

### 9.5 Offline-capable autonomous execution
**Source:** v3 Overview §1.10
**Depends on:** 9.4
**Produces:** Autonomous tasks run on local models without network.

Local-model provider (from Phase 5) participates in autonomous execution. LLM-backed planning (Phase 7) uses local model by default; cloud models only if explicitly chosen per-task.

### 9.6 Encrypted export v2
**Source:** v3 Overview §1.10
**Depends on:** 9.1
**Produces:** `ExportEngine.export` produces an encrypted bundle including canvas definitions, memory, conversations, agents.

Single `.vivim` file (zip + AES-256-GCM). Contains: SQLite snapshot, canvas templates, memory graph, agent runs. Restorable on a fresh install.

### 9.7 Backup scheduling
**Source:** v3 Overview §1.10
**Depends on:** 9.6
**Produces:** `AutomationSchedule` for periodic encrypted backups to a user-chosen directory.

Default: daily 02:00 to `{dataDir}/backups/vivim-{date}.vivim`. Retention 30 days. User can configure interval + destination + retention.

### 9.8 Device pairing UX
**Source:** v3 Overview §1.10
**Depends on:** 9.3
**Produces:** In-app device pairing flow (canvas-based).

Show pairing code on device A; user enters on device B; keys exchanged; sync starts. Status surface shows paired devices + last sync time + pending entries.

### 9.9 Telemetry audit zero-cloud proof
**Source:** v3 Overview §1.10
**Depends on:** 8.4, 8.5
**Produces:** User can generate a "zero-cloud proof" report certifying no outbound calls were made.

Distinct from the daily audit report: this is on-demand, signed, and produces a one-page summary suitable for compliance. Includes: time range, hosts contacted (should be empty), network call count, device signature.

---

## Acceptance

- Fresh install with no internet works end-to-end (chat with local Ollama, memory, autonomous tasks).
- After 7 days of usage, encrypted backup is <100MB.
- Pairing two devices completes within 30s; subsequent sync within 10s.
- Sensitive columns (API keys, secrets) are unreadable in the raw SQLite file without the passphrase.
- Zero-cloud proof report for an offline week is verifiable by an independent party.
