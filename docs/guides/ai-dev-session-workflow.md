# AI Dev Session Workflow Guide

> **Scope:** How future AI agents should structure a vivim development session for maximum
> correctness and zero regressions.  
> **Source:** Lessons from the 10x Provider Upgrade session (2026-08-01).

---

## Session Structure: Always Assess Before Implement

The single most important rule for any vivim AI dev session:

```
1. READ the spec / session file fully first
2. AUDIT the current code state (don't assume the spec is already implemented)
3. DIFF spec vs current to find the actual delta
4. IMPLEMENT only the delta — don't re-implement what already exists
5. VERIFY each change before moving to the next
```

Skipping step 2 causes one of two failure modes:
- **Over-implementation:** Rewriting already-correct code, introducing regressions
- **Under-implementation:** Missing subtle gaps because you assumed code matched spec

---

## Phase 1: Orientation (always run this first)

Before writing a single line of code, orient yourself:

```bash
# 1. Check system health
bun run devops runtime-test health

# 2. Check provider status
bun run devops runtime-test preflight

# 3. Check what's already seeded
bun run devops runtime-test status --provider=<slug>
```

Then read these files in order:

| File | What to learn |
|------|---------------|
| `docs/merged-design-v2/` | Canonical architecture specs (read 00–08) |
| `docs/roadmap/INVARIANTS.md` | Hard boundaries you must not cross |
| `AGENTS.md` | Project-specific rules for this repo |
| `seeds/providers/<slug>.json` | Current provider manifest |
| `seeds/parsers/harvested/<slug>-*.ts` | Current parser logic |
| `src/__generated__/provider-protocol.ts` | Compiled view of DB state |

---

## Phase 2: Audit Pattern

For each file you plan to change, compare **spec intent** vs **current implementation**:

```
1. Read the spec section
2. Read the current file
3. List specific gaps as concrete items:
   "Line 34: fromParts returns blocks[0] instead of blocks — bug"
   "No grounding extraction — feature missing"
   "streamConfigs: [] — empty, should have batchexecute entry"
4. Prioritize gaps:
   - Critical bugs (correctness): fix first
   - Missing features: fix second
   - Config gaps (stream configs): fix third
   - New capabilities: add last
```

Never start implementing during the audit phase. Complete the full audit across ALL affected
files before writing any code. This prevents the common trap of fixing A while breaking B.

---

## Phase 3: Implementation Order

When changes span multiple files, use this dependency order:

```
1. Data layer first  → seeds/parsers/harvested/*.ts
2. Seed functions    → seeds/parsers/harvest.seed.ts
3. Boot wiring       → src/server/index.ts
4. Engine code       → src/engines/*.ts
5. Registry entries  → src/engines/provider-caps.ts
6. NL catalog        → src/engines/nlcl/catalog.ts
7. Protocol regen    → bun run gen:protocol  (last, only if needed)
```

**Why this order:** Later layers depend on earlier ones. Changing the registry before the seed
works fine at runtime but creates inconsistent DB/code state.

---

## Phase 4: Change Hygiene

### One concern per edit

Bad:
```
"Fix parser bug AND add new capability AND update seed"
→ three concerns, hard to roll back, easy to miss one
```

Good:
```
Edit 1: Fix fromParts bug in chatgpt-openai-delta.ts
Edit 2: Add Code Interpreter capture in extractOpenAIBlock
Edit 3: Add STREAM_CONFIGS to harvest.seed.ts
Edit 4: Wire seedStreamConfigs in server/index.ts
```

### Version bumps

Any substantive change to a parser's `parse()`, `detectCompletion()`, or `getConfidence()`
function **must** bump the `version` field inside `module.exports.default`:

```ts
// Before
module.exports.default = { name: 'claude/001_streaming_sse', version: 1, ... }

// After any logic change
module.exports.default = { name: 'claude/001_streaming_sse', version: 2, ... }
```

### Import ordering

All vivim TypeScript files use `.js` extensions in imports (ESM requirement):
```ts
import { makeCapability } from './capability-bootstrap.js'  ✅
import { makeCapability } from './capability-bootstrap'     ❌
```

---

## Phase 5: Verification Commands

After implementation, verify in this order:

