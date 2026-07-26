---
name: frontend-ux-refinement
description: >-
  Iterative frontend refinement orchestrator for vivim-final. Hybrid code-first + browser-visual
  approach: drive backend APIs/CLI/fetch for fast iteration cycles, use browser automation for
  visual proof only when needed. Covers the full user journey (discovery through delivery),
  wires frontend to backend via capability slots, and verifies every user moment across all
  surfaces. Use when refining frontend UI/UX, wiring a new capability to the UI, verifying
  cross-surface parity, testing user moments end-to-end, or debugging frontend-backend disconnects.
---

# Frontend UX Refinement

Iterative frontend refinement via hybrid testing: **code-first** (API, CLI, fetch, DB queries)
for fast cycles, **browser-visual** (Playwright MCP, screenshots) for final proof. Every user
moment gets tested across CLI/API/MCP/UI before shipping.

## Core Invariant

**FRONTEND = BACKEND** — the capability `slug` is the single link. The frontend MUST NOT contain
feature-specific conditional rendering (`if (slug === 'x')`). It renders whatever the backend
contract + the slot registry resolve. New UI = new slot override or generic default, never a branch.

---

## 1. The Orchestration Loop

Every refinement cycle follows this loop. Each phase is an agent action, not automation.

```
DISCOVER → MAP MOMENTS → BUILD → CODE-TEST → VISUAL-TEST → PARITY → GATE → ITERATE
```

### Phase 0: Acquire the Goal

If the user has not stated a concrete goal, interview first. Never build without a goal.
Map the goal to a `cap:<category>:<action>` id + `slug`.

### Phase 1: Discover What Exists

```bash
# Full preflight — accounts, profiles, live Chrome, gaps
bun run devops agentic preflight

# Provider deep-dive
bun run devops runtime-test status --provider=<slug>

# Probe UI state
bun run devops agentic probe

# Discover capabilities + frontend URL + schema tables
bun run devops runtime-test discover
```

Understand what exists before changing it. The capability catalog and slot registry are your map.

### Phase 2: Map User Moments

Before writing code, enumerate every user moment the feature touches. See `MOMENTS.md` for the
full catalog framework. A moment is a single user action + its expected outcome across surfaces:

- **Entry**: How does the user reach this? (NL command, button click, API call)
- **Action**: What does the user do? (type, click, send, attach)
- **Feedback**: What does the user see? (streaming text, spinner, error toast, result card)
- **Completion**: How does the user know it's done? (status badge, message delivered, result rendered)
- **Error**: What goes wrong and how is it surfaced? (network timeout, parse failure, auth expiry)

### Phase 3: Build (Code-First)

Complete ALL code edits before running verification. Do NOT run typecheck incrementally.

**Backend path:**
1. Engine in `src/engines/` (one file per engine)
2. Store Contract in `src/storage/contracts/` (never the impl)
3. Register via `makeCapability(...)` with `surfaces: ALL_SURFACES`
4. API route if not covered by `/api/nlcl/interpret` or `/api/capabilities/:id/execute`

**Frontend path (use `vivi-frontend` skill patterns):**
1. Add slot taxonomy entry in `frontend/src/ui/slots.ts`
2. Provide generic default in `frontend/src/ui/defaults/`
3. Register defaults in `frontend/src/ui/defaults/index.ts`
4. Confirm capability contract includes `ui_slots` in DB

**Database path:**
1. Edit `prisma/schema.prisma`
2. `bunx prisma migrate dev --name <x>`
3. Update Store Contract
4. Update seeds if needed

### Phase 4: Code-Test (Fast — No Browser)

This is the primary testing layer. Fast, deterministic, agent-runnable.

#### 4a. Type + Lint Gate

```bash
bun run typecheck          # backend
cd frontend && bun run typecheck  # frontend
cd frontend && bun run build      # vite build
```

#### 4b. Unit Tests

```bash
bun test tests/unit/engines/<engine>.test.ts
bun test tests/unit/ui/      # UI component tests
```

#### 4c. API-Level Verification (Code-First)

Use fetch/CLI to hit the backend directly. No browser needed.

