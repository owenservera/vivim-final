# Verification Checklist

Gate-by-gate verification. Every gate must pass before claiming completion.

---

## Gate 0: Pre-Flight

**When:** Before any work begins.

```bash
bun run devops runtime-test health
```

- [ ] `database:OK` — DB reachable and schema up to date
- [ ] `server:OK` — Backend bound to port (check `.runtime/backend.port`)
- [ ] `frontend:reachable` — Vite dev server responding on `:5173`

If any check fails, fix the launch before proceeding. Read `.runtime/backend-out.log` for errors.

---

## Gate 1: Typecheck + Lint (Code Correctness)

**When:** After ALL code edits are complete (not incrementally).

```bash
bun run typecheck                    # backend: 0 errors
cd frontend && bun run typecheck       # frontend: 0 errors
cd frontend && bun run build           # vite: 0 errors
bun run lint                         # biome: 0 errors
```

- [ ] Backend typecheck passes
- [ ] Frontend typecheck passes
- [ ] Vite build succeeds
- [ ] Linter passes

**Never skip this gate.** A green typecheck does not mean the code is correct, but a red typecheck means it is wrong.

---

## Gate 2: Unit Tests (Logic Correctness)

**When:** After Gate 1 passes.

```bash
bun test tests/unit/engines/<engine>.test.ts   # specific engine
bun test tests/unit/ui/                         # UI components
bun test tests/unit/                            # all unit tests
```

- [ ] Engine unit tests pass (mocked stores)
- [ ] UI component tests pass (render, props, events)
- [ ] No flaky tests (run twice to confirm)

---

## Gate 3: API Contract (Backend-Frontend Link)

**When:** After Gate 2 passes. This is the critical "wiring" gate.

### 3a. Capability Registration

```bash
bun run devops runtime-test discover
```

- [ ] Capability appears in the capability list
- [ ] `slug` matches between backend registration and frontend expectation
- [ ] `surfaces` includes `ui` (or `ALL_SURFACES`)
- [ ] `inputSchema` is valid JSON Schema
- [ ] `apiEndpoint` is correct (method + path)

### 3b. Capability Execution

```bash
bun run devops runtime-test test-cap --slug=<slug> --input='{"key":"value"}'
```

- [ ] Returns 200 with valid response body
- [ ] Response shape matches `outputSchema`
- [ ] No unhandled errors in backend logs

### 3c. NL Resolution

```bash
bun run devops runtime-test test --nl="<natural language command>"
```

- [ ] NL resolves to the correct capability
- [ ] Parameters extracted correctly
- [ ] Execution succeeds

### 3d. Slot Resolution (Code-First)

```bash
cat > .runtime/check-slots.ts << 'EOF'
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const r = await fetch(`http://localhost:${port}/api/capabilities?surface=ui`)
const j = await r.json()
const target = j.capabilities?.find((c: any) => c.slug === '<slug>')
if (!target) { console.error('Capability not found'); process.exit(1) }
console.log('ui_slots:', JSON.stringify(target.ui_slots, null, 2))
console.log('ui_position:', target.ui_position)
console.log('ui_component:', target.ui_component)
EOF
bun run .runtime/check-slots.ts
```

- [ ] `ui_slots` is present and well-formed
- [ ] Slot IDs match `SLOT_IDS` in `frontend/src/ui/slots.ts`
- [ ] Component references exist in the component catalog

---

## Gate 4: Cross-Surface Parity

**When:** After Gate 3 passes. Non-negotiable for shipping.

```bash
bun run devops verify-cross-surface
```

- [ ] CLI resolves the capability
- [ ] API resolves the capability
- [ ] MCP resolves the capability
- [ ] UI resolves the capability
- [ ] **0 parity gaps** — every surface returns consistent data

### Manual Parity Check

```bash
# CLI
bun run src/cli/index.ts <command>

