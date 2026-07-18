# SESSION OBJECTIVES — CDP Capability Port (OG cap-store → vivim-final DB)

**Date:** 2026-07-18
**Project:** vivim-final (C:\0-BlackBoxProject-0\vivim-final)
**Reference:** vivim-app-og cap-store (C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store)
**Mode:** Build — wiring + DB data port (no frontend)
**Current phase:** RESEARCH/DESIGN for a full OG→final DB data port

---

## 0. ORIGINAL CONCEPT (user's 3-stage model)
```
DB REGISTERED CDP Action → mapped to PROVIDER (only AFTER discovery + testing)
  → SLAVE executes (from CLI / backend API / UI)
```
Each stage has a hard gate: register → map+gate → execute.

---

## 1. PRIOR WORK ALREADY DONE (committed in HEAD b38751a)

The 3 integration seams (G1/G2/G3) were closed in a PRIOR session and ARE in the committed tree:

### G1 — CDP registration in live boot (`src/server/index.ts`)
- After `registerDefaultCapabilities` + `registerGeneratedCapabilities`, the full offline
  `CDP_PROTOCOL_CATALOG` (96+ commands) is registered as `cap:cdp:*` capabilities via
  `registerDiscoveredCdpMethods(registry, CDP_PROTOCOL_CATALOG, { executeCdp, providerId:'generic', bindingStore })`.
- `executeCdp` routes to `governor.executeCdpMethod(ref, method, params)` (ref from ctx).
- Inline `CdpBindingStore` upserts `capabilityTaxonomy` + `capabilityBinding` rows against `generic`.

### G2 — Provider binding + D2 light gate (`src/engines/cdp-capability-registrar.ts`)
- New `CdpBindingStore` contract (Store-Contract compliant, no Prisma import in engine).
- `registerDiscoveredCdpMethods` accepts `providerId`, `bindingStore`, `verified?: { confidence }`.
- D2 gate: verified method → `active`+confidence; boot/unverified → `prospect`.
- Capability carries provider scope in `tags` (`provider:<id>`).
- Relaxed: registration never throws on persistence failure.

### G3 — Governor execution (`src/engines/chrome-governor.ts`)
- `executeCdpMethod(ref, cdpMethod, params, resolver?)` — resolves slave (conv→provider→running slave, else spawn, else generic browser), fires real CDP via `CDPProxy.send` (Governor Canon), records `TraceEntry`.
- `executeCapability(ref, slug, opts?)` — router-facing; reads CDP fullName from capability id `cap:cdp:Runtime.evaluate`, forwards request body as CDP params.

### G4 — Router + tests (`src/server/conversation-router.ts`, `tests/integration/engines/cdp-execution.test.ts`)
- `POST /api/conversations/:id/capabilities/:slug/execute` passes body params + conversation→provider resolver + registry `capabilityLookup` into `governor.executeCapability`.
- Graceful degrade only when transport unconfigured.
- 4 passing G4 tests: registers all catalog cmds; writes binding row per cmd (`prospect`); executes returns REAL result (not `dispatched`); unknown slug throws.

### Verification state (confirmed this session)
- `bun run typecheck` → clean.
- `bun test tests/integration/engines/cdp-execution.test.ts` → 4 pass.
- `bun test` (unit chrome-governor/registrar/discovery) → 41 pass.
- `bunx biome check` on changed files → clean (only pre-existing `index.ts:516 latencyMs` unused remains, not ours).

---

## 2. OPEN QUESTION FROM USER (this session's new directive)

**User asked:** "did we seed our db with their data?"
**Answer found:** NO.
- No CDP capability seed files in vivim-final `seeds/`.
- `seeds/taxonomy/taxonomy-seed.ts` and capability-bootstrap(-generated) contain ZERO `cap:cdp:*` entries.
- CDP capabilities are registered **in-memory at boot** from the static `CDP_PROTOCOL_CATALOG` (not from OG data, not from a DB seed).
- G2 writes `prospect` binding rows lazily at boot, but **no OG discovered/tested capability records were ever imported**.

---

## 3. NEW GOAL (user's latest directive — IN PROGRESS, NOT STARTED)

> "GOAL: all need to be stored in our db - you might have to design a translation
> and schema alignment scripts - but our db should have everything you see in cap-store"

**Meaning:** Port ALL of OG cap-store's persisted data into vivim-final's DB, with a
translation + schema-alignment layer. vivim-final's DB should contain everything OG has.

