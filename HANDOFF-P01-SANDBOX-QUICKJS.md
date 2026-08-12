# Session Handoff — Project 01: Sandbox Isolation via QuickJS WASM

**Generated:** session check-in (compaction guard). **State:** P01 in_progress; nothing implemented yet — research + spike validation complete. P03 (codebase hygiene) is DONE.

> Read order for a fresh agent: `docs/upgrades/projects/01-sandbox-quickjs/00_PROJECT.md` → `01_AGENT_BRIEF.md` → `PLAN.md` → `PLAN.execution.md`, then `docs/upgrades/02-sandbox-isolated-vm.rigorous.md` (lessons), then the contract files cited below.

---

## 1. Objective (current task)

Implement **Project 01 (sandbox-quickjs)**: replace `node:vm` with **QuickJS WASM** as the sandbox backend in `src/engines/sandbox-runner.ts`, keeping the public API **byte-for-byte identical** so zero callers change. Then proceed to P02 → P04 → P05; keep P06 DEFERRED. Do NOT run `tsc` mid-task; do NOT commit unless asked.

---

## 2. Current position (resume here)

- Task: P01 todo **in_progress**. P03 todo **completed**.
- **No P01 code has been written yet.** All work = doc reading + contract verification + package discovery + spike.
- Blockers/notes to carry:
  1. `.runtime/qjs-spike.ts` **Test 3 aborts** the Bun process on `runtime.dispose()` with `Aborted(Assertion failed: list_empty(&rt->gc_obj_list), at: ../../vendor/quickjs/quickjs.c,2036,JS_FreeRuntime)` — caused by **leaked QJS handles** (un-unwrapped `evalCode(...)` results + un-disposed prop handles). Must dispose every handle (`using`/Scope) before `ctx.dispose()`/`runtime.dispose()`.
  2. Package decision ALREADY MADE: use the already-installed **`quickjs-emscripten` ^0.32.0** (full high-level API incl. `getQuickJS()`, `shouldInterruptAfterDeadline`), NOT `@jitl/quickjs-wasmfile` (umbrella not installed). No `bun add` needed.

---

## 3. Verified facts (do not re-research)

### Dependency
- `quickjs-emscripten` ^0.32.0 + `quickjs-emscripten-core` **already in package.json and node_modules, zero src/ references**.
- Transitive installed: `@jitl/quickjs-wasmfile-release-sync@0.32.0` (+ debug variants) → these export only `default`; `quickjs-emscripten` re-exports `RELEASE_SYNC` + `getQuickJS()`/`getQuickJSSync()`.

### QuickJS high-level API (from `node_modules/quickjs-emscripten-core/dist/index.d.ts`)
- `getQuickJS()` async → module (release-sync WASM). Cache the promise.
- `m.newRuntime()` → `runtime.setMemoryLimit(bytes)`, `runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadlineMs))`, `runtime.executePendingJobs()`.
- `runtime.newContext()` → `ctx.evalCode(code, filename?, options?)` → `QuickJSContextResult<QuickJSHandle>` — **call `.unwrap()`**. Interrupt error name `InternalError`, message `interrupted`.
- `ctx.unwrapResult(res)`; `ctx.dump(handle)` (Promise → dumps JSPromiseState like `{type:'fulfilled',value:5}`); `ctx.getProp(handle,key)` → handle; `ctx.setProp(handle,key,val)`; `ctx.callFunction(func,thisVal,...args)` → result requires `.unwrap()`.
- `ctx.newString`, `newNumber`, `newObject`, `newArray`, `newFunction(name, impl)`; `ctx.typeof(handle)`; `ctx.getNumber/getString`; `ctx.getOwnPropertyNames(handle,{strings:true})` → `.unwrap()` iterable of disposable handles (`for (using prop of ...)`).
- `ctx.undefined` getter; `ctx.global` getter; `ctx.resolvePromise(promiseHandle)` → `Promise<QuickJSContextResult<>>` (await async results, probably after executePendingJobs); `ctx.newPromise()` → `QuickJSDeferredPromise`; `ctx.getPromiseState(handle)`.
- EVERY handle must be disposed (`.dispose()` / `using`). Scope: `Scope.withScope/withScopeAsync`.

