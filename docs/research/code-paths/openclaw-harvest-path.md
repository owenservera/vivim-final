# OpenClaw Harvest — Confirmed Code Path

**Convergence:** CONFIRMED (architecture mapping) / PROBABLE (code harvest)
**Iterations:** 4 | **Confidence:** High | **Date:** 2026-07-19

## Recommended Approach

Harvest **architecture patterns + taxonomy corpus** from OpenClaw and its
best-matching spinoffs, then translate them into vivim's existing engine
contracts. Do NOT lift executable code — harvest structure, schema, and the
capability-ownership mental model. Clone the 6 verified repos into a local
`research-clones/` workspace for offline reference and `taxonomy.yaml` parsing.

## Why This Works

1. OpenClaw's `PluginRegistry` + capability-ownership model is a near-1:1 sibling
   of vivim's `UnifiedCapabilityRegistry` + store-contract invariants
   ([docs.openclaw.ai/plugins/architecture]). The "consume shared capability
   instead of re-implementing vendor behavior" rule == vivim's
   `CapabilityResolutionEngine` contract.
2. `taxonomy.yaml` (10,637 lines) is a battle-tested, real-world capability
   catalog spanning providers, channels, media, tools — ideal seed corpus for
   `devops-generators` ([github.com/openclaw/openclaw/blob/main/taxonomy.yaml]).
3. `crabfleet` + `nora` provide concrete, cloneable code for agent-run
   observability and fleet/MCP control planes ([github.com/openclaw/crabfleet],
   [github.com/solomon2773/nora]).

## Prerequisites

- `git`, network access for clone (verified reachable 2026-07-19)
- Existing vivim structure: `src/engines/capability-bootstrap.ts`,
  `devops-generators` skill, `src/storage/contracts/`
- Read access to `docs/merged-design-v2/` (engine specs)

## Known Gotchas

- **Supply-chain risk:** ClawHub had 824 malicious skills (2026). Never execute
  cloned `SKILL.md`/plugin runtime. Mitigation: harvest only structure; keep
  clones in `research-clones/` outside any execution path.
- **Path escape in OpenClaw loader:** their safety gate rejects entries escaping
  plugin root. vivim already enforces this via DB-only parser logic + store
  contracts — preserve that boundary.
- **CalVer vs vivim SemVer:** OpenClaw uses `YYYY.M.D`; do not mirror versioning.
- **taxonomy.yaml size:** 635 KB — parse lazily / stream, don't inline.

## Harvest Strategy (mapped to vivim)

### Step 1 — Clone reference repos (local)
```
research-clones/
  openclaw/            (github.com/openclaw/openclaw)
  crabfleet/          (github.com/openclaw/crabfleet)
  clawgrit-reports/   (github.com/openclaw/clawgrit-reports)
  nora/               (github.com/solomon2773/nora)
  hearth/             (github.com/warrence/openclaw-hearth)
  qwen35/             (github.com/paulwlisto/openclaw-qwen35)
```
Use `git clone --depth 1` to keep footprint small.

### Step 2 — Extract capability taxonomy corpus  ✅ DONE (2026-07-19)
- **Script:** `scripts/taxonomy-gen/lib/openclaw-harvest.ts` (pure parse, no LLM)
  + `run.ts openclaw-harvest` subcommand + `bun run taxonomy:openclaw` alias.
- **Source:** `research-clones/openclaw-core/taxonomy.yaml` (641 KB, 10,637 lines).
- **Output:** `seeds/taxonomy/openclaw-harvest.json` — 3,695 nodes (345 taxonomy
  terms + 3,352 capabilities) + 3,639 edges. All nodes pass `TaxonomyNodeSchema`.
- **Mapping (deterministic):**
  | OpenClaw | vivim node |
  |----------|------------|
  | `area` (56, excl. smoke-ci/release profiles) | `taxonomy_term` `oc-area:<id>` (vocab `openclaw-area`) |
  | `category` (287) | `taxonomy_term` `oc-cat:<area>.<id>` (vocab `openclaw-category`), edge → parent area |
  | `feature` (1,678) | `capability` `oc-cap:<area>.<cat>.<slug>` (kind inferred from name) |
  | `coverageId` (1,995 distinct) | `capability` `oc-cap:<coverageId>` (granular capability) |
  | capability → area | `synonym_of` edge (exposes-style hierarchy link) |
- **Next:** merge `openclaw-harvest.json` into `seeds/taxonomy/shared/raw.json`
  round 0 pool, then run `bun run taxonomy-gen merge` + `gen:protocol`, and
  `verify-cross-surface`. CoverageIds (dotted, e.g. `gateway.exec-approvals`)
  are the highest-value nodes — they map 1:1 to vivim `cap:category:action` slugs.

### Step B — Merge into shared pool + regenerate  ✅ DONE (2026-07-19)
- **`merge.ts` now ingests `seeds/taxonomy/openclaw-harvest.json`** as a 4th
  source in `collectNodes()` (alongside `output/shared/pool.json` + live drill-downs).
- **Slug convention fixed:** OpenClaw dotted IDs (`gateway.exec-approvals`) →
  underscore slugs (`oc_gateway_exec_approvals`) so the cross-surface binder
  produces clean `cap:oc:<body>` IDs and `/api/oc/...` paths (no `:`/`.` leakage).