This is a RESEARCH + DESIGN + IMPLEMENT task. Compaction happened mid-research.

---

## 4. RESEARCH FINDINGS SO FAR (OG cap-store data model)

### OG migrations present (cap-store/migrations/)
001_init, 002_provider, 003_selector_strategy, 004_learning, 005_binding_event,
006_failure_classification, 007_views, 008_provider_seed, 009_transfer, 010_trace,
011_health_ticks, 012_circuit_breaker, 013_endpoint_fields, 014_outcome_stream,
015_hole_fingerprint, 016_routing, 017_state_engine, 018_learning_confidence,
019_automation_alerting, 020_profile_session_settings, 021_auth_state, 022_checkpoint,
023_provider_health, 024_provider_config, 025_chrome_profiles, 026_fleet_event,
027_composite_profile_id, 028_vivim_session_states, 029_conversation_states,
030_discovered_accounts, 031_cleanup_synthetic_profiles, 031_default_account,
032_account_registry, 033_conversation_messages, 033_provider_account_debug_port,
034_drop_conversation_message_fk, 034_provider_account_consolidated, 034_stream_blocks,
035_add_conversation_title_url, **036_capability**, **037_test_run**

### OG key table: `capability` (036_capability.sql) — THE CORE DATA TO PORT
```
id TEXT PK
provider_id TEXT NOT NULL
slug TEXT NOT NULL
name TEXT NOT NULL
description TEXT
cdp_method TEXT NOT NULL
cdp_domain TEXT
category TEXT NOT NULL DEFAULT 'page'
status TEXT NOT NULL DEFAULT 'discovered'
  CHECK IN ('discovered','tested','promoted','stable','broken','retired')
confidence REAL NOT NULL DEFAULT 0
selector TEXT
strategy_type TEXT
input_params TEXT DEFAULT '{}'
output_schema TEXT DEFAULT '{}'
last_tested_at INTEGER
last_tested_ok INTEGER DEFAULT 0
test_count INTEGER NOT NULL DEFAULT 0
fail_count INTEGER NOT NULL DEFAULT 0
promotion_history TEXT NOT NULL DEFAULT '[]'
schema_version INTEGER NOT NULL DEFAULT 1
created_at INTEGER NOT NULL
updated_at INTEGER NOT NULL
provenance TEXT NOT NULL DEFAULT '{}'
UNIQUE(provider_id, slug)
```
Indexes: idx_capability_provider, idx_capability_status, idx_capability_category.

### OG key table: `test_run` (037_test_run.sql)
```
id TEXT PK, provider_id, status, turns_config, capabilities_to_test,
turns_attempted, turns_succeeded, capabilities_tested, capabilities_passed,
confidence, turn_results, capability_results, error,
started_at, completed_at, duration_ms, created_at, updated_at
```

### OG storage layer (src/storage/v02-batch10.ts)
- `createCapability` (id=`cap:${provider_id}:${slug}`), `getCapability`, `listCapabilities`,
  `updateCapability`, `deleteCapability`, `recordCapabilityTest` (confidence=(tests-fails)/tests,
  auto-flip `broken` after 3 fails), `getCapabilityMatrix`.
- OG REST: `src/server/v02-batch9.ts` (GET/POST /api/capabilities, PATCH /:id, POST /:id/test,
  /matrix, /history), `src/server/v02-batch10.ts` (POST /api/test-runs).
- OG tester gate: `src/executor/capability-tester.ts` testCapability(db, capId): loads cap →
  resolves live slave via fleetSupervisor.get(provider_id) → fires real cdp_method → recordCapabilityTest.
- OG slave write/read: `src/executor/slave-write.ts`, `src/executor/slave-read.ts`.
- OG fleet/slave registry: `src/executor/fleet-supervisor.ts` (get(providerId)).
- OG route tracking: `src/router/tracker.ts` (data/active-routes.json: startRoute/updateTarget/
  completeRoute/listActiveRoutes/cancelAllOnRestart).

### OTHER OG tables likely needing port (from migration list — NOT YET fully read)
provider, selector_strategy, learning, binding_event, failure_classification, trace,
health_ticks, circuit_breaker, endpoint_fields, outcome_stream, hole_fingerprint, routing,
state_engine, learning_confidence, automation_alerting, profile_session_settings, auth_state,
checkpoint, provider_health, provider_config, chrome_profiles, fleet_event,
vivim_session_states, conversation_states, discovered_accounts, account_registry,
conversation_messages, provider_account, stream_blocks.

