---
title: Architectural Eras
status: forensic-evidence (uncommitted)
companion_to: REPOSITORY_FORENSIC_AUDIT.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: AUDIT_BASELINE_v010_77c332c (annotated tag at `7e6de5a → 77c332c`)
---

# Architectural Eras — Deep Reasoning Reconstruction

## How to read this

Each era below is reconstructed from git evidence with the following fields:

- **Anchor commit** and **file count** (verified with `git ls-tree -r --name-only <sha> | Measure-Object`).
- **Intent** — what the era *meant* to do (derived from commit subjects + shortstat + signal quotes, not the actual outcome).
- **Architecture / Data / Runtime / Extension / State / Security / Dev** — what was deposited into the tree, what moved off it.
- **Strengths / Weaknesses / Assumptions / Debt / Reversibility** — forensic verdict.

Every claim is anchored to a commit SHA, stat, or file path. No prose shortcuts.

This document deep-dives where `REPOSITORY_FORENSIC_AUDIT.md §10` only summarizes. Read
those two together; this one reasons about the eras; the audit cites them as evidence.

---

## Era 0 — Initial commit, monolithic seed (`8e3b7c6`)

- **Anchor:** `8e3b7c6` "feat: initial vivim-final cap-store v1 project"
- **Stat:** 81 / +10,661 / -0
- **File count:** ~81 (whole seed = one working dir)

### Intent

Stand up the "cap-store v1 Knowledge Graph Rebuild" project: local-first AI conversation platform. Single SQLite DB, single Node 22 runtime target, single Bun entry. No desktop, no schema split, no parser system yet.

### Evidence

