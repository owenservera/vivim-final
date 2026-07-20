# Implementation Plan: Local-Agent OpenCode Provider (Zen free models)

**Branch**: `022-local-agent-opencode` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-local-agent-opencode/spec.md`

## Summary

Wire the 4 verified Zen free OpenCode models as a `local-agent` provider so the
`UnifiedCapabilityRegistry` can dispatch them via a `cap:agent:run` capability. The executor
shells `opencode run --auto --model <allowed> --format json` and parses stdout into the
canonical `ContentBlock[]` — no CDP, no ChromeGovernor (Governor Canon preserved).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18
**Storage**: SQLite via Prisma (dev.db) — provider + model + capability rows
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (13 engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Agent cold-start latency observed 37–54s on this host; hard `timeoutMs` 120s.
**Constraints**: Governor Canon (no engine imports BunCdpClient); Store Contracts (engines depend on contracts, not impls); One Entry Point (every op is a UnifiedCapability); Custom errors (no raw `new Error()` in engines); TypeScript strict (no `any`, `type` imports, `.js` extensions).

**Verified ground truth (2026-07-19, executed on host)**:
- `opencode` on PATH; Zen free models cost 0, no key.
- Working: `opencode/deepseek-v4-flash-free` (~43s), `opencode/hy3-free` (~54s),
  `opencode/mimo-v2.5-free` (~41s), `opencode/north-mini-code-free` (~37s).
- Broken: `opencode/nemotron-3-ultra-free` (no output in 5 min) — excluded.
- `--format json` stream: `{type:'step_start'|'text'|'step_finish', part:{type:'text',text}, tokens:{cost:0}}`.
- `serve` starts unsecured unless `OPENCODE_SERVER_PASSWORD` set — out of scope for v1.

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: `LocalAgentProviderExecutor` shells `opencode` via `Bun.spawn`; imports nothing from `chrome-governor` or `BunCdpClient`.
- [x] Store Contracts: executor depends on `LocalAgentStore` contract interface, not a Prisma impl directly.
- [x] One Entry Point: dispatch is a single `cap:agent:run` UnifiedCapability, not a second transport.
- [x] Custom errors: failures use `EngineError` from `src/errors.js` (no raw `new Error()`).
- [x] TypeScript strict: `type` imports, `.js` extensions, no `any` (use `unknown` + narrowing).
- [x] Tests: unit (parse + allow-list) + integration (mocked store) + typecheck + lint gates.

## Project Structure

### Documentation (this feature)

```text
specs/022-local-agent-opencode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── local-agent-store.md
└── tasks.md             # Phase 2 output (post-plan)
```

### Source Code (new)

```text
src/
├── engines/
│   ├── local-agent-executor.ts     # LocalAgentProviderExecutor (spawn + parse)
│   └── capability-bootstrap.ts      # register cap:agent:run (extend defaults)
├── storage/
│   └── contracts/
│       └── local-agent-store.ts     # LocalAgentStore interface
└── schema/
    └── local-agent.ts               # Zod: LocalAgentConfig, AgentRunInput
seeds/providers/
└── local-agent.ts                   # opencode manifest (4 free models)
```

**Structure Decision**: Extend existing 13-engine monorepo. `local-agent` is a NEW
`provider_type` enum value (not CDP). No changes to ChromeGovernor, conversation-manager
capture path, or stream-parser DB logic.

## Complexity Tracking

> No constitution violations. All constraints satisfied by design (dedicated store contract +
> executor that shells the CLI; Governor Canon untouched).
