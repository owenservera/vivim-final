# atomic-v12 — Runtime-OS Agentic Dev Skill: Complete Plan

> **Source of truth for `vivim-runtime`** — the agentic development skill that makes
> opencode / claude-code run as the *runtime OS* of its own dev loop.
> Supersedes earlier anchored summaries. Last updated 2026-07-13.

---

## 1. Objective

Build `vivim-runtime`: a single operating-system dev loop that drives the live vivim
stack end-to-end:

```
launch → engage → discover → test → debug → build → test → debug → repeat
```

It is **meta-tooling, not a vivim product feature**. The agent (opencode / claude-code)
*becomes* the runtime of its own development loop — launching the backend + frontend +
provider slaves, engaging them live, discovering gaps, testing through the real UI, and
building+binding backend capabilities to reusable frontend parts.

**Primary goal: FRONTEND = BACKEND** — every backend capability is rendered by a reusable
frontend part, bound by capability slug. The UI system is built from highly reusable parts.

Sits **on top of** `atomic-v11` (product-completion layer, 21/21 done). v12 reuses v11
artifacts; it does not reimplement them.

---

## 2. Scope & Non-Goals

| In scope | Out of scope |
|---|---|
| The dev skill + its loop mechanics | Any change to vivim's runtime/execution model |
| Live-app engage/discover/test/build against the running stack | New product capabilities (only the dev-loop capability) |
| Reusable frontend parts bound to backend capabilities (FRONTEND=BACKEND) | Reworking the vivim UI framework |
| Baseline hardening (5 DISC PRDs) + typecheck green | Touching the 3 intentional legacy error files (see §7) |

The loop exercises the **real** app (browser via Governor CDP, server via `/api/*`,
provider slaves). No Playwright — UI gating uses Governor CDP (per Governor Canon).

---

## 3. The Unified Operating-System Loop

| Stage | Unit(s) | What happens |
|---|---|---|
| **launch** | 2.1–2.4 | Supervisor boots backend + frontend + slave(s) detached; preflight health-check; server-bootstrap dispatcher |
| **engage** | 3.1 | Open a live browser via Governor-mediated CDP |
| **discover** | 3.2, 3.3 | Discover backend (live protocol from slave + `/api/capabilities`) and frontend (scan `CapabilityRegistry` for orphan/dead-slug) |
| **test** | 4.1, 4.2 | Live E2E harness (wraps v11 provider-harness) + CDP UI gate |
| **debug** | 4.3 | Capture failures (screenshots, console, server logs), report, loop back |
| **build** | 5.2, 5.3 | Generate a reusable frontend part **and** its backend `UnifiedCapability` handler, bind by slug |
| **repeat** | 6.1 | `runtime` meta-cmd orchestrates the above over the devops tracker, unit by unit |

The loop is a **thin orchestrator** over two existing engines:
- **devops unit-loop** (`.opencode/skill/devops`, already built): `select → mark in_progress → implement → gate → mark done → commit`, driven via `--tracker docs/atomic-v12/01-tracker.md`.
- **live-app layer** (new, units 2.1–5.3): the engage/discover/test/debug/build steps above.

---

## 4. FRONTEND=BACKEND Contract (researched)

The binding is already partly in place; v12 makes it first-class and proves it green.

**Backend side**
- Capability carries `ui_component` (DB column) → `uiComponent` exposed at
  `src/engines/capability-resolution.ts:38` and `UnifiedCapability['ui']` at
  `src/engines/unified-registry.ts:171`.
- Surfaced via `GET /api/capabilities?surface=ui` → returns `ui.component` (slug).
- Verified working (R4.2 done).

**Frontend side** (lives in `web/ui/src`, **not** `src/frontend`)
- `web/ui/src/registry/index.ts` — `CapabilityRegistry`:
  - `register(slug, { component, bestPracticeNote })` binds a capability slug → React renderer.
  - `CapabilityRenderProps = { slug, contract, onAction }` — the reusable-part shape.
  - `hasBespoke(slug)` / `list()` — discovery queries.
- `web/ui/src/sdk/` (v11 37.1) — `CapStoreProvider` + hooks (`useCapabilities`,
  `useConversation`, `useProvider`, `useInterpret`). Reuse as the data layer for parts.
- `web/ui/src/components/` — where reusable parts live.
- `web/sandbox/src/surfaces/` (v11) — example surfaces (memory-browser, device-pairing, onboarding).