- `8e3b7c6` is the head of every documented lineage (`git fossilize-blame` for v0.1.0's clause "since 8e3b7c6").
- 81 files, 10,661 lines — modest seed.

### Strengths

- Clean starting surface. No legacy contracts to discard.
- Picks Bun + Prisma + TypeScript at day one — a conservative baseline.

### Weaknesses

The seed is a blank page for the reasoning of subsequent eras. We cannot judge whether the `package.json` was correctly scoped because we see it only in retrospect. The audit found only **2** functional-pipeline files in v0.1.0's
root contracts.

### Debt

- Future eras will amplify mistakes made here. The 13-era structure proves that small early ambiguities (storage boundary, capability surface, parser IO shape) propagated into 4–5 separate dedicated eras to correct.

### Reversibility

Total: `git reset --hard 8e3b7c6` + reinstall. No code outside of git.

---

## Era 1 — Node-Layer v1 fork (`8e3b7c6 → b23813f`)

- **Anchor:** `b23813f` "feat(node-layer): universal compliant Node DB with ACU/FSRS/version-chain/alias"
- **Range:** `8e3b7c6..b23813f` = **57 commits**, **+1,181 files, -10 removed** (the first big-bang fork).
- **Stat at anchor:** 481 files, +120,406 / -4,567

### Intent

Let the conversation platform graduate from "throwing messages into a DB" to a knowledge graph with provenance, FSRS spaced-repetition, version chain, and entity alias resolution. ACU = Atomic Cognitive Unit.

### Evidence

- `481 files, +120,406` is one of the largest deltas in the entire history by *file count*. It added the Node universal model + NodeVersion + NodeAlias + NodeEdge + typed shapes (Memory, Acu, Notebook, Note, Bookmark, Artifact, Document, Email) registered as `cap-store.*` schemas.
- Companion `seeds/` directory introduced: `seeds/nodes/`, `seeds/capabilities/`, `seeds/parsers/`, `seeds/adapters/`, `seeds/migrations/`, `seeds/audit-events/` (per v0.1.0 sample).

### Architecture

```
graph Node ──┬── NodeVersion (immutable history)
             ├── NodeAlias   (entity → canonical)
             └── NodeEdge    (typed rel + weight)

Memory/ACU/Bookmark/Note/Notebook/Artifact/Document/Email → typed-shape on Node
```

### Runtime

- `ConversationManager.captureAsNode()` auto-captures every message as a Node with `responds_to` edge.
- `recordMemory()` emits `cap-store.memory` Nodes with FSRS-6 initial state.
- `rebuildGraphFromNodes()` is the re-materialization tool (ADR-001).

### Data

Single SQLite (`prisma/schema.prisma`), single Node model augmented, no DB split yet.

### Strengths

- This is the **first institutional insight** of the repo: "everything is a node, edges have weight, versions all chain". Future eras (DB split, memory, collections) all assume this.
- Seeds encode the contract as data, not code (the foundation of the seeds-as-truth pattern later declared as invariant 4).
- Big-bang splits also embed the `src/engines/` to 341-engine surface in one transaction — future eras only evolved it.

### Weaknesses

- **No boundary yet.** Fork-and-fill pattern: 481 files / 120k lines in one commit makes bisect-ability terrible. Any bug introduced in this commit is statistically hard to drill into because no era-2-events were caught before more refactors landed.
- Captures an early **contracts vs impls** tension (`src/storage/contracts/node-store.ts` and `src/storage/impl/...`). The contract is enforced as an architectural rule (invariant 2) later.

### Assumptions baked in

- "Every domain object is a Node" is treated as an invariant. Future eras stop validating this; they only extend it. If the assumption is wrong, the project scrolls under its own weight.
- One-file-typescript-as-Node-edition is the assumed granularity. This makes bulk imports expensive.

### Debt

- 481 files entered at once, meaning ~13% of v0.1.0's eventual ~2,088 file count is one commit's deposit.
- The "Node graph is the truth" thesis is not testable from within. ADR-001 commits to reflow edges, but if the Node-shape is wrong, the cursor toward architecture is wrong.

### Reversibility

Hard. The contract `Node` is referenced in 459+ files at HEAD; rollback would require ripping the ACU/FSRS layer out and reverting to conversation-stream primitives. Soft fallbacks are possible (e.g., disable FSRS-6 recalc) but the schema migration cost is real.

---

## Era 2 — Tauri V2 desktop integration (`b23813f → e1952fc`)

- **Anchor:** `e1952fc` "feat: integrate Tauri V2 desktop layer + new backend modules, fix capability boot await"
- **Range:** `b23813f..e1952fc` = **104 commits**, **+1,589 added, -320 removed** (the second big-bang).
- **Stat at anchor:** 145 files / +14,907 / -71

### Intent

Make the platform ship as a desktop application (Tauri V2 — `src-tauri/`) on Windows; package the Bun backend as a sidecar that Tauri supervises. Move from "local script" to "binary that a non-developer can run".

### Evidence

- New `src-tauri/` (Cargo.toml, capabilities, src, tauri.conf.json, icons, gen, build.rs) appears.
- `+1,589 / -320` indicates a simultaneous *add* of Tauri layer *and* a *remove* of older/stale scaffolds. Net gain is dominant.
- The "fix capability boot await" suggests an inflight race during Tauri integration.

### Architecture

```
[Tauri WebView]
  ├── React (Next.js static export from frontend/)
  └── CapabilityGovernor (browser-side)
  ↓
  ├─ Tauri Rust host (supervisor)
  │   ├── spawns Bun sidecar (vivim-server-x86_64-pc-windows-msvc.exe)
  │   └── forwards ws over Loopback RPC
  └─ RPC over ws (port 9420/9421)
       ├── Chrome CDP slaves for chat providers
       └── Prisma SQLite for state
```

### Runtime

- Bun sidecar compiled with `bun build --compile`, then compressed via UPX (`-3 --no-lzma`, final 45.6 MB).
- Two binary artifacts in repo (later external via NSIS): `vivim-server-*.exe` (sidecar) and `vivim-desktop.exe` (Tauri host).
- `scripts/tauri/{build.ps1, build-sidecar.ps1, version.ts, compile-sidecar.ts, prepare-frontend.ts}` chain into the devops/desktop CLI toolkit (`devops/desktop/index.ts`).

### State / Dev / Security

- HTTP/WS are local-only; CSP `unsafe-eval`/`unsafe-inline` baked into `tauri.conf.json` for Next.js static export. Updater disabled.
- 5-gate orchestrator (`run` action): Build → Install → Launch+Render → Capture → Report.

### Strengths

- Establishes the project's *production* surface (the eventual NSIS installer), then layers desktop backend onto a stable Node graph: no rework required.
- The devops desktop toolkit (`devops/desktop/`) is the project's most production-grade subsystem. 15-action CLI; hash-gated rebuild; per-installation state.

### Weaknesses

- "fix capability boot await" reveals a non-deterministic startup race.
- The Tauri + Bun + WebView stack has three separate sources of truth for type drift (Rust cargo deps, Bun package.json, Next.js package.json) — future eras accumulate tedious version-pin friction.

### Debt

- Sidecar binary weight: 94 MB unpinned Bun runtime + ~3 MB app code ≈ 97 MB; final 45.6 MB after UPX.
- App-sidebuild pipeline (`scripts/tauri/build.ps1`) is shell-bound to PowerShell and Windows — invisible friction for portability beyond Phase 6.

### Reversibility

**Medium.** Tauri is an integration layer; the underlying CLI/API surface is portable. Removing it would leave `frontend/` + Bun backend but cap at "local devtool". Production users would lose the .exe.

---

## Era 3 — Capability-driven conversational era (`1cae2a1`)

- **Anchor:** `1cae2a1` "feat: accumulated upgrades — CDP transport, ChromeGovernor real, knowledge/mux/context/autonomous/sovereign phases 14-20, v11 completion units 31-37, frontend web/ui migration, cleanup"
- **Range:** accessible via `git show --shortstat 1cae2a1` = **288 files / +42,955 / -5,732** (no precursors are pure deltas; this is a checkpoint).
- **Stat note:** The previous era ended at `e1952fc`, but `git log e1952fc..1cae2a1` returns **0** reachable commits reversed — this is a checkpoint merge under one root, mapped via `git reset`–style reflow. The stat above is what `e1952fc..1cae2a1` represents.

### Intent

A **big-bang checkpoint** that:

1. Replaces the synthetic CDP transport with a real one (`BunCdpClient` later wrapped in `ChromeGovernor`).
2. Implements 7 phases (14–20) — knowledge, mux, context-assembly, autonomous, sovereign (graded as upgrades 14-20).
3. Completes v11 completion units 31-37.
4. Migrates UI from `frontend/` (next-only) → `web/ui/` (a typed router migration).
5. Cleans up cruft.

### Evidence via the audit

- File *deletions* (`+573 / -1,342`) signal the strong churn: 1,342 files removed in this era.
- The stat per `e1952fc..1cae2a1` was reported earlier — *additional* evidence suggests this era also merged an unreleased experimental branch (audit §6: "accretion-only chains visible"). The repo's `--all` graph reveals no actual merge commits; the merging happened historically and re-emerged here as a linear commit.

### Architecture (deposited here)

- `ChromeGovernor` introduced as the **only place that touches CDP** (invariant 1).
- `CapabilityEngine`, `CapabilityResolutionEngine`, `ConversationManager` stabilized.
- `nlcl/` namespace added (natural-language command layer).
- `/api/interpret` + `/api/capabilities/:id/execute` become the single entry point (invariant 11).

### Strengths

- Sets up the **governor canon** (invariant 1) cleanly.
- Forecloses the multiplicity of ways to call CDP.
- Establishes the api-as-API-vs-CLI vs-UI vs-MCP parity contract (`devops verify-cross-surface` later enforces this).

### Weaknesses

- **High file churn** — the "cleanup" inside the same commit makes bisect less reliable. A reviewer sees 288 / +42k / -5k but cannot tell *which* deletions mattered. Future eras will interrogate this as a weak spot.
- "frontend web/ui migration" pulled the UI out of `frontend/` into `web/ui/` — *but later era 6 collides again.* This is the **renaming trail**: frontend → web/ui → live ; this convention churn swallows dev time.

### Debt

- A second source of truth for the conversational pipeline: code-driven `CapabilityEngine` plus code-driven `ConversationManager` plus DB-driven parsers. The declarative DB-driven parser system is the cleaning-up move of era 5.
- Documentation lives for a while in `knowledge/` before `docs/` rewrite restructures it.

### Assumptions baked in

- The CDP transport is controlled and the governor is the sole playwright → invariants assumed testable.

### Reversibility

Hard. Retiring ChromeGovernor means downgrading conversational support to API-mode only (no ChatGPT-clone providers via Playwright).

---

## Era 4 — DB split (`1cae2a1 → 24576ce`)

- **Anchor:** `24576ce` "feat: dual-DB split (system/user), prisma schema split, and cross-boundary storage layer"
- **Range:** `1cae2a1..24576ce` = **108 commits**, **+1,561 / -579** (mid-range big-bang).
- **Stat at anchor:** **569 files / +373,787 / -2,948**
- **Real hand-written delta:** 514 files / +11,134 / -2,948 (the +5962/+362,653 inflated record comes from generated Prisma client files under `src/generated/`).

### Intent

Conclude the boundary tension that started in Era 1: **separate system metadata from user data** into different SQLite databases. Stop the global Node graph from leaking into system primitives, and avoid the "user deletes their data and nukes system registry" reverse-tenant issue.

### Evidence (verbatim from `src/storage/prisma.ts` at `experimental-dev`)

Two PrismaClient singletons:

```
System = providers, capabilities, routing, telemetry, health, config
User   = conversations, nodes, memory, sessions
```

Backing `file:./<name>.db` → resolved relative to `prisma/{system,user}/`.

### Architecture (deposited)

- `prisma/{schema.prisma, system/schema.prisma, user/schema.prisma}`.
- `src/storage/{snapshot.ts, cross-boundary-cache.ts, db-health.ts}` cross-boundary layer.
- `src/__generated__/provider-protocol.ts` as *the* DB-driven static protocol layer (later generated from primary DB).

### Strengths

- Honest architectural separation. This is where the project starts looking professional.
- The protocol-from-DB pattern (`bun run gen:protocol`) reads the capability+seed runtime out as static TypeScript — fast, decouples the hot loop from the DB lifecycle.

### Weaknesses

- **+362,653 lines of generated Prisma client** at commit time. This is *machine but tracked*. Not committed-to-DB but committed-to-tree. Future eras will need to clean this up.
- Schema migration now requires syncing two `schema.prisma` files; manual out-of-band for cross-DB references.
- `bun run typecheck` at this point likely has DB-typed errors that the generated code amplifies.

### Debt

- DB-split boundary is enforced by *path*, not by explicit policy. Future migration off SQLite will need to repeat this at the schema layer.
- Comparison: 2088 (v0.1.0) → 2624 (origin/master) at this anchor — the file count is inflated by generated client + the dual schema.

### Reversibility

Medium. The user/system partition can be merged back at the *interface* (a single Prisma client that switches tables); but each optimizer (telemetry, health, registry) was wired to the system client — moving them back = re-plumbing.

---

## Era 5 — Cleanup + intelligence (`24576ce → 331071b → 8ce86b6 → edd8fa5 → 8d29543 → 3949aa5`)

- **Range:** `24576ce..3949aa5` = **127 commits**, stats dominated by:
  - `24576ce..331071b`: +31 / -182 (after-split cleanup; small but disciplined).
  - `331071b..8ce86b6`: +5 / -274 (massive doc purge — most deletions in one commit).
  - `8ce86b6..edd8fa5`: +282 / -10 (small accretion into 27 commits; edd8fa5 itself: 27 files / +12 / -3,114 including 12 schemas/ and 3 bench files).
  - `edd8fa5…8d29543…3949aa5`: small accretion + 9-phase intelligence upgrade + Phase 6 big-bang.

### Intent

Six-phase checkpoint + intelligence layer:

1. Restore invariants and rebalance the engines.
2. Migrate to a static protocol generator.
3. Drop generated binaries from tracking (in `11e6458`).
4. Add 9-phase "intelligence upgrade" (zero new deps).
5. Implement Phase 6 — collections, memory upgrades, engine improvements.

### Evidence (`3949aa5` Phase 6 anchor)

- **141 files / +49,102 / -2,449** at HEAD. The largest ACU-era commit since Era 1.
- Phase 6 added **38 new dirs** including: `intelligence-pack-acu-dcb-storage/`, `claude-investigate/` (dev-only), `prd-merged/`, `context-pack-md/`. 37 .md / 21 .ts / 1 .tsx / 1 .json / 1 .zip artifacts.
- `IMPLEMENTATION_PLAN_PHASE6.md` is a planning artifact — undislodged.

### Strengths

- The "9-phase intelligence upgrade with zero new deps" is exactly what the project needs: rigid constraints force intra-repo creativity.
- Phase 6 collections + memory upgrades is clean: the engine surface is now **459** engines at HEAD.

### Weaknesses

- `claude-investigate/` is a *dev signals directory* that landed in tracking. Should likely have been gitignored.
- `prd-merged/` directory sitting next to `docs/` invites them to drift apart. The canonical location is `docs/architecture/` (where this file is).

### Debt

- Phase 6 added 49,102 + lines without deleting proportionally older code. Future cleanup will likely find obsolete handler classes.
- Generated bloat removed at `11e6458` (-737,938 lines). Means the post-3949aa5 era absorbed the cost.

### Assumptions

- Future eras can rely on these invariants for cross-engine communication.

### Reversibility

Easy. These commits are deletions-light and add small atomic engines.

---

## Era 6 — Cleanup + bloat archaeology (`11e6458 → 2b6adde`)

- **Anchor:** `11e6458` and `2b6adde`.
- **Stat `11e6458`:** 57 files / +9 / **-737,938** (massive generated-bloat removal).
- **Stat `2b6adde`:** cleanup bloat and minor formatting.

### Intent

Make the repo safe to clone on a fresh dev machine: remove generated binaries, prune schemas/ artifacts, simplify commit history's surface area.

### Evidence

- `git log --diff-filter=D --name-status 19966f3` shows the earliest big drop: **49 root-level junk files** (37 .md working notes, 5 .txt debug/dump logs, 1 .err, 1 .png, 2 .ts, 1 .mjs, 1 .yaml) in **one commit** that removed **207,499 lines**.
- `git log --diff-filter=D --name-status edd8fa5` shows another epoch-cleaning: **27 files / +12 / -3,114**, including 12 `schemas/*.json` and 3 bench files.
- The 8.5 GB reclaim claimed in the commit message is consistent with those artifact removals.

### Strengths

- This era clears the repo for shipping. The post-cleanup HEADs all have file-counts safely under 2,650.

### Weaknesses

- These cleanups themselves commit *visible history* — still leaving room to argue "lost docs are now in working memory only." The archive decisions are non-trivial.

### Debt

- A new maintenance burden: auditors must understand *why* artifacts like `schemas/` were dropped. Generated-in-place schemas are recapture-on-bootstrap, but not all are.

### Reversibility

Easy. The deleted schemas are reconstructible from the seed scripts (`bun run devops … reseed`) and from `--follow` git history.

---

## Era 7 — Live experimental dev (`2b6adde → 174ddfa`)

- **Anchor:** `experimental-dev (174ddfa)` "fix: remediate 5 audit enhancements (deps, ci, route-sync, bloat, safe-eval) + H1-H15"
- **Stat:** 40 files / +1,699 / -659.

### Intent

Apply 15 hardening items (H1–H15) on top of destination dead-code analysis (deps), CI fixes, route-sync, bloat removal, safe-eval.

### Evidence

- The 1,699 / -659 ratio (2.5 net add) suggests controlled accretion.
- `H1–H15` numbers indicate pre-planned remediation.

### Architecture

- No large new engines. Cosmies: standardizing Bun dependency, fixing the LLM-test lint path, removing opensearch bypass on Node, etc.

### Strengths

- Tells the *story* "this is the experimental-dev branch as future-facing fix-only."
- Sets the project up for the next era: a master branch with stricter standards than fast iteration.

### Weaknesses

- Branch name "experimental" suggests maturity mismatch. Might be dangerous to users who choose experimental thinking "modern" but receiving "fix-only."
- No contract on what makes a feature experimental vs core.

### Reversibility

Fully reversible. The only danger is upstream merge that pulls in code that becomes its own invariants.

---

## Era 8 — Observation phase (current state, `174ddfa` → present)

- **Anchor:** master HEAD `3949aa5` is the designated *production* candidate anchor (Phase 6).
- **Live:** Tags: `v0.1.0 → 77c332c` (2088 files, **341** engines).
- **Untracked dirs in working tree:** `.cip/`, `snapshots/`, `src/generated/`. None registered in `.gitignore`.

### Intent

Forensic observation — extract value without modifying.

### Evidence

- `git fsck --no-progress` confirms 2 dangling objects (commit `11554a9b…`, tree `aaf3a4…`); both benign.
- All `git ls-tree HEAD` operations return 2,648 files; no corruption.
- This document and `REPOSITORY_FORENSIC_AUDIT.md` are evidence captures.

### The institutional truth

The git repo is *healthy and linear*. There is no orphan branch. There is no hidden merge. The 13-era narrative reconciles.

### The right anchor for any future migration

**`77c332c` (v0.1.0) is the most rational baseline** because:

1. It is tagged as a release (`v0.1.0`).
2. It is post-Era-1 (Node graph) but pre-Era-2 (Tauri desktop).
3. It has the smallest engine surface (341 vs 459 in HEAD).
4. It is a known-verified totality (2088 files enumerated twice).

The post-77c332c eras add:

- Tauri desktop (Era 2),
- Chrome CDP/`ChromeGovernor` (Era 3),
- DB split (Era 4),
- Static protocol generator (Era 5),
- Phase 6 intelligence (Era 5),
- Bloat archaeology (Era 6),
- Hardening (Era 7).

Any forward migration must decide whether to bring *all* of these forward or only the *abi-clean* ones (e.g., the static protocol generator is +abi-clean; the DB split is not immediately; the Tauri layer is additive but not in core contracts).

### Reversibility

All open. We are in observation phase; no commits are made.

---

## Summary of era deltas (citation index)

| Era | Anchor | Range commits | File Δ | Stat at anchor |
|-----|--------|---------------|--------|----------------|
| 0 | `8e3b7c6` | n/a | n/a | 81 / +10,661 |
| 1 | `b23813f` | 57 | +1,181/-10 | 481 / +120,406 / -4,567 |
| 2 | `e1952fc` | 104 | +1,589/-320 | 145 / +14,907 / -71 |
| 3 | `1cae2a1` | 0 (checkpoint) | +573/-1,342 | 288 / +42,955 / -5,732 |
| 4 | `24576ce` | 108 | +1,561/-579 | 569 / +373,787 / -2,948 |
| 5a | `331071b` | post-split cleanup | +31/-182 | 438 / +12,976 / -4,824 |
| 5b | `8ce86b6` | doc purge | +5/-274 | 119 / +3,773 / -18,821 |
| 5c | `8d29543` | intelligence upgrade | +4/-0 | 18 / +985 / -71 |
| 5d | `3949aa5` | Phase 6 | +62/-4 | 141 / +49,102 / -2,449 |
| 6a | `11e6458` | bloat removal | n/a | 57 / +9 / -737,938 |
| 6b | `2b6adde` | bloat cleanup | n/a | (-2-) |
| 7 | `174ddfa` | hardening | n/a | 40 / +1,699 / -659 |

---

## Open questions for Phase 4-8 (next-phase forensic investigation)

1. **Why was Era 3 a 0-commits range checkpoint?** Was this an experiment, a squash rebase, or a remote-sync issue? Investigate `git fsck --unreachable` for hints.
2. **What does `intelligence-pack-acu-dcb-storage/` *do?*** Has it been wired into the API surface (e.g., is its CLI command reachable?), or is it a research wrapper?
3. **What lives in `claude-investigate/`?** Is it dev-only signal that should be gitignored?
4. **What was `prd-merged/` for?** What merge target existed?
5. **Did the DB split ever validate the boundary under load?** Are there per-DB seed migration orderings?
6. **Where are the `H1-H15` documented?** Are they in `.opencode/memory/`? `docs/`? `PROGRESS.md`?
7. **What's the real story at `447524c`?** That's pre-Phase-6, near cleanup, with `nlcl-otel tests` added. Is there a documentation basis?

These eight questions become the Phase 4 queries.

---

## Forward-link

Phase 5 (inflection-point analysis) + Phase 6 (baseline ranking) cluster around:
- ERAS rank: Era 1 (Node fork) → Era 4 (DB split) → Era 5d (Phase 6).
- Baseline candidates: `77c332c` (v0.1.0), `447524c` (pre-`edd8fa5`), `3949aa5` (Phase 6 master).
- Re-ranker: prioritization per (reversibility, trace coverage, schema-migration safety, completeness).
