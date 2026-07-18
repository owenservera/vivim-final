---
name: arch-audit
description: Architecture-audit subsystem for vivim-final. Drives the deterministic mechanics in devops/audit-arch/ via bun run devops audit-arch <scope> [flags]. Analyses module boundaries, dependency graphs, and architectural invariants.
---
# arch-audit

Architecture-audit subsystem for vivim-final. It is the creative-orchestration
skill that drives the deterministic mechanics in `devops/audit-arch/` via
`bun run devops audit-arch <scope> [flags]`. It complements `source-audit`
(`devops audit-code`) — which finds LINE-level smells — by analysing the
codebase as a MODULE / LAYER GRAPH: cycles, layering direction, coupling,
cohesion, and the hard boundaries (Governor Canon, Store Contract).

## When to Load

**Load this skill when:**
1. User says "architecture audit", "audit the architecture", "map the
   dependencies", "find cycles / circular deps", "check layering"
2. User wants to know how modules depend on each other, or suspects a
   god-module / hub / tangled core
3. User asks "does the code respect the layers", "is the Governor Canon intact"
4. Before a big refactor: "what would break if I move X", "where is the coupling"
5. After a large change set and wants a STRUCTURAL health check (vs the
   semantic health check from `source-audit`)

**Do NOT load when:**
- Only line-level issues (secrets, dead code, `any`) are wanted → use `source-audit`
- Only a single unit needs work (implement directly)

## Core Concepts

### 1. The Module Graph
`devops/audit-arch/graph.ts` walks `src`, parses every `import` / `export from`
/ dynamic `import()` / `require()` specifier, resolves it to an in-repo module,
and builds a directed module-dependency graph.

- A **module** is a coarse grouping: a file directly under `src/` (e.g.
  `ids`) or the first two path segments (e.g. `engines/stealth`).
- Edges are deduplicated at module level. `.js` import extensions are mapped
  back to the real `.ts` file (Bun ESM convention).

### 2. Depth Tiers (cumulative, sequential passes)
| Tier | Passes run | Cost |
|------|-----------|------|
| **surface** | cycles + layering (upward only) | fast |
| **standard** | surface + coupling + cohesion + commands | +medium |
| **deep** | standard + boundaries (reuses `invariants.ts` cat B) | +slow (invariants scan) |
| **full** | deep + baseline trend comparison (new/resolved vs last `--baseline`) | +analysis |

Default tier: **standard**.

### 3. Dimensions (structural categories)
`layering` · `cycles` · `coupling` · `cohesion` · `boundaries` · `commands`.

- `cycles` — strongly-connected module cycles (Tarjan SCC). P1.
- `layering` — upward dependencies (a lower layer imports a higher one) → P1;
  skip-layer dependencies (advisory) → P3, emitted only in `deep`/`full`.
- `coupling` — hub/god modules (fan-in+fan-out ≥ 25) → P2; orphans → P3.
- `cohesion` — modules that mostly import OUTSIDE themselves → P2.
- `boundaries` — reuses `devops/invariants.ts` (category B) so the hard,
  enforced boundaries (Governor Canon B1, Store Contract B2, …) appear in the
  same report. B1/B2 are P0; no logic is duplicated.
- `commands` — audits the **single command layer** (the v10 invariant: every
  operation is a `UnifiedCapability`). Statically cross-checks the capability
  definitions in `src/engines/capability-bootstrap.ts` against the NL catalog
  (`src/engines/nlcl/catalog.ts` `capabilityId` bindings) and frontend actions
  (`web/ui/src/actions` `ActionRegistry.register`). Surfaces **potential new
  commands** (capabilities with no NL catalog entry) and **central command
  candidates** (same `cliCommand` declared by multiple capabilities), plus real
  inconsistencies: dangling catalog bindings → P1, duplicate capability ids →
  P1, surface declared but unbound → P2, frontend action without backing
  capability → P3.

### 4. The Layering Policy (TUNED in one place)
`devops/audit-arch/policy.ts` is the single source of truth: it maps module
prefixes to integer layers (0 foundation → 5 surface) and declares the
dependency direction (deps flow toward the foundation). **Edit `LAYER_RULES`
to reflect the real intended architecture.** Mis-tuned layers produce
advisory `layering` findings, not crashes — the tool is robust even before the
policy is fully calibrated.