**The FRONTEND=BACKEND closure (what v12 builds)**
- `discover-frontend` (3.3) diffs `CapabilityRegistry.list()` slugs vs backend `ui_component` slugs → **orphan** (backend has ui surface, no renderer) / **dead-slug** (renderer registered, no backend cap).
- `build` (5.2) generates a React renderer (`CapabilityRenderProps`) + `CapabilityRegistry.register(slug, …)` → that *is* FRONTEND=BACKEND.
- `ui-gate` (4.2) navigates to the cap route, finds the registered renderer, asserts it renders (Governor CDP).

---

## 5. Reuse Map (do not reimplement)

| Need | Reuse from v11 | Notes |
|---|---|---|
| Provider test harness | `scripts/provider-harness.ts` (32.1) | 4.1 wraps this |
| Sandbox / detached run | `src/engines/sandbox-runner.ts` (31.1) | 6.1 uses for isolated runs |
| Autonomous orchestration | `src/engines/autonomous-execution.ts` (+ `autonomous-replay`, `autonomous-failover`) (34.x) | 6.1 uses for plan/execute |
| React SDK | `web/ui/src/sdk/` (37.1) + `sdk/src/react-sdk.ts` | data layer for parts |
| OpenAPI / protocol | `docs/api/v11-universal-api.yaml` (37.4) | 3.2 reads this |
| Surfaces pattern | `web/sandbox/src/surfaces/` (33.3/36.4/37.2) | template for new parts |
| Dev loop mechanics | `.opencode/skill/devops` (autonomous orchestrator) | 6.1 wraps `select`/`mark`/`gate`/`report` |
| Skill→mechanics wiring | `.opencode/skill/source-audit` | 6.2 mirrors this shape |

---

## 6. Decisions Locked (user-approved)

1. **Fix the full baseline typecheck** — all `bigint`↔`number` coercion errors, so
   `bunx tsc --noEmit` is green except the **3 intentional legacy** files
   (`src/canvas/mutation-caps.ts`, `src/cli/commands/registry-bridge.ts`, `src/cli/index.ts`).
2. **Reuse v11 artifacts** — never reimplement what v11 shipped.
3. **Wrap the existing `devops` loop skill** at 6.1 — don't build a second loop engine.
4. **Frontend path is `web/ui/src`** (corrected from earlier `src/frontend` mistake).
5. **DISC-2 guard**: skip `journal_mode=WAL` when `config.storage.encryptDb` is on
   (v11 36.1 `DbEncryptionEngine` makes encrypted SQLite incompatible with WAL).

---

## 7. Baseline Findings (drive Phase 0)

- **Backend boots**: `bun run serve` → "Seeded 12 providers, 0 errors", listening :9420, WAL pragmas applied. `initPrismaWal` already `$queryRawUnsafe`.
- **Typecheck is NOT clean** (earlier "tsc clean" claim was wrong). `bunx tsc --noEmit` emits
  ~110 errors after fixing the first 4 files. Root cause: the Int→BigInt DB migration
  (timestamps now `bigint` in Prisma) while Row/contract types still declare `number`.
- **Classification of errors**
  - ~20 `storage/impl/*` + a few `tests/*` + `web/sandbox/*` files: `bigint`↔`number`
    coercion. **All to be fixed in Phase 0** (mechanical: param `number`→`bigint`, return `Number(...)`).
  - 3 legacy files (cli/canvas/registry-bridge): **intentionally left** per decision 1.
- **v11 PROGRESS.md** is actually consistent ("Done: 21/21"); the earlier "line 71 = 6 pending"
  report was stale. **No edit needed.**

---

## 8. Phase Breakdown — 27 units / 7 phases

> Tracker: `docs/atomic-v12/01-tracker.md` (amended to 27 units). Specs under
> `docs/atomic-v12/phase-00…06/*`. Marker format `[ ]`/`[~]`/`[x]`/`[!]`.

