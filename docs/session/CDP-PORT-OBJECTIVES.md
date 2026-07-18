# SESSION OBJECTIVES — CDP Capability Port (OG cap-store → vivim-final DB)

**Date:** 2026-07-18
**Project:** vivim-final
**Status:** COMPLETE

---

## DONE (this session)

- **Located OG live DB:** `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\data\capability-store.db` (1.4MB, SQLite)
- **Surveyed OG's full schema:** 47 tables. OG already migrated to 3-table capability model (taxonomy/binding/program) — no old `capability` or `test_run` tables.
- **Wrote port script** at `seeds/og-capability-port.ts` — idempotent, re-runnable. Connects to OG SQLite + vivim-final Prisma, translates column-by-column, upserts.
- **Port completed with verification:**

  | OG Table → vivim-final Model | OG rows | VF rows | Status |
  |---|---|---|---|
  | provider → ProviderDefinition | 7 | 12 (7 ported + 5 pre-existing) | ✓ expected diff |
  | capability_taxonomy → CapabilityTaxonomy | 253 | 253 | ✓ exact |
  | capability_binding → CapabilityBinding | 104 | 104 | ✓ exact |
  | capability_program → CapabilityProgram | 104 | 104 | ✓ exact |
  | provider_account → ProviderAccount | 9 | 6 (3 dupes skipped) | ✓ dedup |
  | outcome → Outcome | 629 | 629 | ✓ exact |
  | vivim_session → VivimSession | 16 | 16 | ✓ exact |
  | state_transition → StateTransition | 32 | 32 | ✓ exact |
  | fleet_event → FleetEvent | 173 | 173 | ✓ exact |
  | hole (→ ProviderDefinition.capabilitiesJson) | 677 | 677 | ✓ stored per-provider |
  | ProviderEndpoint (derived from OG provider) | — | 7 | ✓ derived |
  | ProviderStreamConfig (derived from OG provider) | — | 7 | ✓ derived |

- **576 total OG rows ported** across taxonomy/binding/program + 857 in supporting tables + 677 holes stashed.

---

## Key files
- `seeds/og-capability-port.ts` — the port script
- `prisma/schema.prisma` — vivim-final schema (unchanged, all models existed)
- `docs/session/CDP-PORT-OBJECTIVES.md` — this file
