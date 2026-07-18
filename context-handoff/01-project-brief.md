# Project Brief: vivim-final

**vivim-final** is cap-store v1 Knowledge Graph Rebuild — a local-first AI conversation platform built with Bun + Prisma + TypeScript.

## Runtime & Stack
- **Runtime:** Bun
- **Language:** TypeScript (strict mode, ESNext target)
- **ORM:** Prisma v6.5
- **Database:** SQLite (local-first)
- **Linter/Formatter:** Biome
- **Git Hooks:** Lefthook
- **Testing:** Bun test runner
- **Build:** tsup (ESM + DTS)

## Architecture Layers (13 Engines)

| Layer | Engines |
|-------|---------|
| L0-L1 | Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel) |
| L2-L3 | Capability System (CapabilityResolutionEngine, CapabilityEngine) |
| L4 | Session & State (ConversationManager, StreamBlockStore) |
| Chrome Layer | ChromeGovernor (CDP proxy, lifecycle, trace, health) |
| Cross-cutting | CapabilityEventBus, ConfigManager, StreamParserEngine |
| Lifecycle | RegistrationAuditor, VersionManager, TelemetryAggregator |

## Design Docs
- `docs/merged-design-v2/` — Read docs 00-08 for v1, then SOTA-00 through SOTA-09
- `docs/atomic/00-master-plan.md` — 243 atomic units across 22 phases
- `docs/atomic/01-tracker.md` — Live status: 219 done, 3 pending, 3 blocked

## One Entry Point (v10 Invariant)
Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that call:
- `POST /api/interpret` → `POST /api/capabilities/:id/execute`

## Critical Boundaries
1. **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
3. **Research-First:** No implementation without research report classification.