### Phase 0 — Baseline Typecheck Green (4 planned units, expanded to cover all coercion files)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 0.1 | `src/engines/stream-block-store.ts` | `toRow` createdAt `number`→`bigint` param + `Number()` return | tsc clean for file |
| 0.2 | `src/server/index.ts` | `listMessages` `ts: Number(r.createdAt)` | tsc clean for file |
| 0.3 | `src/storage/impl/alert-store-impl.ts` | `toAlert` `firedAt: bigint` + `Number()` return | tsc clean for file |
| 0.4 | `sdk/src/client.ts` | `CapStoreError(code, message, details)` arg fix | tsc clean for file |
| 0.5* | 12× `src/storage/impl/*` (automation, capability-macro, discovery, harness-checkpoint, hpe-session, knowledge-ingestion, router, sandbox-audit, shape-binding, slave-setup, sync, workflow) | coerce timestamps | each file tsc-clean |
| 0.6* | `tests/integration/device-pairing.test.ts`, `tests/unit/bench/bench-runner.test.ts`, `web/sandbox/src/onboarding/onboarding-machine.ts` | fix non-bigint type errors | tsc clean for these |

*\* added when the real baseline (~20 files) was discovered; decision 1 covers them.

### Phase 1 — Baseline Hardening (5 units) — DISC PRDs in `docs/roadmap/prds/PRD-DISC-{1..5}-*.md`
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 1.1 | `src/storage/db.ts` `configurePrisma` | DISC-2 WAL + `encryptDb` guard (skip WAL when encrypted) | boot clean with/without encryptDb |
| 1.2 | `src/executor/{slave-read,slave-write,cdp,cdp-transport}.ts` | DISC-3 CDP runtime-enable elimination | no `Runtime.enable` sent |
| 1.3 | `src/engines/provider-registrar.ts` | DISC-1 provider taxonomy layer | registrar loads v11 taxonomy |
| 1.4 | `src/engines/nlcl/{catalog,entity-resolution}.ts` | DISC-4 NLCL hierarchical + entity resolution | parse tests green |
| 1.5 | `src/server/{index,capability-router,response}.ts` | DISC-5 HTTP QUERY + body cache | cache hits reduce upstream calls |

### Phase 2 — Runtime Supervisor & Pre-flight (4 units)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 2.1 | `src/devops/supervisor.ts` (new) | Detached supervisor (spawn backend+frontend+slave, restart) | processes stay up; self-exit boot |
| 2.2 | `scripts/dev-{backend,frontend,slave}.ps1` (new) | PS1 wrappers | `bun run dev:backend` etc. work |
| 2.3 | `src/devops/preflight.ts` (new) | Pre-flight health check (ports, WAL, providers) | preflight green before engage |
| 2.4 | `src/devops/bootstrap.ts` (new) | Server-bootstrap dispatcher | launches stack hands-free |

### Phase 3 — Engage & Discover (3 units)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 3.1 | `src/devops/engage.ts` (new) | Engage live browser via Governor CDP | browser session open |
| 3.2 | `src/devops/discover-backend.ts` (new) | Discover backend (slave protocol + `/api/capabilities`, reads v11 OpenAPI) | emits capability inventory |
| 3.3 | `src/devops/discover-frontend.ts` (new) | Discover frontend (scan `CapabilityRegistry.list()` vs backend `ui_component`) | reports orphan/dead-slug |

### Phase 4 — Test & Debug (3 units)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 4.1 | `src/devops/test.ts` (new) | Live E2E harness wrapping `scripts/provider-harness.ts` | runs against live server |
| 4.2 | `src/devops/ui-gate.ts` (new) | CDP UI gate (navigate + assert registered renderer) | gate passes/fails on render |
| 4.3 | `src/devops/debug.ts` (new) | Debug capture (screenshot/console/log) | artifacts collected on failure |

### Phase 5 — Build FRONTEND=BACKEND (3 units)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 5.1 | (already done) | Frontend data-flow wire (R4.2) | `[x]` in tracker |
| 5.2 | `web/ui/src/components/*.tsx` + `web/ui/src/registry/index.ts` | Build reusable frontend part + `CapabilityRegistry.register(slug, …)` | part renders in ui-gate |
| 5.3 | `src/engines/*` (new UnifiedCapability handler) | Backend handler scaffold bound to same slug | `GET /api/capabilities?surface=ui` lists it |

### Phase 6 — Orchestration & Skill (5 units)
| Unit | Target | Intent | Acceptance |
|---|---|---|---|
| 6.1 | `src/devops/runtime-test/index.ts` (new) | Runtime loop meta-cmd (thin orchestrator over devops `select`/`mark`/`gate` + live-app layer) | drives a unit end-to-end |
| 6.2 | `.opencode/skill/vivim-runtime/SKILL.md` (new) | Capstone agent playbook (mirrors source-audit wiring) | skill loads; documents loop |
| 6.3 | `AGENTS.md` | Cross-refs (R5.3) | section added |
| 6.4 | `docs/atomic-v12/SPEC-INDEX.md` | Per-unit spec index (R5.4) | index complete |
| 6.5 | `tests/e2e/runtime-os-loop.test.ts` (new) | End-to-end loop smoke (R5.5 acceptance) | `bun test` passes |

