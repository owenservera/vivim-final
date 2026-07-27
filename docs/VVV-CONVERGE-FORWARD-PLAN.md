# VVV Convergence — Forward Plan

**Goal:** Fix all type errors + infrastructure issues from vvv merge, achieve clean tsc + clean boot + all tests green.

## Root Cause Map

| # | Error | File | Lines | Why |
|---|-------|------|-------|-----|
| I1 | `bunx` not found | `lefthook.yml` + `package.json` | 6 scripts | Windows `bunx.ps1` wrapper points to nonexistent path |
| I2 | Prisma generate EPERM | — | — | Query engine DLL locked by lingering server process |
| S1 | `send_method: 'click'` invalid | `seeds/providers/manifests.ts` | 1 line | Zod expects `enter_key / button_click / both` |
| S2 | `sample_body` missing | `seeds/parsers/harvest.seed.ts` | 1 field | upsertParser arg omits required field |
| T1 | `jsonMatch[1]` possibly undefined | `src/engines/format-classifier.ts` | L123,147,151 | `noUncheckedIndexedAccess` (3 lines) |
| T2 | `codeBlockMatch[1].trim()` same | same file | L147 | same cause |
| T3 | `jsonMatch[1].trim()` same | `src/engines/selector-refiner.ts` | L86 | same cause |
| T4 | `'batchexecute'` not in StreamTransport | `src/engines/live-capture-engine.ts` | L62 | Two `StreamTransport` types; engine imports wrong one |
| R1 | `createChromeRouter(ctx)` — expects 0 args | `src/server/index.ts` | L181 | 9 routers have different sigs than vivim assumed |
| R2 | `createGenerativeRouter(ctx)` — expects GenerativeTaskStore | same | L182 | Needs InMemoryGenerativeTaskStore instance |
| R3 | 7 more routers called with ctx — expect 0 args | same | L183-189 | llm-harness, mutation, plugin-builder, surface, template, variant, version |
| R4 | `bootOnboardingPipeline(serviceContainer)` — expects (governor, db) | same | L192 | Wrong args |
| R5 | `chromeRouter(req)` — expects (req, url) | same | L266-306 | 9 routers take 2 args |
| R6 | fetch handler returns `Response | null` | same | L201 | Bun.serve types require `Response` |
| P1 | `sampleBody` missing on `PrismaParserRow` | `src/storage/impl/parser-store-impl.ts` | L52 | Prisma client needs regenerate after schema change |

## Phase 0: Infrastructure Fixes

**Before any code changes — fix the dev loop itself.**

### 0.1 Kill lingering server
```powershell
# Port 9421 might be locked from earlier run
Stop-Process -Id (Get-NetTCPConnection -LocalPort 9421).OwningProcess -Force
```

### 0.2 Fix lefthook.yml — replace `bunx` with `bun x`
**File:** `lefthook.yml`
**Changes:** 5 replacements
- `bunx @biomejs/biome lint` → `bun x @biomejs/biome lint`
- `bunx @biomejs/biome check` → `bun x @biomejs/biome check`
- `bun run typecheck` → stays (typecheck script itself needs fixing)
- `bun run devops invariants` → stays
- `bun run devops runtime-test guard` → stays

### 0.3 Fix package.json scripts — replace `bunx` with `bun x`
**File:** `package.json`
**Changes:** 4 scripts
- `typecheck`: `bunx tsc --noEmit` → `bun x tsc --noEmit`
- `prisma:migrate:dev`: `bunx prisma migrate dev` → `bun x prisma migrate dev`
- `prisma:migrate:prod`: `bunx prisma migrate deploy` → `bun x prisma migrate deploy`
- `prisma:generate`: `bunx prisma generate` → `bun x prisma generate`
- `prisma:studio`: `bunx prisma studio` → `bun x prisma studio`
- `prisma:push`: `bunx prisma db push` → `bun x prisma db push`

### 0.4 Regenerate Prisma client
```powershell
bun run prisma:generate
```

## Phase 1: Seed Fixes

### 1.1 Fix Gemini send_method
**File:** `seeds/providers/manifests.ts`
**Change:** `send_method: 'click'` → `send_method: 'button_click'`

### 1.2 Fix harvest.seed.ts missing sample_body
**File:** `seeds/parsers/harvest.seed.ts` (~L73)
**Change:** Add `sample_body: null` to the upsertParser call

