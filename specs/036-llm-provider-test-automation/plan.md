# Technical Plan: LLM-Driven Provider Testing & Frontend UX Refinement

## Technical Context

### Stack
- **Runtime:** Bun 1.x, PowerShell 7+ (shell)
- **Testing framework:** Bun test, Playwright MCP, CDP (Chrome DevTools Protocol)
- **Frontend:** React 18+ with Vite, custom slot registry (no Tailwind — CSS variables)
- **Backend:** TypeScript, Prisma ORM (SQLite), Elysia HTTP server
- **Provider system:** 8-phase onboarding pipeline (`devops/onboard-controller.ts`)
- **LLM-as-Human test system:** 6 UnifiedCapability entries (`cap:llm_test:*`)

### Existing Infrastructure
- `devops/onboard-controller.ts` — 8-phase pipeline: discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
- `devops/llm-testing/` — LLM-as-Human testing orchestrator with surface adapters (cli, api, ui, mcp, provider, workflow)
- `web/ui/src/ui/registry.ts` — UIComponentRegistry (slot resolution)
- `web/ui/src/ui/slots.ts` — SLOT_IDS catalog (11 named slots)
- `src/engines/provider-selectors.ts` — CDP selector fallback lists
- `tests/fixtures/capture/` — wire-format test fixtures

### Key Dependencies
- Chrome browser for CDP-based provider interaction
- Authenticated profiles for gemini, chatgpt, claude under `chrome-profiles/<slug>/owservera/`
- Backend must serve on port 9420; frontend on port 5173

## Constitution Check

### Governor Canon (NON-NEGOTIABLE)
All CDP interaction through ChromeGovernor. The LLM test adapters already route through Governor bridges — no change needed.

### Store Contracts (NON-NEGOTIABLE)
Engines already use `src/storage/contracts/*.ts`. Test changes to the store layer must follow the same pattern.

### One Entry Point (NON-NEGOTIABLE)
All test actions go through `POST /api/capabilities/:id/execute` or the CLI bridge. No parallel transports.

### Testing Gates (NON-NEGOTIABLE)
- `bun test` before commit
- `bun run typecheck` — 0 errors
- `bun run lint` — 0 warnings
- `bun run devops verify-cross-surface` — 0 gaps

## Architecture

### Layer 1 — Test Orchestrator (`devops/test-automation/`)
Extends the existing LLM-as-Human test system with provider-specific automation:

```
TestOrchestrator
  ├── ProviderTestPipeline   (drives 8 phases per provider)
  ├── WizardTestFlow         (setup wizard steps)
  ├── FrontendAuditor        (slot audit + visual checks)
  └── StreamingVerifier      (progressive render checks)
```

### Layer 2 — Surface Adapters (existing `devops/llm-testing/`)
- **cli** → `bun run src/cli/index.ts` subprocess
- **api** → `fetch` to backend
- **ui** → Playwright bridge via `playwright_browser_*` tools
- **provider** → Chrome slave via CDP bridge (Governor-routed)

### Layer 3 — Report & Knowledge
- `.runtime/llm-testing/sessions/` — session traces per provider test run
- `.runtime/llm-testing/reports/` — markdown reports
- `.runtime/ui-test-registry.json` — UI test history

## Phases

### Phase 1: Provider Test Pipeline Automation
- Build `ProviderTestPipeline` that drives `devops/onboard-controller.ts` phases for all 3 providers
- Each phase emits structured JSON result
- Pipeline fails fast: phase N must pass before phase N+1
- Reuses existing `devops/runtime-test onboard` commands

### Phase 2: Setup Wizard Testing
- Identify wizard render path and slot resolution
- Write Playwright script that detects empty-DB state
- Step through provider selection → profile creation → account auth
- Capture screenshots at each step

### Phase 3: Frontend UI De-Clobber
- Audit every visible element against slot registry
- Remove hardcoded `if (slug === 'x')` branches
- Standardize CSS variables
- Fix layout grid consistency
- Add loading/error/empty states
- Verify with cross-surface parity check

### Phase 4: Streaming Verification
- Capture progressive render screenshots for each provider
- Verify incremental text appearance
- Check cursor/indicator behavior
- Report console errors

## Gate Requirements

- `bun run typecheck` — 0 errors (backend + frontend)
- `bun run lint` — 0 warnings
- `bun test` — all pass
- `bun run devops verify-cross-surface` — 0 gaps
- `bun run devops audit-code standard` — fixes applied
- Visual proof: screenshots of wizard + streaming for all 3 providers
- UI test registry updated: `bun run devops ui-test record`
