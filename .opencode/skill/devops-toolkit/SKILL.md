---
name: devops-toolkit
description: Dedicated devops toolkit for vivim-final reprogrammability / configurability with a hard FRONTEND = BACKEND = SDK = CLI = API parity guarantee. Use when the user wants to regenerate surfaces, check cross-surface parity, reconfigure runtime tunables, or diff surface projections. Triggers on "devops toolkit", "surface parity", "regenerate CLI/API/UI/SDK", "reconfigurable", "runtime config".
---
# VIVIM DevOps Toolkit — Reprogrammability & Cross-Surface Parity

The `devops-toolkit` is the dedicated engine for **maximising reprogrammability and
configurability** of vivim-final while enforcing the invariant:

> **FRONTEND = BACKEND = SDK = CLI = API** — every capability is defined ONCE
> (a single `slug` + declarative metadata in `seeds/taxonomy/pool.taxonomy.json`)
> and projected onto all surfaces from that one source. No surface may drift.

It composes with (never replaces) the existing SDD pipeline:
- **SpecKit** (`.specify/`, `/speckit.*`) — defines WHAT/WHY/HOW.
- **devops orchestrator** (`devops/index.ts`, 127-unit tracker) — execution runtime.
- **`scripts/verify-cross-surface.ts`** — the read-only FRONTEND=BACKEND gate (PR blocker).
- **`devops/toolkit/`** — THIS toolkit: regenerate + configure + diff projections.

---

## Invariants (must not violate)

1. **Single source of truth.** The capability pool (`seeds/taxonomy/pool.taxonomy.json`)
   is the only place a capability is *defined*. Surface specs (cli/api/sdk/ui/mcp/workflow)
   are *derived*, never hand-authored in engine code.
2. **Parity is enforced, not advisory.** `devops toolkit parity` exits non-zero if any
   capability is out of parity — it can block a PR the same way `verify-cross-surface` does.
3. **Additive only.** The toolkit reads the pool and writes
   `seeds/taxonomy/surface-projections.json`. It does NOT mutate engine code, the
   SpecKit commands, or the devops orchestrator core.
4. **Configurability via tunables.** Runtime behaviour lives in `src/config.ts`
   `TUNABLE_SCHEMA` + `.runtime/config.tunables.json`, set through `devops toolkit config`.
   Engines read `getTunable()` instead of re-reading `process.env` directly.

---

## Commands

```powershell
# Regenerate all surface projections from the capability pool
bun run devops:toolkit regen

# Verify every capability resolves across all declared surfaces (exit 1 on drift)
bun run devops:toolkit parity
bun run devops:toolkit verify          # alias for parity

# Inspect / set runtime tunables (persisted to .runtime/config.tunables.json)
bun run devops:toolkit config list
bun run devops:toolkit config describe
bun run devops:toolkit config get <key>
bun run devops:toolkit config set <key> <value>

# Show surface-projection deltas vs the last regenerated manifest
bun run devops:toolkit diff
```

(All also available as `bun run devops toolkit <sub>`.)

---

## Subcommand Reference

### `regen`
Reads `seeds/taxonomy/pool.taxonomy.json`, runs each `CapabilityNode` through the
canonical `PROJECTORS` in `devops/toolkit/surface-parity.ts`, and writes
`seeds/taxonomy/surface-projections.json`. This manifest is the regenerated
single-source projection that the SDK client generator and UI slot mapper consume.

### `parity`
Loads the pool, runs `parityReport()` (CLI/API/SDK/UI + derived MCP/workflow), and
prints per-surface coverage. Exit code `1` if any capability is out of parity.
This is the toolkit-native gate; pair it with the static `scripts/verify-cross-surface.ts`
(which additionally enforces `SLOT_IDS` from `frontend/src/ui/slots.ts`).

### `config`
- `list` — effective value per tunable (`*` = override, blank = default).
- `describe` — schema (`type`, `description`, default) for every tunable.
- `get <key>` / `set <key> <value>` — resolve / persist a tunable.
  `set` writes `.runtime/config.tunables.json` so a running server can hot-read it.

Tunables cover: `server.port`, `server.host`, `server.corsOrigin`, `log.level`,
`fleet.autoStart`, `fleet.portStart`, `fleet.portEnd`, `health.probeIntervalMs`,
`surfaces.cliAliases`, `surfaces.enforceParity`.

### `diff`
Compares the persisted `surface-projections.json` against a fresh `regen` in-memory,
reporting `+` (new), `~` (changed), `-` (removed) per slug. Use before committing a
pool change to prove the regeneration is stable.

---

## When to use this skill

- User wants to **add or change a capability** and have CLI/API/SDK/UI/MCP all update
  from one edit → edit the pool, then `devops toolkit regen && devops toolkit parity`.
- User wants to **reconfigure runtime behaviour without code edits** →
  `devops toolkit config set <key> <value>`.
- User asks about **FRONTEND=BACKEND parity**, **SDK parity**, or **surface drift** →
  `devops toolkit parity` (then `scripts/verify-cross-surface.ts` for the full gate).
- Before a PR touching the pool → run `diff` to show the regeneration delta.

## Red flags this skill prevents
- Hand-written CLI command + missed UI slot (one surface updated, others forgotten).
- Hard-coded `process.env` reads scattered across engines (use `getTunable`).
- Pool edited but projections stale (always `regen` after a pool change).
- A capability claiming a surface with an empty/undefined spec (parity gate catches it).