```bash
# Health check
bun run devops runtime-test health

# NL resolution test
bun run devops runtime-test test --nl="<restated goal>"

# Capability execution by slug
bun run devops runtime-test test-cap --slug=<capability_slug> --input='{"key":"value"}'

# Capability contract inspection
curl http://localhost:9420/api/capabilities?surface=ui | jq '.capabilities[] | select(.slug=="<slug>")'
```

#### 4d. Slot Resolution Verification (Code-First)

Verify the slot registry resolves correctly without opening a browser:

```typescript
// Write a .ts file in .runtime/ and run it
// .runtime/verify-slot-resolution.ts
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const res = await fetch(`http://localhost:${port}/api/capabilities?surface=ui`)
const caps = await res.json()
const target = caps.capabilities?.find((c: any) => c.slug === '<slug>')
console.log('Capability:', JSON.stringify(target, null, 2))
console.log('ui_slots:', target?.ui_slots)
console.log('ui_position:', target?.ui_position)
```

```bash
bun run .runtime/verify-slot-resolution.ts
```

#### 4e. Database Verification (Code-First)

```bash
# Check schema state
bunx prisma migrate status

# Inspect seeded data
bunx prisma studio

# Verify provider rows
bun run devops runtime-test status --provider=<slug>
```

### Phase 5: Visual-Test (Browser — When Needed)

Only after code-tests pass. Use browser automation for visual proof, not as primary testing.

**Tool hierarchy** (prefer first):
1. **API/CLI/fetch** — fast, deterministic, agent-runnable (Phase 4)
2. **Playwright MCP** — browser screenshots, DOM assertions, visual regression
3. **CDP engage/verify** — native project CDP tools for provider-specific testing

```bash
# Launch stack (non-blocking)
pwsh scripts/start-bg.ps1

# Health check
bun run devops runtime-test health

# Attach browser and navigate
bun run devops runtime-test engage --provider=<slug>

# Take verification screenshot
bun run devops runtime-test verify

# Capture console/errors
bun run devops runtime-test debug
```

**Playwright MCP** (for visual proof):
```
- playwright_browser_take_screenshot  — capture current state
- playwright_browser_snapshot         — accessibility tree for assertions
- playwright_browser_find             — locate elements by text/role
- playwright_browser_evaluate         — run JS assertions in page context
- playwright_browser_console_messages — check for errors/warnings
```

**When to use browser testing:**
- Final visual proof before shipping
- DOM structure verification (element exists, text correct)
- Streaming/animation behavior (progressive rendering)
- Responsive layout checks
- Accessibility tree validation

**When NOT to use browser testing:**
- API contract verification (use fetch/CLI)
- Slot resolution correctness (use code inspection)
- Type safety (use typecheck)
- Database state (use prisma studio/queries)

### Phase 6: Cross-Surface Parity

Every capability must resolve across CLI/API/MCP/UI. This is non-negotiable.

```bash
# Full parity check
bun run devops verify-cross-surface

# LLM-as-Human parity assertion
POST /api/capabilities/cap:llm_test:parity/execute  {}
```

### Phase 7: Gate

```bash
bun run typecheck                    # 0 errors
bun run lint                         # 0 errors
bun test                             # all pass
bun run devops audit-code standard   # no P0/P1 findings
```

### Phase 8: Record + Iterate

```bash
# Record UI test result
bun run devops ui-test record --provider=<slug> --cap=<name> --result=pass