### Spike results
- Test 1 (CPU budget `while(true){}` + deadline) → threw `"interrupted"` in ~45ms. **WORKS.**
- Test 2 (async IIFE `(async()=>{return input.a+input.b})()` + dump) → `{"type":"fulfilled","value":5}`. **WORKS** (input injected via `ctx.evalCode('input = '+JSON.stringify(...))`).
- Test 3 (LOGIC_CODE `module.exports.default` readback + host `callFunction` of QJS fn) → **ABORTS on dispose (handle leak)**. Round-trip mechanics UNPROVEN.

---

## 4. Hard contracts to reproduce (verified from source)

### Public API — `src/engines/sandbox-runner.ts`
```ts
interface SandboxPermissions { canFetch: string[]; canReadFile: string[]; canWriteFile: string[]; canUseClipboard: boolean }
interface SandboxBudget { cpuMs: number; memoryBytes: number }
interface SandboxRunOptions { budget?: Partial<SandboxBudget>; handlerSlug?: string; memoryProbe?: () => { heapUsed: number }; globals?: Record<string, unknown> }
interface SandboxResult { ok: boolean; output?: unknown; error?: string; auditId: string }
class SandboxRunner { constructor(auditStore, options?: { defaultBudget?; memoryProbe? }); async run(code, input, permissions, options?) }
```
- Default budget `{ cpuMs: 1000, memoryBytes: 64*1024*1024 }`; handlerSlug = `options.handlerSlug ?? input.handlerSlug ?? 'inline'`; auditId = `newId()`.
- Wraps code exactly as `(async () => { ${code} })()`.
- VM impl frees: null-proto frozen sandbox, silent `console`, `navigator.clipboard` ONLY when `canUseClipboard`, globals looped verbatim, `vm.createContext(Object.freeze(Object.create(null)))`, memory poll `setInterval(isOverBudget, 5)`, timeout → `SandboxTimeoutError(handlerSlug, cpuMs)`.
- **Never injects `fetch`** (existing test asserts `typeof fetch === 'undefined'` even with `canFetch:['*']`). Clipboard guard throws `SandboxPermissionError`.

### Audit (UNCHANGED contract) — `src/storage/contracts/sandbox-audit-store.ts`
```ts
SandboxAuditRow = { id: string; handlerSlug: string; ok: boolean; error: string | null; permissions: SandboxPermissions; ts: number }
SandboxAuditStore = { create(row)); list(limit?) }
```
- **Do NOT invent `inputJson`/`outputJson`/`ranAt`** (rigorous-plan trap).
- This file imports `SandboxPermissions` from `sandbox-runner.js` → **the selector must re-export types**.

### Caller #1 — `src/engines/stream-parser.ts` `loadInlineParser` (~line 506)
```ts
const mod = { exports: {} as Record<string, unknown> }
if (!this.sandbox) this.sandbox = new SandboxRunner({ create: async () => {}, list: async () => [] })
const res = await this.sandbox.run(code, {}, { canFetch: [], canReadFile: [], canWriteFile: [], canUseClipboard: false }, {
  handlerSlug: `parser:${hash}`, globals: { module: mod, exports: mod.exports },
})
const candidate = (mod.exports.default ?? mod.exports) as Partial<ParserModule>
if (typeof candidate.parse !== 'function') throw new EngineError('Inline parser has no parse() method')
```
- `ParserModule = { name; version; providerId; parse(rawBody): ContentBlock[]; detectCompletion; getConfidence }` — functions called LATER by the engine on every parse → **returned module's functions must be host-callable AFTER run() → QJS context must be kept alive** (registry keyed by handlerSlug, bounded by inlineCache/parserCache).
- Primed fast-path (`primeFromProtocol`/`resolvePrimed`) bypasses sandbox — sandbox only for un-primed DB inline parsers + repair.

### Caller #2 — `src/server/plugin-builder-router.ts`
- Does NOT import SandboxRunner (calls `pluginBuilder.build()`). Zero change. (verify no other sandbox imports via grep `from '.*sandbox-runner'`.)

### Errors — `src/errors.ts`
- `SandboxTimeoutError(handlerSlug, budgetMs)`: msg `Handler ${slug} exceeded ${budgetMs}ms budget` (matches test regex `/budget|exceeded|timeout/i`).
- `SandboxBudgetError(handlerSlug, 'cpu'|'memory', used, budget)`: msg `${slug} ${kind} ${used} > ${budget}` (matches `/memory/i`).
- `SandboxPermissionError(handlerSlug, denied)`.

