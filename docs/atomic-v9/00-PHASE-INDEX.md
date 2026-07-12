# Atomic v9 — Phase Index

**Version:** v9 | **Parent:** atomic-v8 (taxonomy) | **Built on:** docs/atomic (phases 1-22 done)
**Theme:** Unified Command + Config + Oracle Surface ("operate AND configure the whole system")
**PRD:** `docs/prd-kernel-cli-oracle-integration.md`

> v9 turns the structurally-complete but passive kernel/oracle into a live,
> user-facing, configurable system. Every capability, every config point, and
> the full oracle are reachable via CLI, NLCL (natural language), and the
> vivim-canvas frontend — one unified surface.

## Phases in v9

| Phase | Name | Units | Status |
|-------|------|-------|--------|
| 23 | Unified Command + Config + Oracle Surface | 10 | pending |

## Design lineage

- `docs/atomic/phase-18-composable-interface/18.2-cli-complete.md` (capabilities-as-CLI — exists, unwired)
- `src/cli/commands/registry-bridge.ts` (`syncCliFromUnified` — defined, never invoked)
- `src/engines/kernel/` (Oracle: query/diagnostic/actuator/event-stream — complete, no external surface)
- `src/engines/config-manager.ts` + `ConfigStore` (per-scope config — exists)
- `src/engines/telemetry-aggregator.ts` (`reprogram()` — exists for telemetry pipeline)
- `src/engines/nlcl/` (Natural Language Command Layer — exists, comms system)
- `src/canvas/` (vivim-canvas OracleReader + capabilities — exists)