# API
curl http://localhost:9420/api/capabilities?surface=cli | jq '.capabilities[] | select(.slug=="<slug>")'
curl http://localhost:9420/api/capabilities?surface=ui | jq '.capabilities[] | select(.slug=="<slug>")'
curl http://localhost:9420/api/capabilities?surface=mcp | jq '.capabilities[] | select(.slug=="<slug>")'
```

- [ ] Same `slug` across all surfaces
- [ ] Same `inputSchema` across all surfaces
- [ ] Same `outputSchema` across all surfaces
- [ ] Consistent `cliCommand`, `mcpToolName`, `apiEndpoint` across surfaces

---

## Gate 5: Visual Verification (Browser)

**When:** After Gate 4 passes. For critical user moments only.

### 5a. Screenshot Proof

```bash
bun run dev
bun run devops runtime-test health
bun run devops runtime-test engage --provider=<slug>
bun run devops runtime-test verify
```

- [ ] Screenshot captured at `.runtime/screenshots/verify-0.html`
- [ ] Layout matches expected design
- [ ] No visual regressions

### 5b. DOM Assertions (Playwright MCP)

```
1. playwright_browser_navigate → http://localhost:5173
2. playwright_browser_snapshot → accessibility tree
3. playwright_browser_find → locate expected elements
4. playwright_browser_console_messages level=error → no errors
```

- [ ] Expected elements present in DOM
- [ ] Text content matches expected values
- [ ] No console errors
- [ ] Accessibility tree is valid (no orphaned elements)

### 5c. Streaming Verification (if applicable)

```
1. Send a message via the UI
2. playwright_browser_take_screenshot during streaming
3. Verify progressive text rendering
4. playwright_browser_take_screenshot after completion
5. Verify final state
```

- [ ] Streaming text appears progressively (not all at once)
- [ ] Spinner/loading indicator visible during stream
- [ ] Final state shows complete message
- [ ] No layout shift during streaming

---

## Gate 6: UI Test Registry

**When:** After Gate 5 passes. Record the result.

```bash
bun run devops ui-test record --provider=<slug> --cap=<name> --result=pass --detail="<description>"
```

- [ ] Test result recorded in `.runtime/ui-test-registry.json`
- [ ] Timestamp is current
- [ ] Provider slug is correct
- [ ] Capability name is correct

### Check Registry State

```bash
bun run devops ui-test status --provider=<slug>
```

- [ ] All expected capabilities are tested
- [ ] No stale results (older than 7 days)

---

## Gate 7: Code Audit

**When:** After Gate 6 passes. For significant changes.

```bash
bun run devops audit-code standard
```

- [ ] No P0 findings (security, data loss)
- [ ] No P1 findings (correctness, architecture)
- [ ] P2 findings documented (performance, quality)
- [ ] P3 findings noted (style, minor improvements)

---

## Gate 8: Final Gate (Pre-Commit)

**When:** All previous gates pass. The last check before shipping.

```bash
bun run typecheck                    # re-verify types
bun run lint                         # re-verify lint
bun test                             # re-verify all tests
bun run devops verify-cross-surface  # re-verify parity
```

- [ ] All checks pass
- [ ] No regressions introduced
- [ ] UI test registry is up to date
- [ ] Screenshot proof exists (for visual changes)
- [ ] Changes are minimal and focused

---

## Failure Recovery

### If Gate 0 fails (pre-flight)
- Check `.runtime/backend-out.log` for startup errors
- Verify DB is running: `bunx prisma migrate status`
- Check port availability: `netstat -ano | findstr :9420`

### If Gate 1 fails (typecheck)
- Read the error messages carefully
- Fix one error at a time
- Re-run typecheck after each fix

### If Gate 2 fails (unit tests)
- Check for shared state between tests (missing `beforeEach`)
- Check for timing issues (async not awaited)
- Isolate failing test: `bun test tests/unit/engines/specific.test.ts`

### If Gate 3 fails (API contract)
- Verify capability registration: `bun run devops runtime-test discover`
- Check backend logs for execution errors
- Verify slot resolution in code

### If Gate 4 fails (parity)
- Check which surface is missing the capability
- Verify `surfaces` field in capability registration
- Re-run `bun run devops runtime-test catalog-gen`

### If Gate 5 fails (visual)
- Check console for JS errors
- Verify slot resolution in browser: `window.__vivim.ui.listOverrides()`
- Take screenshot and inspect manually

### If Gate 6 fails (registry)
- Check `.runtime/ui-test-registry.json` for corruption
- Re-run the test manually
- Record again with fresh timestamp

### If Gate 7 fails (audit)
- Address P0/P1 findings immediately
- Document P2/P3 findings for later

---

## Quick Verification Script

For rapid iteration, run this after each code edit:

```bash
# One-shot verification
bun run typecheck && cd frontend && bun run typecheck && bun run build && bun test && bun run devops verify-cross-surface && echo "ALL GATES PASS"
```

For visual verification (after code gates pass):

```bash
bun run devops runtime-test verify
```
