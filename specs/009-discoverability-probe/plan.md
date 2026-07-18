# Plan: Discoverability Probe (009)

> SPECKIT `plan` artifact. Companion to `spec.md`.

## Context

The vivim system is a "composable interface" where everything is a `UnifiedCapability`
(`src/engines/unified-registry.ts`). Two real introspection paths exist:

1. **`GET /api/capabilities?<surface>`** — enumerates capabilities with full metadata
   (`src/server/capability-router.ts:46`). The CLI thin-client reaches it via `vivim help` /
   `vivim <cap>` (`src/cli/commands/registry-bridge.ts:119,193`).
2. **Kernel oracle** — `POST /api/kernel/oracle/query {op:"all"}` returns topology+health+
   capability+config in one call (`src/server/kernel-router.ts:52`).

The CLI itself is a thin shell (`src/cli/index.ts`): builtins (`automate`, `moments`) plus a
bridge that maps `cli`-surface capabilities to commands. `devops discover-all` /
`devops truth full` provide offline introspection (`devops/runtime-test/discover.ts`).

## Hypothesis (gaps to confirm/deny via tests)

- **GAP-1:** `vivim help` only surfaces `cli`-surface caps (`fetchCliCapabilities` filters
  `?surface=cli`, registry-bridge.ts:120). Non-cli surfaces invisible to the product CLI.
- **GAP-2:** `api`/`ui`/`mcp`/`workflow` capabilities have no `vivim` command and no
  CLI-reachable path → violates "One Entry Point" at the CLI layer.
- **GAP-3:** The kernel oracle (`op:"all"`) is the only true full-system introspection but may
  lack a `vivim`-level command binding → unreachable under the CLI-only constraint.
- **GAP-4:** Two discoverability philosophies coexist — the product `vivim` CLI vs `devops`
  tooling. They are not unified.

## Architecture

```
tests/e2e/discoverability/
  harness.ts                       # CLI spawn + JSON parse + latency helper
  two-command-ceiling.test.ts      # T1 (R1)
  latency-budget.test.ts           # T2 (R2)
  right-data-coverage.test.ts      # T3 (R3)
  oracle-single-call.test.ts       # T4 (R4)
  nl-resolve-speed.test.ts         # T5 (R5)
DISCOVERABILITY-GAPS.md            # R6 gap log
```

### harness.ts (shared)

- `spawnCli(args: string[]): Promise<{ code, stdout, stderr, ms }>` — `Bun.spawn(['bun',
  'run', 'src/cli/index.ts', ...args])`, capture output, measure wall time, enforce a 15s
  timeout (mirrors vivim-runtime agent-safety budget).
- `spawnDevops(args: string[])` — same for `devops` bin.
- `startServer(): Promise<{ stop: () => Promise<void> }>` — spawn `vivim serve` on a dedicated
  port (9421, this env), wait for `/health` 200, return a stopper. Reused by T1/T3/T4/T5.
- `parseCapabilities(json: string): Capability[]` — parse `GET /api/capabilities` output. The
  thin-client `vivim help` prints a human list; for machine assertions we hit the *CLI command
  that maps to the capability endpoint*. Since CLI-only, we rely on `vivim help` text + the
  `devops discover-all` JSON which returns capability ids.

> Note: the CLI thin-client `help` prints human-readable text, not JSON. For structured
> coverage we use `bun run devops discover-all --offline` (returns JSON capability ids) as the
> "known universe" and compare against what `vivim help` can surface. This is still 100% CLI.

## Latency budget

p95 < 2000ms per discovery command, measured over N=5 warm runs. Source of budget: the system's
own runtime-test caps (2min overall / 5s per fetch) and the 2s server bootstrap timeout.

## Test-to-requirement mapping

| Test | Req | Gap it informs |
|------|-----|----------------|
| two-command-ceiling | R1 | GAP-1, GAP-2 |
| latency-budget | R2 | — |
| right-data-coverage | R3 | GAP-1, GAP-2 |
| oracle-single-call | R4 | GAP-3 |
| nl-resolve-speed | R5 | — |

## Risks

- Server bootstrap on 9421 may contend with a running instance on 9420 — we use 9421 explicitly.
- `devops discover-all --offline` requires a static catalog; if missing, that command is itself
  a gap (logged). We fall back to `devops truth full` / `devops report`.
- The CLI thin-client `help` may not list non-cli caps — that is the *expected* GAP-1 finding,
  asserted as a failing/xfail-style measurement rather than a hard failure of the suite.
