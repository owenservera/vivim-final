# VIVIM Constitution

## Core Principles

### I. Governor Canon (NON-NEGOTIABLE)
Only `ChromeGovernor` touches CDP (`BunCdpClient`). No engine imports `BunCdpClient` directly.
This is enforced by `bun run devops invariants check --category B` and is a hard gate.
Exempt entities must be documented in invariants.ts.

### II. Store Contracts (NON-NEGOTIABLE)
Engines depend on `src/storage/contracts/*.ts` interfaces, never `src/storage/impl/*.ts`.
Implementation details are hidden behind contracts. This enables testing with mock stores
and prevents coupling to Prisma or storage internals.

### III. One Entry Point (NON-NEGOTIABLE)
Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
call `POST /api/interpret` → `POST /api/capabilities/:id/execute`.
- New capability: register in `registerDefaultCapabilities` / a `*caps.ts` module.
- New NL phrase: add a pattern to `catalog.ts` bound to a `capabilityId`.
- Never: hand-write CLI commands, hand-write UI actions, or open a second transport.

### IV. Research-First
No implementation without research report classification. Phase N requires Phase N-1 complete.
Evidence-before-action. Truth scans before roadmap modifications.

### V. Code Quality Standards
- TypeScript strict mode, ESNext target, `.js` extension in imports (Bun ESM)
- Prefer `type` imports: `import type { Foo } from './bar.js'`
- No `any` — use `unknown` + type narrowing
- Zod for runtime validation at boundaries
- Custom error classes from `src/errors.ts` — never raw `new Error()`
- ULID for IDs via `src/ids.ts`
- Barrell exports from `src/index.ts`
- `Result<T, E>` pattern where appropriate

### VI. Testing Gates (NON-NEGOTIABLE)
- `bun test` must pass before every commit
- `bun run typecheck` — 0 errors
- `bun run lint` — 0 warnings
- `bun run devops invariants check --category B` — 0 block violations
- `bun run devops audit-code standard` — 0 P0 findings
- `bun run devops verify-cross-surface` — all capabilities resolve across CLI/API/MCP/UI
- Unit tests for engine files, integration tests for engine interactions, E2E for full stack

## Architecture Constraints

### Engine Layers
- L0-L1: Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
- L2-L3: Capability System (CapabilityResolutionEngine, CapabilityEngine)
- L4: Session & State (ConversationManager, StreamBlockStore)
- Chrome Layer: ChromeGovernor (CDP proxy, lifecycle, trace, health)
- Cross-cutting: CapabilityEventBus, ConfigManager, StreamParserEngine
- Lifecycle: RegistrationAuditor, VersionManager, TelemetryAggregator

### Database
- Prisma ORM only — never raw SQL unless performance-critical
- Seed once via `bun run db:setup` (migrate + seed), NOT at boot
- `bun run serve` starts engines only — no re-seeding, no migrate
- Seed JSON manifests in `seeds/` are the authoritative data source
- Transactions for multi-table writes

### Frontend
- Primary surface: unified infinite canvas (`web/ui/src/features/canvas/CanvasSurface.tsx`)
- Driven by DB-backed provider-type conceptual model (`ProviderType` + `UiComponent`, 4-tier resolution)
- Prefer adding `UiComponent` tiers over hardcoded `if (slug === 'x')` branches
- `ChatPage` is a secondary tab; the canvas is the generative backbone
- Capability-driven: UI actions resolve through `CapabilityResolutionEngine`

### Shell Environment
- All commands are PowerShell 7+ compatible
- PS1 scripts use `$PSScriptRoot` — invoke ONLY via `pwsh scripts/<name>.ps1` from repo root
- Never pipe scripts or use `pwsh -c`/`-Command` which breaks `$PSScriptRoot`

### Capability Design
- Every capability has: `id`, `slug`, `name`, `description`, `category`, `inputSchema`, `outputSchema`, `cliCommand`, `ui`, `mcpToolName`, `apiEndpoint`, `surfaces`
- Taxonomy chain gotchas: UI slot IDs must be namespaced (e.g., `chat.actionBar`), capability nodes may lack `category` (derive from slug), verify after taxonomy changes

## Development Workflow

### Adding Features
1. Research phase: evidence and brief before code
2. Define spec: what and why, not how
3. Create implementation plan: tech stack, architecture
4. Break into tasks: independently testable units
5. Implement: red-green-refactor per task
6. Verify: typecheck + lint + test + invariants + audit + cross-surface

### Adding Providers (PRD-12)
1. **SpecKit first:** `/speckit.specify` defines provider contract → `/speckit.plan` → `/speckit.tasks`
2. **DevOps onboard mode:** `bun run devops runtime-test onboard run --goal="onboard <url>"` executes static phase map:
   ```
   discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
   ```
3. **Confidence gates halt on failure** (selector ≥0.8, parser ≥0.7); operator fixes then `--resume`
4. **Every activity logged** to `.runtime/activity.log` for post-mortem analysis
5. **Governor Canon applies:** selector-tester takes `BunCdpClient` + sessionId, never imports CDP directly

### Git Conventions
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- One logical change per commit
- Reference engine names in commits: `feat(CapabilityEngine): add selector resolution`

### File Organization
- `src/engines/` — one file per engine
- `src/storage/contracts/` — engine-facing interfaces
- `src/storage/impl/` — Prisma-backed implementations
- `tests/unit/`, `tests/integration/`, `tests/e2e/`
- `seeds/` — JSON manifests for DB seeding

## Governance
This constitution supersedes all other practices. Amendments require documentation in ADRs.
All PRs must pass the gate checklist. Complexity that violates principles must be justified.
AGENTS.md and INVARIANTS.md are runtime companions to this constitution.

**Version**: 1.0.0 | **Ratified**: 2025-07-17 | **Last Amended**: 2025-07-17