```bash
# 1. Quick smoke test — does the server start?
bun run dev

# 2. Provider preflight
bun run devops runtime-test preflight

# 3. Per-provider deep test
bun run devops runtime-test onboard test-parse --provider=claude
bun run devops runtime-test onboard test-parse --provider=chatgpt
bun run devops runtime-test onboard test-parse --provider=gemini

# 4. Cross-surface parity
bun run devops verify-cross-surface

# 5. NL resolution test
bun run devops runtime-test test --nl="enable claude extended thinking"
bun run devops runtime-test test --nl="gemini grounding on"

# 6. Invariant check
bun run devops invariants check
```

---

## Common Traps in vivim Sessions

### Trap 1: Assuming spec == implementation

The spec files (`session-ses_*.md`, design docs) describe **intent**, not current state.
Always read the actual source files. The provider upgrade session found:
- `fromParts` bug that existed for months undetected
- Three providers with `streamConfigs: []` despite stream configs being critical for parser routing
- Missing `signature_delta` handling in Claude parser

### Trap 2: Editing `provider-protocol.ts` directly

`src/__generated__/provider-protocol.ts` is **auto-generated**. Never edit it directly.
Changes go into:
- DB via seeds → then `bun run gen:protocol` regenerates the file
- Dev overrides → `bun run devops protocol dev` + edit `provider-protocol.dev.ts`

### Trap 3: Writing parser logic outside the DB

Parser logic must live in `seeds/parsers/harvested/*.ts` as `LOGIC_CODE` strings.
The engine executes these strings via `SandboxRunner`. Any logic written directly
into `stream-parser.ts` will be lost on the next seed run.

### Trap 4: Missing `execute` stub in catalog patterns

Every `pattern()` call in `catalog.ts` **requires** an `execute` field. If omitted,
the pattern registers but crashes at resolution time. Always include:
```ts
execute: async () => ({}),
```

### Trap 5: Wrong capability ID format

```ts
// Wrong — single-segment actions
id: 'cap:gemini_send'           // missing second colon
id: 'cap:undefined:myAction'   // category is 'undefined'

// Correct
id: 'cap:gemini:send'
id: 'cap:claude:extended_thinking'
```

### Trap 6: Using `tsc` mid-session

The project has pre-existing type errors in `tests/` owned by other agents.
Running `bun run typecheck` / `bunx tsc --noEmit` mid-session causes noise and
blocks progress. Only run typecheck when:
1. The full task is complete
2. The user explicitly requests it

### Trap 7: Creating Chrome profile directories at repo root

Chrome profiles live **only** under `chrome-profiles/<providerSlug>/<accountId>/`.
Never create `gemini/`, `chatgpt/` etc. at the repo root — these are stray duplicates.

---

## Session Handoff Protocol

When ending a session before all work is complete, write a brief handoff note to the session
file or to `.agents/HANDOFF.md`:

```markdown
## Handoff — <date>

### Done
- [x] Fixed ChatGPT fromParts bug
- [x] Enhanced Claude parser with signature_delta + artifact extraction

### In Progress
- [/] Adding provider capabilities (provider-caps.ts created, not yet wired)

### Next Steps
1. Wire registerProviderCapabilities in server/index.ts
2. Add NL patterns for 6 new caps in catalog.ts
3. Run bun run gen:protocol

### Context
- Harvest seed: STREAM_CONFIGS added, seedStreamConfigs exported but not called in server
- Parser versions bumped: claude → v2, gemini → v2
```

This prevents the next agent from re-auditing everything from scratch.

---

## Quick Reference: Vivim File Ownership

| What you're changing | Primary file | Secondary files |
|---------------------|-------------|-----------------|
| Stream parsing logic | `seeds/parsers/harvested/<p>.ts` | `harvest.seed.ts` (bump version in DEFS) |
| Stream transport config | `harvest.seed.ts` → `STREAM_CONFIGS` | `server/index.ts` (boot call) |
| New capability | `provider-caps.ts` (provider) or `capability-bootstrap.ts` (system) | `server/index.ts`, `nlcl/catalog.ts` |
| NL phrase → capability | `nlcl/catalog.ts` | — |
| CDP automation | `src/engines/harness/` | Never touch `BunCdpClient` directly |
| Provider selectors | `seeds/providers/<slug>.json` | `src/engines/provider-selectors.ts` |
| DB schema | `prisma/schema.prisma` | Run `bunx prisma migrate dev` |
| Protocol static file | Never edit directly | Run `bun run gen:protocol` |
