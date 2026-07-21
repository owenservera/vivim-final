# Quickstart: LLM-Driven Provider Testing

## Prerequisites
- Backend running: `CAP_STORE_PORT=9420 bun run serve` (or via `pwsh scripts/start-all.ps1`)
- Frontend running: `cd web/ui && bun run dev` (port 5173)
- Chrome profiles exist for gemini, chatgpt, claude under `chrome-profiles/<slug>/owservera/`
- Valid browser cookies for each provider

## Quick Validation

### 1. Check provider status
```bash
bun run devops runtime-test status --provider=gemini
bun run devops runtime-test status --provider=chatgpt
bun run devops runtime-test status --provider=claude
```

### 2. Run full 8-phase pipeline for one provider
```bash
bun run devops runtime-test onboard run --provider=gemini
```

### 3. Run cross-surface parity check
```bash
bun run devops verify-cross-surface
```

### 4. Run full test suite
```bash
bun test
bun run typecheck
bun run lint
```

### 5. Visual check (requires browser)
```bash
# Navigate to frontend, inspect slot resolution
# Expected: all 3 provider composers render correctly
# Expected: messages stream progressively
# Expected: no console errors
```

## Expected Outcomes
- **gemini**: batchexecute parser parses real wire data, Quill composer resolved, send button click works
- **chatgpt**: SSE parser validated against real chat UI format (not API format), textarea composer works
- **claude**: Full pass — parser, selectors, profile, streaming all verified
- **Setup wizard**: Detects empty DB, steps through provider selection, completes to chat surface
- **Frontend**: Clean layout, no if(slug) branches, all slots resolved, CSS variables used consistently

## Key Contracts
- Slot resolution: `UIComponentRegistry.resolve(slotId, context)` → component name
- Provider test phases: `devops/runtime-test onboard --provider=<slug> --phase=<phase>` → JSON result
- Cross-surface parity: `devops/verify-cross-surface` → `{ total, parityGaps, pass }`