---

## 5. vivim-final TARGET SCHEMA (prisma/schema.prisma) — relevant models already present
- `CapabilityTaxonomy` (line 317) — id, name, slug @unique, category, description, + UI/state fields.
- `CapabilityBinding` (line 405) — id, globalId, providerId, status (default 'prospect'),
  bestProgramId, currentProgramId, promotionHistoryJson, confidence Float, createdAt BigInt, updatedAt BigInt.
  UNIQUE(globalId, providerId). FK globalId→CapabilityTaxonomy.id, providerId→ProviderDefinition.id.
- `CapabilityProgram` (line 468) — id, bindingId, version, name, supersededById, isActive, ...
- `SelectorStrategy` (line 488)
- `Outcome` (line 512)
- `TraceEntry` (line 289) — id, slaveId, conversationId, method, paramsJson, resultJson,
  durationMs, error, ts. (NOTE: no cdpMethod/cdpParamsJson/cdpResultJson columns — G3 records
  into paramsJson/resultJson as JSON strings instead.)
- `BindingStatusLog`, `ProgramVersionMetric`, `CapabilityTelemetry`, `SelectorHealthHistory` — present.
- `ProviderDefinition` (FK target for CapabilityBinding.providerId) — id, name, slug @unique, ...
- `ProviderAccount`, `Conversation`, `ConversationMessage`, etc. — present.

**Schema-alignment gaps to resolve when porting:**
1. OG `capability` is keyed by `(provider_id, slug)` with id `cap:${provider_id}:${slug}`.
   vivim-final `CapabilityBinding` needs `globalId` = a CapabilityTaxonomy.id. So OG row →
   (a) CapabilityTaxonomy row (id=`cap:cdp:${cdp_method}` or reuse OG id) +
   (b) CapabilityBinding row (globalId=that taxonomy id, providerId=OG provider_id).
2. OG `status` enum (discovered|tested|promoted|stable|broken|retired) vs vivim-final
   `CapabilityBinding.status` default 'prospect' (allowed values not CHECK-constrained in Prisma,
   but code expects prospect/active/etc). Need a status mapping table.
3. OG `confidence REAL` → vivim-final `confidence Float`. Direct.
4. OG `promotion_history TEXT` → vivim-final `promotionHistoryJson String`.
5. OG `input_params`/`output_schema` TEXT → vivim-final: taxonomy has uiInputSchema; binding has no
   param schema column → may need to stash in CapabilityTaxonomy or a JSON column.
6. OG `test_run` → vivim-final has NO test_run model. Either add a model or map to Outcome/TraceEntry.
   Likely need a new `CapabilityTestRun` model in schema.prisma.
7. OG `trace` → vivim-final `TraceEntry` (align columns).
8. OG `selector_strategy`, `learning`, `binding_event`, `failure_classification`, `health_ticks`,
   `circuit_breaker`, `provider_health`, `provider_config`, `chrome_profiles`, `fleet_event`,
   `conversation_states`, `discovered_accounts`, `account_registry` → check which vivim-final
   models exist; add missing ones.
9. OG uses INTEGER ms timestamps; vivim-final uses BigInt (ms) for createdAt/updatedAt and DateTime
   for some. Translation must normalize types.
10. OG uses cuid-less TEXT ids (`cap:...`, `prov_...`); vivim-final uses String @id (often cuid default).
    Port must preserve OG ids where they are natural keys (capability id).

---

## 6. PROPOSED IMPLEMENTATION PLAN (not yet executed)

### Step A — Full schema survey (RESEARCH, remaining)
- Read ALL OG migrations 001–037 to enumerate every table + column.
- Read vivim-final `prisma/schema.prisma` fully (54 tables) to enumerate every model.
- Build a column-level mapping matrix OG table → vivim-final model.

### Step B — Schema alignment (DESIGN/IMPLEMENT)
- Add any missing vivim-final models needed to hold OG data:
  - `CapabilityTestRun` (port of OG `test_run`)
  - Possibly `CapabilityProvenance` or reuse JSON columns.
  - Any provider/fleet/account tables vivim-final lacks.
- `bunx prisma migrate dev --name port_og_capability_data` + `bunx prisma generate`.
- Document a STATUS enum mapping + timestamp normalization rule.