## Phase 2: Engine Type Errors

### 2.1 Fix format-classifier.ts (3 errors)
**File:** `src/engines/format-classifier.ts`
**Lines:** 123, 147, 151
**Pattern:** `jsonMatch[1].trim()`, `codeBlockMatch[1].trim()`, `exportsMatch[1].trim()`
**Fix:** Add `!` assertion: `jsonMatch[1]!.trim()` (safe — we already check existence before accessing)

### 2.2 Fix selector-refiner.ts (1 error)
**File:** `src/engines/selector-refiner.ts`
**Line:** 86
**Pattern:** `jsonMatch[1].trim()`
**Fix:** Add `!` assertion

### 2.3 Fix live-capture-engine.ts — batchexecute stream transport
**File:** `src/engines/streaming-response-analyzer.ts`
**Line:** 8
**Change:** Add `'batchexecute'` to StreamTransport type union
```ts
export type StreamTransport = 'sse' | 'batchexecute' | 'websocket' | 'polling' | 'unknown'
```

## Phase 3: Server Router Wiring

### 3.1 Fix router creation — 9 routers
**File:** `src/server/index.ts`, lines 181-189

| Line | Current | Fix |
|------|---------|-----|
| 181 | `createChromeRouter(ctx)` | `createChromeRouter()` |
| 182 | `createGenerativeRouter(ctx)` | `createGenerativeRouter(generativeStore)` |
| 183 | `createLlmHarnessRouter(ctx)` | `createLlmHarnessRouter()` |
| 184 | `createMutationRouter(ctx)` | `createMutationRouter()` |
| 185 | `createPluginBuilderRouter(ctx)` | `createPluginBuilderRouter()` |
| 186 | `createSurfaceRouter(ctx)` | `createSurfaceRouter()` |
| 187 | `createTemplateRouter(ctx)` | `createTemplateRouter()` |
| 188 | `createVariantRouter(ctx)` | `createVariantRouter()` |
| 189 | `createVersionRouter(ctx)` | `createVersionRouter()` |

**Add before line 181:**
```ts
import { InMemoryGenerativeTaskStore } from '../engines/generative/generative-task-store.js'
const generativeStore = new InMemoryGenerativeTaskStore()
```

### 3.2 Fix bootOnboardingPipeline call
**File:** `src/server/index.ts`, line 192
**Change:** Replace with correct args — but we need a ChromeGovernor instance at this point.
**Fix:** Wrap in guard:
```ts
if (governor) {
  bootOnboardingPipeline(governor, db).catch(...)
}
```
Where `governor` is resolved from server context.

### 3.3 Fix router dispatch calls (9 calls)
**File:** `src/server/index.ts`, lines 266-306
**Pattern:** `chromeRouter(req)` → `chromeRouter(req, url)`
**Change:** All 9 router dispatch calls need second arg `url`

### 3.4 Fix fetch return type
**File:** `src/server/index.ts`, line 309
**Change:** Replace `return conversationRouter(req)` with:
```ts
const result = await conversationRouter(req, url)
return result ?? new Response('Not Found', { status: 404 })
```

## Phase 4: Verify

### 4.1 Full typecheck
```powershell
bun run typecheck
```
Expected: 0 errors (autonomous-execution.ts errors are pre-existing)

### 4.2 Core test suite
```powershell
bun test tests/unit/engines/nlcl/ tests/e2e/nlcl-golden.test.ts tests/unit/canvas/
```

### 4.3 Server boot test
```powershell
bun run dev:backend
```
Check for 0 provider seed errors, clean startup

## Summary

| Task | Type | Estimated commits |
|------|------|-----------------|
| 0.1 Kill server | ops | — |
| 0.2 Fix lefthook.yml | infra | 1 |
| 0.3 Fix package.json | infra | 1 |
| 0.4 Prisma generate | build | — |
| 1.1 Fix send_method | seed | 1 |
| 1.2 Fix sample_body | seed | 1 |
| 2.1-2.3 Fix 3 engine files | types | 1 |
| 3.1-3.4 Fix server wiring | merge | 1 |
| 4.1-4.3 Verify | test | — |

All changes are small and independent — can be batched into 2-3 commits