## Modes

- **System-wide** (default): analyses the whole `src` graph.
- **Targeted**: `--module <prefix>` restricts to one module + its 1-hop
  neighbourhood (great for "what would break if I touch X?").
- **Single pass**: `--pass <name>` runs only one pass.

## Commands

```
bun run devops audit-arch [scope] [flags]
  scope: surface | standard | deep | full      (default: standard)
  --module <prefix>   targeted audit of one module + 1-hop neighborhood
  --pass <name>       run a single pass (cycles|layering|coupling|cohesion|boundaries|commands)
  --report            (default) write + print report
  --json              also write arch-graph.json (module graph artifact)
  --export            write arch-findings.json only (no report)
  --baseline          save findings as a trend baseline
  --compare           (full) diff vs last baseline
```

## Output

### Report — `docs/audits/arch/ARCH-AUDIT-<system|module>-<scope>-<date>.md`
Graph Overview (modules, edges, cycles, layer histogram, top hubs) →
Executive Summary (risk H/M/L + P0–P3) → Priority Legend → findings grouped by
priority → dimension → per-finding block (location, evidence, impact, Fix
Instructions with steps + effort) → Fix Backlog table.

### Machine — `docs/audits/arch/arch-findings.json`
Same schema as `source-audit` findings (id `AR-…`, priority, dimension,
evidence, fix). Plus optional `arch-graph.json` (modules, edges, layers,
per-module metrics).

## Workflow

```
1. Decide tier. Default `standard`. Use `surface` for a fast cycle/layering
   check, `deep` to also assert the hard boundaries, `full` for a release gate.
2. (Targeted) `bun run devops audit-arch standard --module engines/stealth`
   to scope a refactor.
3. Run: `bun run devops audit-arch <scope>` — reads the printed report +
   written markdown.
4. Triage by priority. P0 (boundaries) must be fixed; P1 (cycles / upward)
   next; P2 (hubs / low cohesion) are quality debt.
5. (Tune) If `layering` findings look wrong, edit `LAYER_RULES` in
   `devops/audit-arch/policy.ts` and re-run — the policy is the only knob.
6. (Trend) `bun run devops audit-arch full --baseline` after fixing, then
   `full --compare` next cycle to see new/resolved.
```

## Wiring into DevOps

- **CLI verb:** `audit-arch` in `devops/index.ts` → `devops/audit-arch/index.ts`.
- **Deterministic mechanics:** `devops/audit-arch/` (Bun + stdlib only). Reuses
  `audit-code/findings.ts` (Finding model, persistence, trend) and
  `invariants.ts` (category B boundaries) — no duplication of those.
- **State:** `docs/audits/arch/ARCH-AUDIT-*.md`, `arch-findings.json`,
  `arch-graph.json`, `baseline-<date>.json`.
- **Separation of concerns:** `source-audit` = line-level; `arch-audit` =
  structural. They share the machine format so both feed the same backlog.

## Key Invariants

- **Reuse, don't duplicate.** Boundary checks come from `invariants.ts`;
  the Finding model from `audit-code/findings.ts`.
- **Modular + sequential.** Each pass is an independent function in
  `devops/audit-arch/passes/`; deeper scopes run every shallower pass in order.
- **Policy is the only knob.** Layering verdicts are advisory and tunable in
  `policy.ts`; `cycles` / `coupling` / `cohesion` are structural facts.
- **Local + deterministic.** No web search; the audit scans the working tree.

---

## SpecKit Integration

Architecture findings feed into SpecKit plan's "Constitution Check" section.

### Mapping Arch Findings to Tasks

| Finding Type | SpecKit Integration |
|-------------|---------------------|
| Cycle violations | → tasks in tasks.md format via converge |
| Layering violations | → plan Phase 0 constitution check |
| Coupling issues | → convergence tasks |

### Bridge Commands

| Command | Purpose |
|---------|---------|
| `bun run devops speckit converge <featureDir>` | Run arch audit + append tasks |
| `bun run devops speckit gate --scope=phase` | Unified gate with invariants |

### Key Modules

| Module | Purpose |
|--------|---------|
| `devops/speckit-converge-bridge.ts` | Unified converge pipeline |
| `devops/unified-gate.ts` | Unified quality gate |