# If issues found, return to Phase 3 with the specific fix
```

---

## 2. Hybrid Testing Strategy

### Why Hybrid?

| Layer | Speed | Coverage | Browser Needed? |
|-------|-------|----------|-----------------|
| Typecheck | ~2s | Type safety | No |
| Unit test | ~5s | Logic correctness | No |
| API fetch | ~3s | Backend contract | No |
| Slot inspection | ~2s | Resolution correctness | No |
| DB query | ~2s | Data integrity | No |
| Build | ~10s | Bundle correctness | No |
| Browser screenshot | ~5s | Visual correctness | Yes |
| DOM assertion | ~3s | Element presence | Yes |
| E2E flow | ~15s | Full user journey | Yes |

**Agent decision rule:** Start with code-first tests. Only escalate to browser when you need
visual proof (screenshot) or DOM structure verification (element exists with correct text).

### Code-First Testing Patterns

**Pattern 1: API contract test**
```bash
# Verify capability exists and resolves
bun run devops runtime-test test-cap --slug=conversation_send --input='{"message":"hello"}'
```

**Pattern 2: Slot resolution test**
```bash
# Write a bun script to verify slot registry
cat > .runtime/check-slots.ts << 'EOF'
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const r = await fetch(`http://localhost:${port}/api/capabilities?surface=ui`)
const j = await r.json()
for (const c of j.capabilities ?? []) {
  if (c.ui_slots) console.log(c.slug, '->', Object.keys(c.ui_slots))
}
EOF
bun run .runtime/check-slots.ts
```

**Pattern 3: Cross-surface parity test**
```bash
bun run devops verify-cross-surface 2>&1 | Select-String -Pattern "FAIL|parityGaps"
```

### Browser Testing Patterns

**Pattern 1: Screenshot proof**
```
1. playwright_browser_navigate to http://localhost:5173
2. playwright_browser_wait_for text to appear
3. playwright_browser_take_screenshot
4. zai-mcp-server_analyze_image for visual assertion
```

**Pattern 2: DOM assertion**
```
1. playwright_browser_snapshot (accessibility tree)
2. playwright_browser_find "element with expected text"
3. Assert element exists and has correct content
```

**Pattern 3: Console error check**
```
1. playwright_browser_console_messages level=error
2. Assert no errors or only expected warnings
```

---

## 3. User Moment Framework

A "user moment" is any interaction point in the frontend. Every moment must be:
1. **Defined** — what the user does and expects
2. **Wired** — backend capability + frontend slot resolution
3. **Tested** — at least code-level verification
4. **Verified** — visual proof for critical moments
5. **Recorded** — UI test registry entry

See `MOMENTS.md` for the complete catalog.

### Moment Categories

| Category | Examples | Testing Level |
|----------|----------|---------------|
| Entry points | NL command, button click, URL navigation | Code + Visual |
| Data flow | Send message, receive stream, load history | Code |
| State transitions | Login, logout, provider switch, model select | Code + Visual |
| Error handling | Network timeout, parse failure, auth expiry | Code |
| Visual feedback | Streaming text, progress bar, spinner, toast | Visual |
| Completion | Result card, status badge, message delivered | Code + Visual |

---

## 4. Verification Checklist

See `VERIFY-CHECKLIST.md` for the complete gate-by-gate checklist.

### Pre-Commit Gate
- [ ] `bun run typecheck` (backend) — 0 errors
- [ ] `cd frontend && bun run typecheck` — 0 errors
- [ ] `cd frontend && bun run build` — 0 errors
- [ ] `bun test` — all pass
- [ ] `bun run lint` — 0 errors

### Capability Gate
- [ ] `POST /api/capabilities/:id/execute` returns valid response
- [ ] Capability appears in `GET /api/capabilities?surface=ui`
- [ ] Slot resolution: `UIComponentRegistry.resolve()` returns correct component
- [ ] Cross-surface: `bun run devops verify-cross-surface` — 0 gaps

### Visual Gate (for critical moments)
- [ ] Screenshot shows expected layout
- [ ] DOM snapshot contains expected elements
- [ ] Console has no errors
- [ ] Streaming renders progressively (if applicable)

### Record Gate
- [ ] `bun run devops ui-test record --provider=<slug> --cap=<name> --result=pass`
- [ ] UI test registry updated with timestamp

---

## 5. Slot Architecture Quick Reference

### Slot Taxonomy (all namespaced with `chat.`)

| Slot | Role | Overridable by |
|------|------|----------------|
| `chat.entry` | Main chat box / host region | capability |
| `chat.sidebar` | Conversation list + new-chat | provider |
| `chat.thread` | Message scroll region | capability |
| `chat.bubble` | Single message | capability / provider |
| `chat.composer` | Input + send region | provider |
| `chat.send` | Send-message button | capability |
| `chat.attach` | Attach-file button | capability |
| `chat.streaming` | Progressive/streaming indicator | capability |
| `chat.result` | Rich result renderer (blocks) | capability |
| `chat.confirm` | Confirmation dialog | capability |
| `chat.error` | Error/toast surface | capability |
| `chat.header` | Provider switcher + account status | provider |
| `chat.actionBar` | Capability action buttons | capability |

### Resolution Precedence

```
resolve(slot, ctx) ->
  bespoke[slot][ctx.capabilitySlug]   // most specific
  ?? bespoke[slot][ctx.providerSlug]  // provider override
  ?? defaults[slot]                   // shared generic
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/ui/registry.ts` | UIComponentRegistry (external store) |
| `frontend/src/ui/context.tsx` | SlotProvider / useSlot hooks |
| `frontend/src/ui/slots.ts` | SLOT_IDS / SlotMeta catalog |
| `frontend/src/ui/defaults/` | Generic default components |
| `frontend/src/actions/registry.ts` | ActionRegistry (Zod-validated dispatch) |
| `frontend/src/features/chat/ChatPage.tsx` | Reference slot-resolved surface |
| `frontend/src/features/canvas/CanvasSurface.tsx` | Primary canvas surface |

---

## 6. Tool Reference

### Fast-Path Commands (code-first)

| Command | Purpose |
|---------|---------|
| `bun run devops runtime-test health` | DB + server preflight |
| `bun run devops runtime-test discover` | Capabilities + frontend URL + schema |
| `bun run devops runtime-test test --nl="..."` | NL resolution test |
| `bun run devops runtime-test test-cap --slug=...` | Capability execution by slug |
| `bun run devops agentic preflight` | Full preflight context |
| `bun run devops agentic probe` | Compact UI state snapshot |
| `bun run devops verify-cross-surface` | Cross-surface parity check |
| `bun run devops ui-test status --provider=...` | UI test history |
| `bun run devops ui-test record --provider=... --cap=... --result=pass` | Record UI test |
| `bun run typecheck` | Backend typecheck |
| `cd frontend && bun run typecheck` | Frontend typecheck |
| `cd frontend && bun run build` | Vite build |

### Browser-Path Commands (visual proof)

| Command | Purpose |
|---------|---------|
| `pwsh scripts/start-bg.ps1` | Launch stack (non-blocking) |
| `pwsh scripts/stop-all.ps1` | Tear down all services |
| `bun run devops runtime-test engage --provider=...` | Attach browser |
| `bun run devops runtime-test verify` | Screenshot verification |
| `bun run devops runtime-test debug` | Capture console/errors |
| `bun run devops runtime-test onboard test-frontend --provider=...` | E2E frontend test |

### Playwright MCP (browser automation)

| Tool | Purpose |
|------|---------|
| `playwright_browser_navigate` | Go to URL |
| `playwright_browser_take_screenshot` | Visual proof |
| `playwright_browser_snapshot` | Accessibility tree |
| `playwright_browser_find` | Locate elements |
| `playwright_browser_evaluate` | JS assertions in page |
| `playwright_browser_console_messages` | Check errors |
| `playwright_browser_click` | Interact with elements |
| `playwright_browser_type` | Input text |

---

## 7. Invariants (Never Violate)

1. **FRONTEND = BACKEND (5.1):** slug links backend/frontend; render contract + resolve slots, never hardcode `if (slug)`.
2. **Slots are globals:** new UI regions are slots in `frontend/src/ui/slots.ts`, resolved through the registry.
3. **Hot-swap live:** `register(slot, slug, component)` updates mounted UI with no rebuild.
4. **ActionRegistry (B8):** every UI action dispatches through `ActionRegistry`, Zod-validated.
5. **Generic-first:** new capabilities render with zero new components; promote only on merit.
6. **Type safety:** no `any`; `unknown` + narrowing; `type` imports; `.js` import extensions.
7. **Edit-then-verify:** complete ALL code edits before running any verification.
8. **Evidence before claims:** never claim completion without fresh verification output.

---

## 8. Anti-Patterns

- Building without a goal (interview first).
- Running `bun run typecheck` mid-build (wasteful; single gate at end).
- Using browser testing for API contract verification (use fetch/CLI).
- Hardcoding `if (slug === 'x')` in components (use slot resolution).
- Trusting DB `loginState` — verify actual browser cookies.
- Leaving orphan processes — always `pwsh scripts/stop-all.ps1`.
- Claiming success without running verification commands.