### Step C — Translation + seed script (IMPLEMENT)
- New `seeds/og-capability-port.ts` (or `scripts/port-og-capabilities.ts`):
  - Connects to OG DB (sqlite at cap-store data dir) — needs OG DB path.
  - Reads every OG table (capability, test_run, selector_strategy, trace, provider, account, etc.).
  - Translates + upserts into vivim-final Prisma models via idempotent upsert (matching OG ids).
  - Maps `capability` → CapabilityTaxonomy + CapabilityBinding.
  - Maps `test_run` → CapabilityTestRun.
  - Maps OG provider/account rows → ProviderDefinition/ProviderAccount (reconcile slugs).
- Idempotent (re-runnable, upsert by natural key).
- CLI entry: `bun run seed:og` or `bunx tsx seeds/og-capability-port.ts`.

### Step D — Wire port into boot/seed flow (optional)
- Decide whether port runs once (migration seed) or is a standalone import tool.
- Likely standalone import tool (OG is reference data, not live).

### Step E — Verify
- `bun run typecheck`, `bun run lint`.
- Spot-check via `bunx prisma studio` or a test that counts rows ported == OG row count.
- G4 test still green.

---

## 7. KEY DECISIONS / CONSTRAINTS
- **No frontend** (user mandate throughout).
- **Governor Canon:** only ChromeGovernor touches CDP — port script touches DB only, safe.
- **Relaxed policy** (user prefers our simpler registration over OG's strict 6-state machine).
  Port should preserve OG `status` values but our runtime treats them loosely.
- **Idempotent upserts** required (re-runnable import).
- Preserve OG natural-key ids where they are meaningful (capability id `cap:prov:slug`).

---

## 8. OPEN UNKNOWNS TO RESOLVE NEXT
1. Where is the OG cap-store **live SQLite DB file**? (need path for the port script to read from).
   Likely under cap-store `data/` or `*/*.db` / `*.sqlite`. MUST locate before Step C.
2. Does vivim-final's dev DB exist / is it sqlite or postgres? (prisma datasource).
3. Which OG tables are actually populated with meaningful data vs empty schema?
4. Full column enumeration of OG tables 001–035 (only 036/037 read so far).
5. Confirm vivim-final `ProviderDefinition` slug set matches OG `provider_id` values
   (OG uses slugs like 'chatgpt','claude'; vivim-final must have matching providers or we seed them too).

---

## 9. RELEVANT FILES (absolute paths)
- GAP doc: C:\0-BlackBoxProject-0\vivim-final\GAP-ANALYSIS-CDP-PROVIDER-SLAVE.md
- vivim-final schema: C:\0-BlackBoxProject-0\vivim-final\prisma\schema.prisma
- vivim-final boot: C:\0-BlackBoxProject-0\vivim-final\src\server\index.ts (CDP reg ~line 571+)
- vivim-final registrar: C:\0-BlackBoxProject-0\vivim-final\src\engines\cdp-capability-registrar.ts
- vivim-final discovery: C:\0-BlackBoxProject-0\vivim-final\src\engines\cdp-discovery.ts
- vivim-final governor: C:\0-BlackBoxProject-0\vivim-final\src\engines\chrome-governor.ts
- vivim-final router: C:\0-BlackBoxProject-0\vivim-final\src\server\conversation-router.ts
- vivim-final G4 test: C:\0-BlackBoxProject-0\vivim-final\tests\integration\engines\cdp-execution.test.ts
- OG capability table: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\migrations\036_capability.sql
- OG test_run table: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\migrations\037_test_run.sql
- OG storage: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\src\storage\v02-batch10.ts
- OG REST: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\src\server\v02-batch9.ts, v02-batch10.ts
- OG tester: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\src\executor\capability-tester.ts
- OG fleet: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\src\executor\fleet-supervisor.ts
- OG tracker: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\src\router\tracker.ts
- OG migrations dir: C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\cap-store\migrations\ (001–037)

---

## 10. NEXT ACTION (post-compaction)
1. Locate OG cap-store live DB file (search `*.db`/`*.sqlite` under cap-store).
2. Finish reading OG migrations 001–035 to enumerate all tables.
3. Read vivim-final full schema.prisma (54 models).
4. Build OG→final mapping matrix.
5. Add missing vivim-final models + migration.
6. Write idempotent port script (seeds/og-capability-port.ts).
7. Run port, verify row counts, typecheck, lint, G4 test.