---

## 9. Cross-Cutting Fixes (applied alongside Phase 0/1)

- Correct `docs/atomic-v12/01-tracker.md`: add Phase 0, retotal **23 → 27 units**; fix header
  line 11 ("tsc clean" → "tsc not clean, Phase 0 greens it").
- Amend specs `3.3`/`5.2`: frontend path `src/frontend` → `web/ui/src`.
- Amend spec `6.1`: wrap `devops` loop, do not rebuild.
- Amend specs `4.1`/`5.2`: reuse v11 artifacts (provider-harness, React SDK).
- Amend spec `1.1`: add `encryptDb` WAL guard.

---

## 10. Execution Order & Verification

```
Phase 0  → tsc --noEmit green except 3 legacy files
Phase 1  → bun run serve clean WAL (with/without encryptDb); bun run providers:smoke green
Phase 2  → supervisor + ps1 + preflight + bootstrap drive the stack hands-free
Phase 3  → live browser engaged; backend + frontend inventories emitted
Phase 4  → live E2E + CDP ui-gate pass against running app
Phase 5  → generated CapabilityRegistry part passes ui-gate; backend handler listed
Phase 6  → runtime meta-cmd drives a unit; SKILL.md + AGENTS cross-ref + SPEC-INDEX + e2e smoke
```

Gate command between phases: `bun run devops gate --tracker docs/atomic-v12/01-tracker.md`
(unit state via `bun run devops mark <id> done --tracker docs/atomic-v12/01-tracker.md`).

---

## 11. Relevant Files

**Plan / tracker / specs**
- `docs/atomic-v12/PLAN.md` (this file)
- `docs/atomic-v12/01-tracker.md` (master, 27 units)
- `docs/atomic-v12/phase-00…06/*` (per-unit specs)
- `docs/roadmap/prds/PRD-DISC-{1..5}-*.md` (baseline PRDs)
- `docs/atomic-v12/SPEC-INDEX.md` (6.4, to create)

**v11 (reuse, read-only)**
- `docs/atomic-v11/01-tracker.md`, `docs/atomic-v11/PROGRESS.md`
- `scripts/provider-harness.ts`, `src/cli/provider-harness.ts` (32.1)
- `src/engines/sandbox-runner.ts` (31.1)
- `src/engines/autonomous-execution.ts` (+ replay/failover) (34.x)
- `web/ui/src/sdk/` (37.1), `sdk/src/react-sdk.ts`
- `docs/api/v11-universal-api.yaml` (37.4)
- `web/sandbox/src/surfaces/` (33.3/36.4/37.2)

**FRONTEND=BACKEND contract**
- `web/ui/src/registry/index.ts` (`CapabilityRegistry`)
- `web/ui/src/components/` (parts target)
- `src/engines/capability-resolution.ts:38`, `src/engines/unified-registry.ts:171`

**Phase 0 (baseline fixes)**
- `src/engines/stream-block-store.ts`, `src/server/index.ts`, `src/storage/impl/alert-store-impl.ts`, `sdk/src/client.ts` (done)
- 12× `src/storage/impl/*` (0.5), `tests/...`, `web/sandbox/src/onboarding/onboarding-machine.ts` (0.6)

**Phase 1 (DISC)**
- `src/storage/db.ts` `configurePrisma` (1.1), `src/executor/*` (1.2), `src/engines/provider-registrar.ts` (1.3), `src/engines/nlcl/*` (1.4), `src/server/*` (1.5)
- `src/engines/db-encryption.ts` (v11 36.1, WAL conflict source)

**Phase 2–6 (new)**
- `src/devops/{supervisor,preflight,bootstrap,engage,discover-backend,discover-frontend,test,ui-gate,debug}.ts`
- `scripts/dev-{backend,frontend,slave}.ps1`
- `src/devops/runtime-test/index.ts` (6.1)
- `.opencode/skill/vivim-runtime/SKILL.md` (6.2)
- `tests/e2e/runtime-os-loop.test.ts` (6.5)

**Mechanics (reuse)**
- `.opencode/skill/devops/SKILL.md` (loop), `.opencode/skill/source-audit/SKILL.md` (wiring precedent)
