# Workflows

Step-by-step workflows for common frontend refinement tasks.

---

## Workflow 1: Wire a New Capability to the UI

**Trigger:** "Add capability X" or "build UI for Y"

### Steps

1. **Discover existing state**
   ```bash
   bun run devops runtime-test discover
   bun run devops agentic preflight
   ```

2. **Check if capability already exists**
   ```bash
   bun run devops runtime-test test --nl="<goal>"
   ```
   - If 200/ok → capability exists, skip to step 5 (UI wiring only)
   - If failure → build the capability first (step 3)

3. **Build backend capability** (if needed)
   - Engine in `src/engines/`
   - Store Contract in `src/storage/contracts/`
   - Register via `makeCapability(...)` with `surfaces: ALL_SURFACES`
   - API route if not covered by universal routes

4. **Verify backend**
   ```bash
   bun run devops runtime-test test-cap --slug=<slug>
   ```

5. **Wire frontend**
   - Check if generic default already renders it
   - If yes → done (generic-first principle)
   - If no → add slot taxonomy entry in `web/ui/src/ui/slots.ts`
   - Provide default in `web/ui/src/ui/defaults/`
   - Register in `web/ui/src/ui/defaults/index.ts`

6. **Verify slot resolution** (code-first)
   ```bash
   cat > .runtime/check-slot.ts << 'EOF'
   const port = (await Bun.file('.runtime/backend.port').text()).trim()
   const r = await fetch(`http://localhost:${port}/api/capabilities?surface=ui`)
   const j = await r.json()
   const c = j.capabilities?.find((x: any) => x.slug === '<slug>')
   console.log('slot:', c?.ui_position, 'component:', c?.ui_component)
   EOF
   bun run .runtime/check-slot.ts
   ```

7. **Run full gate** (see VERIFY-CHECKLIST.md)

---

## Workflow 2: Hot-Swap a Slot for a Provider

**Trigger:** "Customize chat.bubble for Claude" or "add provider-specific renderer"

### Steps

1. **Identify the slot and provider**
   - Slot: `chat.bubble` (from `web/ui/src/ui/slots.ts`)
   - Provider: `claude`

2. **Build the custom component**
   - Create `web/ui/src/ui/defaults/claude-bubble.tsx`
   - Follow existing patterns (no comments unless asked)
   - Use `.js` imports, no `any`, Zod at boundaries

3. **Register the override**
   ```typescript
   // In the component that mounts the surface:
   import { UIComponentRegistry } from '../../ui/registry.js'
   import { ClaudeBubble } from '../../ui/defaults/claude-bubble.js'

   UIComponentRegistry.register('chat.bubble', 'claude', ClaudeBubble, {
     sandbox: ['claude_send_message']
   })
   ```

4. **Verify hot-swap** (code-first)
   ```bash
   cat > .runtime/check-hotsSwap.ts << 'EOF'
   // Verify override is registered
   const overrides = UIComponentRegistry.listOverrides()
   const claudeBubble = overrides.find(o => o.slot === 'chat.bubble' && o.slug === 'claude')
   console.log('Override registered:', !!claudeBubble)
   EOF
   bun run .runtime/check-hotSwap.ts
   ```

5. **Verify visually** (browser)
   ```
   playwright_browser_navigate → http://localhost:5173
   playwright_browser_snapshot → verify Claude bubble renders
   playwright_browser_take_screenshot → visual proof
   ```

6. **Verify persistence** (reload test)
   - Reload the page
   - Verify override still applied (localStorage)

---

## Workflow 3: Debug Frontend-Backend Disconnect

**Trigger:** "UI shows X but API returns Y" or "frontend is stale"

### Steps

1. **Capture the symptom**
   ```bash
   bun run devops runtime-test debug
   ```
   - Check console for errors
   - Check network requests for failed calls

2. **Verify backend contract** (code-first)
   ```bash
   curl http://localhost:9420/api/capabilities?surface=ui | jq '.capabilities[] | select(.slug=="<slug>")'
   ```
   - Check `ui_slots`, `ui_position`, `ui_component`

3. **Verify slot resolution** (code-first)
   ```bash
   # Check what the registry resolves
   cat > .runtime/debug-slot.ts << 'EOF'
   const port = (await Bun.file('.runtime/backend.port').text()).trim()
   const r = await fetch(`http://localhost:${port}/api/capabilities?surface=ui`)
   const j = await r.json()
   const c = j.capabilities?.find((x: any) => x.slug === '<slug>')
   console.log('Contract:', JSON.stringify(c, null, 2))
   EOF
   bun run .runtime/debug-slot.ts
   ```

4. **Check frontend registry** (browser)
   ```
   playwright_browser_evaluate → window.__vivim.ui.listOverrides()
   ```
   - Compare with backend contract
   - Identify mismatches

5. **Fix the disconnect**
   - If backend is wrong → fix capability registration
   - If frontend is wrong → fix slot resolution or component
   - If stale → check caching or state management

6. **Re-verify**
   - Code-test: API contract matches frontend resolution
   - Visual-test: UI renders correct data

---

## Workflow 4: Add a New Slot to the Taxonomy

**Trigger:** "New UI region needed" or "add chat.memory slot"

### Steps

1. **Define the slot** in `web/ui/src/ui/slots.ts`
   ```typescript
   export const SLOT_IDS = {
     // ... existing slots
     'chat.memory': { name: 'Memory Panel', description: '...' },
   } as const
   ```

2. **Create default component** in `web/ui/src/ui/defaults/chat.memory.tsx`
   - Follow existing patterns
   - Use `useSlot` for resolution
   - Dispatch actions via `ActionRegistry`

3. **Register defaults** in `web/ui/src/ui/defaults/index.ts`
   ```typescript
   import { ChatMemory } from './chat.memory.js'
   registerDefaults({ 'chat.memory': ChatMemory })
   ```

4. **Wire to a capability** (backend)
   - Add `ui_slots: { "chat.memory": { "component": "chat-memory" } }` to capability

5. **Verify taxonomy** (code-first)
   ```bash
   bun run devops verify-cross-surface
   ```

6. **Verify rendering** (browser)
   ```
   playwright_browser_navigate → http://localhost:5173
   playwright_browser_snapshot → verify memory slot renders
   ```

---

## Workflow 5: Run Full Provider Onboarding with UI Verification

**Trigger:** "Onboard provider X end-to-end"

### Steps

1. **Discover** (CDP protocol)
   ```bash
   bun run devops discover-protocol <url> --hint=<name>
   ```

2. **Infer** (parser from streaming data)
   ```bash
   bun run devops runtime-test onboard infer --provider=<slug>
   ```

3. **Test selectors** (live DOM validation)
   ```bash
   bun run devops runtime-test onboard test-selectors --provider=<slug>
   ```

4. **Test parse** (wire format correctness)
   ```bash
   bun run devops runtime-test onboard test-parse --provider=<slug>
   ```

5. **Test capability** (registration + execution)
   ```bash
   bun run devops runtime-test onboard test-cap --provider=<slug>
   ```

6. **Test frontend** (E2E: canvas mount + capability invoke + DOM assert)
   ```bash
   bun run devops runtime-test onboard test-frontend --provider=<slug>
   ```
   This step:
   - Navigates to the UI
   - Mounts the canvas for the provider
   - Invokes a capability
   - Asserts DOM has expected elements
   - Takes screenshot proof
   - Records in UI test registry

7. **Verify** (cross-surface parity)
   ```bash
   bun run devops runtime-test onboard verify --provider=<slug>
   ```

8. **Converge** (spec + code + arch alignment)
   ```bash
   bun run devops runtime-test onboard converge --provider=<slug>
   ```

---

## Workflow 6: Fix a Visual Bug

**Trigger:** "The UI looks wrong" or "layout is broken"

### Steps

1. **Capture the symptom**
   ```
   playwright_browser_take_screenshot → visual proof of the bug
   playwright_browser_snapshot → accessibility tree
   playwright_browser_console_messages level=error → JS errors
   ```

2. **Identify the slot**
   - Which slot renders the broken element?
   - Check `web/ui/src/ui/slots.ts` for slot ID

3. **Check slot resolution**
   ```
   playwright_browser_evaluate → window.__vivim.ui.resolve('<slot_id>')
   ```
   - Is the correct component resolving?
   - Is it a default or bespoke?

4. **Check component code**
   - Read the component file
   - Check for CSS issues, layout bugs, missing props

5. **Fix the component**
   - Edit the component file
   - Follow existing patterns

6. **Verify fix**
   ```
   playwright_browser_navigate → http://localhost:5173
   playwright_browser_take_screenshot → visual proof of fix
   playwright_browser_console_messages → no new errors
   ```

---

## Workflow 7: Verify Cross-Surface Parity

**Trigger:** "Check parity" or "before shipping"

### Steps

1. **Run automated parity check**
   ```bash
   bun run devops verify-cross-surface
   ```
   - Check for 0 gaps
   - If gaps exist, identify which surface is missing

2. **Manual verification per surface**

   **CLI:**
   ```bash
   bun run src/cli/index.ts <command>
   ```

   **API:**
   ```bash
   curl http://localhost:9420/api/capabilities?surface=cli | jq '.capabilities[] | select(.slug=="<slug>")'
   curl http://localhost:9420/api/capabilities?surface=ui | jq '.capabilities[] | select(.slug=="<slug>")'
   ```

   **MCP:**
   ```bash
   # Via MCP server (if available)
   ```

   **UI:**
   ```
   playwright_browser_navigate → http://localhost:5173
   playwright_browser_snapshot → verify capability renders
   ```

3. **Record results**
   ```bash
   bun run devops ui-test record --provider=<slug> --cap=<name> --result=pass
   ```

---

## Workflow 8: Iterative Refinement Loop

**Trigger:** "Keep improving" or "iterate on the frontend"

### Steps

1. **Start the loop**
   ```bash
   bun run devops runtime-test loop --objective="<goal>"
   ```
   - Writes `.runtime/loop-state.json`
   - Runs typecheck + backend probe
   - Proposes step 1

2. **Implement the step**
   - Make code changes
   - Follow existing patterns

3. **Evaluate**
   ```bash
   bun run devops runtime-test loop --resume
   ```
   - Records pass/fail in ledger
   - Proposes next step or concludes done/blocked

4. **Repeat** until status is "done"

5. **Tear down**
   ```bash
   bun run devops runtime-test stop
   ```

---

## Workflow 9: Add Provider-Specific UI Override via DB

**Trigger:** "Drive slot override from backend data"

### Steps

1. **Add UI component override to ProviderCapability**
   ```sql
   UPDATE ProviderCapability
   SET ui_component_override = '{"chat.bubble": {"component": "claude-bubble", "sandbox": ["claude_send_message"]}}'
   WHERE provider_id = '<provider_id>' AND capability_id = '<capability_id>'
   ```

2. **Verify backend reads it**
   ```bash
   curl http://localhost:9420/api/capabilities?surface=ui | jq '.capabilities[] | select(.slug=="<slug>") | .ui_slots'
   ```

3. **Verify frontend applies it**
   ```
   playwright_browser_evaluate → window.__vivim.ui.listOverrides()
   ```

4. **Verify visual**
   ```
   playwright_browser_take_screenshot → override renders correctly
   ```

---

## Workflow 10: Record and Track UI Test Results

**Trigger:** "Track what's been tested"

### Steps

1. **Check current state**
   ```bash
   bun run devops ui-test status --provider=<slug>
   ```

2. **Identify untested capabilities**
   - List capabilities without test results
   - Prioritize by moment priority (P0 > P1 > P2 > P3)

3. **Run tests for untested capabilities**
   ```bash
   bun run devops runtime-test onboard test-frontend --provider=<slug>
   ```

4. **Record results**
   ```bash
   bun run devops ui-test record --provider=<slug> --cap=<name> --result=pass --detail="automated test"
   ```

5. **Check coverage**
   ```bash
   bun run devops agentic preflight 2>&1 | Select-String -Pattern "untested"
   ```
