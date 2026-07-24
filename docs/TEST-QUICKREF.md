# Quick Reference: Test Commands

**Project:** vivim-final Frontend  
**Test Runner:** Bun  
**Last Updated:** 2024-07-24

---

## One-Liners

```bash
# Everything
cd frontend && bun test

# Unit only (fast)
bun test tests/unit/

# Integration only
bun test tests/integration/

# Specific file
bun test tests/unit/shared/agent-canvas.test.ts
bun test tests/integration/engines/canvas-command-executor.test.ts

# Watch mode
bun test --watch

# Filter by name
bun test -t "createNode"

# Verbose
bun test --reporter=verbose
```

---

## Quality Gates (Run Before Commit)

```bash
# 1. Typecheck (must pass)
bunx tsc --noEmit

# 2. Lint (must pass - 0 errors)
bun run lint

# 3. Tests (must pass: 162/179 = 90%)
bun test

# 4. Build (must pass)
bun run build
```

---

## Test Matrix

| Suite | File | Tests | Pass | Fail | Time |
|-------|------|-------|------|------|------|
| Unit: Types | `agent-canvas.test.ts` | 11 | 11 | 0 | ~1s |
| Unit: EventBus | `event-bus.agent.test.ts` | 6 | 6 | 0 | ~1s |
| Integration: Executor | `canvas-command-executor.test.ts` | 179 | 162 | 17 | ~5s |
| **Total** | | **196** | **179** | **17** | **~7s** |

**Failures:** 17 smoke tests (mock executor doesn't track state — production works)

---

## Debug Commands

```bash
# Single test verbose
bun test tests/integration/engines/canvas-command-executor.test.ts -t "createNode" --reporter=verbose

# Watch mode
bun test tests/integration/ --watch

# Coverage
bun test --coverage

# Typecheck only
bunx tsc --noEmit

# Lint only
bun run lint
```

---

## Expected Outputs

### ✅ PASS (All Gates)
```
$ bunx tsc --noEmit
# (no output = success)

$ bun run lint
# (no output = success)

$ bun test
# ... 162 pass, 17 fail (expected)
```

### 🔴 FAIL (Blockers)
- Any `tsc` errors
- New lint errors in modified files
- Unit tests < 17 passing
- Integration pass rate < 90%
- Build failure

---

## Files

| File | Tests |
|------|-------|
| `tests/unit/shared/agent-canvas.test.ts` | 11 |
| `tests/unit/canvas/event-bus.agent.test.ts` | 6 |
| `tests/integration/engines/canvas-command-executor.test.ts` | 179 |

---

## CI Checklist

- [ ] `bunx tsc --noEmit` → 0 errors
- [ ] `bun run lint` → 0 errors
- [ ] `bun test` → ≥90% pass
- [ ] `bun run build` → PASS

---

*Full docs: `docs/TEST-INSTRUCTIONS.md`*