### Existing tests to keep green — `tests/unit/engines/sandbox-runner.test.ts`
1. `run('return (input.a + input.b);', {a:2,b:3}, ALLOW_ALL)` → ok:true, `output === 5`, 1 audit row ok:true.
2. Escape: `process/require/fetch/globalThis.process` all `'undefined'`; escape expr `globalThis.constructor.constructor('return process')()` → `'blocked'`.
3. `while(true){}` cpuMs:50 → ok:false, error matches `/budget|exceeded|timeout/i`.
4. Memory: injected `memoryProbe: () => ({ heapUsed: 999_999_999_999 })` + `budget:{memoryBytes:1}` → ok:false, error matches `/memory/i`. **QuickJS impl must still honor the injected `memoryProbe` option** (post-run check) for this test.
5. `throw new Error('boom')` → ok:false, error matches /boom/.
6. `return typeof navigator` (canUseClipboard:false) → output `'undefined'`.

---

## 5. Implementation design (approved direction)

1. **Fix spike Test 3** (free all handles / use `using` + Scope), confirm readback + host-call, then delete spike after impl.
2. **NEW `src/engines/sandbox-runner-quickjs.ts`** — identical public types + class:
   - Fresh `runtime`+`context` per `run()`; `setMemoryLimit(budget.memoryBytes)`; `setInterruptHandler(shouldInterruptAfterDeadline(Date.now()+budget.cpuMs))`.
   - Inject `input` + globals as **JSON copies**; create `module={exports:{}}`, `exports=module.exports` inside context; silent `console`; clipboard only when `canUseClipboard`; NO fetch.
   - Run `(async () => { ${code} })()` → unwrap → executePendingJobs → `await ctx.resolvePromise` → dump → `output`.
   - Post-run: honor injected `memoryProbe` (parity + test 4); read QJS `module.exports` back into host `mod.exports` (transcribe function props as host closures bound to the kept-alive context; dispose old context for same handlerSlug on re-run).
   - Map interrupts → `SandboxTimeoutError`; `setMemoryLimit` throw → `SandboxBudgetError(...,'memory',...)`; audit exact shape.
3. **`sandbox-runner.ts` → selector:** `const mode = process.env['VIVIM_SANDBOX_MODE'] ?? 'quickjs'`; `export { SandboxRunner } from './sandbox-runner-${mode}.js'`; keep the vm impl in-tree as `sandbox-runner-vm.ts` (rollback = `VIVIM_SANDBOX_MODE=vm`, zero code revert); re-export all interfaces so the audit-store contract import keeps working.
4. **NEW `tests/unit/sandbox-runner-escape.test.ts`** (per PLAN §7 acceptance: escape→undefined; timeout; memory host-survives; ref-leak `input.secret` unchanged; LOGIC_CODE exports.default; audit shape exact).
5. Update `PLAN.execution.md` status; delete `.runtime/qjs-spike.ts`.

## 6. Acceptance (PLAN.execution §7)
- Constructor escape → `undefined`/throws, never `'object'`; `while(true){}` cpuMs:50 → SandboxTimeoutError; memory alloc past cap → run fails, host survives; `input.secret` mutation stays in-isolate; `exports.default` returned (parser pipeline works); audit row exactly `{id,handlerSlug,ok,error,permissions,ts}`; callers run unmodified; `bun test tests/unit/engines/sandbox-runner.test.ts` + `bun run lint` clean; rollback via `VIVIM_SANDBOX_MODE=vm`.

## 7. Key files
- `src/engines/sandbox-runner.ts` (modify→selector), NEW `src/engines/sandbox-runner-quickjs.ts`, keep vm impl, `.runtime/qjs-spike.ts` (fix+delete), `tests/unit/engines/sandbox-runner.test.ts` (keep green) + NEW `tests/unit/sandbox-runner-escape.test.ts`, `docs/upgrades/projects/01-sandbox-quickjs/PLAN.execution.md` (update status).
- Reference API: `node_modules/quickjs-emscripten-core/dist/index.d.ts` (QuickJSContext ~1032; evalCode 1540; callFunction 1495; unwrapResult 1573; getOwnPropertyNames 1436; resolvePromise 1368; dump 1566; typeof 1321; newFunction 1271; Scope 752).
- P03 done: `HANDOFF-03-CODEBASE-HYGIENE.md` (§2 Phase 4 COMPLETE; 16 bare safeParse sites fixed to `parseRequestBody`; note `routes/sync.ts`(3) + `routes/update.ts`(2) deferred to P05).

## 8. Environment
- Windows PowerShell 7+; `workdir` param instead of `cd`; read API data through bun scripts (never PowerShell object pipeline). No emojis in files. Conventional commits.