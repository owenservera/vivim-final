# vivim-project Skill

## Project Context

vivim-final is a local-first AI conversation platform built with Bun + Prisma + TypeScript. It features a capability-driven architecture with 13 engines organized in layers.

## Key Architectural Layers

- **L0-L1:** Provider Knowledge Graph (ProviderRegistrar, ProviderHealthKernel)
- **L2-L3:** Capability System (CapabilityResolutionEngine, CapabilityEngine)  
- **L4:** Session & State (ConversationManager, StreamBlockStore)
- **Chrome Layer:** ChromeGovernor (CDP proxy, lifecycle, trace, health)
- **Cross-cutting:** CapabilityEventBus, ConfigManager, StreamParserEngine
- **Lifecycle:** RegistrationAuditor, VersionManager, TelemetryAggregator

## Critical Development Rules

### 1. Provider System (KNOW THIS FIRST)

The system supports 16 registered providers. Testing a provider follows an 8-phase onboarding pipeline:

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

**Key command:** `bun run devops runtime-test onboard --provider=<slug>`

**Important:** 
- Parsers live ONLY in the DB (inline `logic_code`, `logic_type=inline`)
- Capabilities are provider-bound (e.g., `send_message`), NOT per-provider slugs like `gemini_send`
- The DB is the single source of truth; `provider-protocol.ts` is generated via `bun run gen:protocol`

### 2. Desktop Build Testing (CRITICAL)

**ALWAYS use the devops/desktop toolkit first** when working with Tauri builds, NSIS installers, or desktop packaging.

**Quick start:** `bun run devops desktop-loop run --version <x.y.z>`

The toolkit provides:
- 15-action CLI with hash-gated rebuild detection
- 5-gate orchestrator (Build → Install → Launch+Render → Capture → Report)
- Structured diagnostics and verification

**Never use raw build scripts directly** - let the toolkit orchestrate them.

### 3. Chrome Profile Layout (CANONICAL)

Chrome profiles live **only** under `chrome-profiles/<providerSlug>/<accountId>`:

```
chrome-profiles/
  gemini/owservera/
  chatgpt/owservera/
  claude/owservera/
```

**Never** create top-level provider directories at the repo root. The profile dir is the source of truth for authentication status.

### 4. Comment Preservation (CRITICAL)

**ALWAYS preserve all existing code comments.** Never remove, strip, or modify comments in any code file unless explicitly asked.

### 5. Code Conventions

- Use `@/*` path aliases (maps to `./src/*`)
- Prefer `type` imports: `import type { Foo } from './bar.js'`
- Use `.js` extension in imports (Bun ESM requirement)
- No `any` — use `unknown` + type narrowing
- Use Zod for runtime validation at boundaries

## Common Workflows

### Testing a Provider
```bash
# Full 8-phase onboarding pipeline
bun run devops runtime-test onboard --provider=<slug>

# Individual phases
bun run devops discover-protocol <url> --hint=<name>
bun run devops runtime-test onboard infer --provider=<slug>
bun run devops runtime-test onboard test-selectors --provider=<slug>
```

### Desktop Build and Test
```bash
# Full pipeline
bun run devops desktop-loop run --version <x.y.z>

# Individual actions
bun run devops desktop-loop status
bun run devops desktop-loop build --version <x.y.z>
bun run devops desktop-loop test smoke
```

### Protocol Data Management
```bash
# Switch to dev mode for testing
bun run devops protocol dev

# View diffs
bun run devops protocol diff

# Promote dev changes to DB
bun run devops protocol promote --provider=<slug>

# Regenerate prod protocol
bun run gen:protocol
```

## Debugging Gotchas

### PowerShell Object-Pipeline Read Bug
`Invoke-RestMethod | Select-Object -ExpandProperty <x> | Out-File` produces EMPTY files. ALWAYS read API/JSON data through a BUN SCRIPT, never through the PowerShell object pipeline.

### Bun.spawn exitCode
`proc.exitCode` returns `null` until `await proc.exited` resolves. Always await the promise before reading exit code.

### Smoke Test Timeouts
Endpoints like `/api/conversations/:id/send` block forever waiting for a CDP browser. Always wrap `fetch` calls with `AbortController` + timeout.

## Documentation

- **Architecture:** `docs/architecture/`
- **Runbooks:** `docs/runbooks/`  
- **Decisions:** `docs/decisions/`
- **Project Instructions:** `AGENTS.md`
- **Existing Skills:** `.opencode/skill/`

## When to Use This Skill

Use this skill when:
- Starting any work on the vivim-final codebase
- Working with the provider system
- Building or testing desktop packages
- Modifying protocol data or parsers
- Setting up Chrome profiles
- Any architectural or implementation questions about the project