- **UI mapper hardened:** `group` falls back to `'uncategorized'` instead of
  `undefined` when a capability lacks `category` (latent bug fixed pipeline-wide).
- **Results:** master pool `seeds/taxonomy/pool.taxonomy.json` grew 226 → **3,921
  nodes** (3,548 capabilities + 343 taxonomy terms + 7 protocols + 12 tech-stacks +
  11 parsers). `verify-cross-surface` (offline): **3548/3548 passed, 0 failed,
  exit 0**. 113 alias-collision warnings (first-letter CLI aliases overlap) are
  pre-existing and non-blocking.
- **Run:** `bun run taxonomy:openclaw` (regenerate) → `bun run taxonomy-gen merge`
  → `bun run scripts/verify-cross-surface.ts`.
- **Note:** `gen:protocol` is unrelated (reads provider protocol DB, not taxonomy
  pool). DB seed (`taxonomy-seed.ts`) needs `output/capability-hierarchy.json`
  (separate legacy path) — not regenerated here; pool.taxonomy.json is the
  canonical artifact for the live registry.

### Step 3 — Translate capability-ownership model  ✅ DONE (2026-07-19)
Full translation guide: **`docs/research/code-paths/openclaw-capability-ownership.md`**.
Key finding: vivim's contracts already implement OpenClaw's ownership-boundary
philosophy 1:1 — `PluginRegistry`↔`UnifiedCapabilityRegistry`,
`api.registerProvider`↔`ProviderRegistrar` 2-pass, `registerTool`↔
`registerDefaultCapabilities`/`makeCapability`, manifest-first control plane↔
`capability-bootstrap.ts` boot snapshot, "consume shared capability"↔
`CapabilityResolutionEngine` single-active-binding resolution. No OpenClaw code
lifted — structure only. Empirical proof: the 3,352 harvested `oc_*` capabilities
flow through the exact registry/resolution pipeline and pass `verify-cross-surface`
(3548/3548, exit 0).

### Step 4 — Harvest observability code (crabfleet + clawgrit + nora)  ✅ DONE (2026-07-19)
Full translation guide: **`docs/research/code-paths/openclaw-observability.md`**.
Key finding: vivim's `TelemetryAggregator` + `ChromeGovernor` fleet surface already
embody the Crabfleet run-lifecycle / heartbeat / runtime-capability model and the Nora
MCP fleet-tool surface 1:1 — no code lift required.
- `crabfleet` run-lifecycle (`queued→leasing→running→review|completed|failed|stalled|canceled`)
  → vivim `SlaveLifecycle` (`stopped→starting→running→unhealthy→restarting→error→circuit_open`),
  a strict superset with automatic circuit-breaker + backoff recovery.
- `crabfleet` heartbeat/stall (5-min threshold → `stalled`) → vivim `SlaveHealth.lastHealthCheck`
  + `consecutiveFailures` + per-slave circuit breaker emitting `fleet:slave_status` /
  `fleet:circuit_changed` events.
- `crabfleet` runtime capability array (terminal/takeover/vnc/desktop/logs/artifacts) →
  vivim provider-level capability gating (governor rejects actions not advertised).
- `nora` MCP fleet tools (`get_fleet_status`, `list_monitoring_events`, `get_agent_metrics`,
  `deploy/start/stop_agent`) → vivim `getSuperState()` / `CapabilityEventBus` fleet:* events
  / `TelemetryAggregator` schedules / `fleetSupervisor.spawn/kill` (Governor Canon).
- Optional (non-blocking) enrichments noted: event-driven stall schedule, structured
  `SlaveHealth.capabilities`, destructive-action env gate. vivim has no cost telemetry
  (`get_agent_cost`) — deliberate v1 scope, not a convergence defect.

### Step 5 — Local-model robustness (qwen35 patches)
- Tool-loop circuit breaker → `StreamParserEngine` / local provider tool loop.
- JSON repair for nested tool args → `HarnessRepairEngine` alias-remap patterns.

## Alternatives Considered

| Approach | Why Rejected |
|----------|--------------|
| Fork OpenClaw wholesale as vivim base | Divergent stack (OpenClaw = gateway+channels; vivim = knowledge-graph + CDP provider harness). Too much to unwind. |
| Adopt ClawHub skills directly | Supply-chain attack history; violates vivim DB-only/store-contract invariants. |
| Use `juca-dev/openclaw-clone` / `fiilyai/openclaw` | No novel capabilities vs upstream; dead clones. |

## Verification Steps

1. After clone: `grep -c "registerTool\|registerProvider" openclaw/src` to confirm
   capability API surface matches brief claims.
2. Parse `taxonomy.yaml` head + sample nodes; confirm field shape for generator
   ingestion.
3. Run `bun run devops verify-cross-surface` after any taxonomy change to confirm
   CLI/API/MCP/UI parity (per AGENTS.md invariant).
4. Spot-check `crabfleet`/`nora` for OTel/MCP export patterns worth adapting.

## Risk Assessment

- **Technical risk:** Low (architecture is well-documented + verified repos)
- **Integration risk:** Medium (translation to vivim contracts needs care;
  keep store-contract boundary)
- **Maintenance risk:** Low (OpenClaw is actively maintained; patterns stable)
