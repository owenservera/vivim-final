# User Journey Completion Plan — vivim-final

**Source of Truth:** `.kilo/plans/1783737979221-user-journey-storyboard.md`

**Status:** ANALYSIS COMPLETE — Ready for Implementation

---

## Executive Summary

The sandbox MVP has infrastructure in place but 4 critical gaps block user journey validation:

| Gap | Blocking Moment | Units Required |
|-----|-----------------|----------------|
| Executor barrel missing | M-004, M-007-M-009 | 11.11 |
| Capability execution API missing | M-014 | 13.6, 18.2 |
| Type mismatches in events/stores | All moments (stubs) | 21.3.3, 4.2 types |
| UI accessibility lint issues | All moments | UI fix only |

---

## Current State Analysis

### ✅ Completed (Verified)
- **Phase 1-10**: All units complete (Prisma schema, seeds, engines, server shell)
- **Phase 13.1-13.9**: Done
  - Monorepo scaffold: `web/` workspace exists
  - ActionRegistry: `web/ui/src/actions/registry.ts`
  - AgentBridge: `web/ui/src/actions/agent-bridge.ts`
  - ProviderSetupWizard: `web/ui/src/features/provider-setup-wizard.tsx`
  - SandboxApp: `web/sandbox/src/app/sandbox-app.tsx`
  - CapabilityCatalog: `web/sandbox/src/features/capability-catalog.tsx`
- **Phase 14.1-14.8**: Marked done but CDP not fully wired to CapabilityEngine
- **Setup Router**: `src/server/setup-router.ts` exists with all endpoints
- **Executor modules**: All exist except barrel (`src/executor/*.ts` files present)

### ❌ Missing / Blocked

| Unit | File | Issue |
|------|------|-------|
| 11.11 | `src/executor/index.ts` | File does not exist — needs export barrel |
| 13.6 | `src/server/routes/capabilities.ts` | File missing |
| 13.10 | E2E tests | Blocked by real CDP |

---

## Implementation Tasks

### Task Group A: Executor Barrel (Unit 11.11) — BLOCKER FOR M-004

**Create:** `src/executor/index.ts`

```typescript
// Export barrel for executor module
export { BunCdpClient } from './cdp.js'
export { CDPTransportImpl } from './cdp-transport.js'
export type { CDPTransport } from './chrome-governor.js'
export { FleetSupervisor } from './fleet-supervisor.js'
export { launchChrome } from './launcher.js'
export { PortReaper } from './port-reaper.js'
export { ProfileAllocator } from './profile-allocator.js'
export { SlaveWrite } from './slave-write.js'

// Factory function for wiring
export function createExecutor(config: FleetConfig) {
  return {
    launch: (opts: LaunchOptions) => launchChrome(opts),
    cdp: (port: number) => new BunCdpClient(`ws://127.0.0.1:${port}/devtools/browser`),
    fleet: new FleetSupervisor(null, config),
  }
}
```

### Task Group B: Capability Execution API (Units 13.6, 18.2)

**Create:** `src/server/routes/capabilities.ts`

Endpoints per API contract (07-merged-api.md):
- `GET /api/capabilities` — list all capabilities (no auth)
- `POST /api/execute` — execute capability by slug (no auth initially)

Must integrate with `CapabilityEngine` or `ActionRegistry.dispatch()`.

**Route:** Add to `src/server/index.ts`:
```typescript
// Inside fetch handler, before conversationRouter
if (url.pathname.startsWith('/api/capabilities')) {
  return capabilitiesRouter(req)
}
if (url.pathname === '/api/execute' && method === 'POST') {
  return capabilitiesRouter(req)
}
```

### Task Group C: Type Fixes for CapabilityEngine

**Issue 1:** `capability.ts` emits `capability:executed` with `bindingId` but event type doesn't include it.

**Fix in `src/engines/capability-event-bus.ts`:**
```typescript
{
  type: 'capability:executed'
  capabilityId: string
  providerId: string
  traceId: string
  ok: boolean
  latencyMs: number
  bindingId?: string  // Add this optional field
}
```

**Issue 2:** `conversation-manager.ts` line 165 uses string literal instead of `PlanTier`.

**Fix:** Import `PlanTier` type from capability-resolution.ts and use properly.

### Task Group D: UI Accessibility Fixes (ProviderSetupWizard)

Per handover notes, fix LSP warnings:
- Add `htmlFor` to label elements
- Add `type="button"` to all buttons
- Reference `id` attributes for form fields

---

## Validation Matrix

| Moment | Validation Command | Prerequisites |
|--------|-------------------|---------------|
| M-003 (Login Flow) | `bun test tests/e2e/provider-setup.test.ts` | 11.11, real CDP |
| M-004 (Session Confirm) | Manual: complete setup wizard | 11.11, DB seeded |
| M-007 (Send Message) | `bun test tests/e2e/send-message.test.ts` | 14.2, 13.6 |
| M-014 (Capability Exec) | `bun test tests/e2e/capability-execution.test.ts` | 13.6, 18.2 |

---

## Moment-to-Unit Mapping (Current)

| Moment | Required Units | Status | Blocking On |
|--------|---------------|--------|-------------|
| M-001 | 13.1-13.4 | ✅ DONE | — |
| M-002 | 13.9 | ✅ DONE | — |
| M-003 | 14.2, 14.4 | ⚠ STUB | Real CDP in Governor |
| M-004 | 11.3, 11.4, 3.1 | ⚠ BLOCKED | 11.11 (barrel) |
| M-005 | 3.6, 10.1 | ✅ DONE | — |
| M-006 | 4.3, 3.6 | ✅ DONE | — |
| M-007 | 14.2, 14.5, 14.7 | ⚠ STUB | CDP real implementation |
| M-008 | 3.2, 3.3, 3.8, 4.1 | ✅ DONE | — |
| M-009 | 5.3, 3.6 | ✅ DONE | — |
| M-013 | 13.4, 13.6 | ⚠ PARTIAL | 13.6 (capabilities API) |
| M-014 | 18.2, 13.6, 4.2, 14.7 | ⚠ BLOCKED | Capabilities API |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Chrome not installed on test machine | HIGH | FleetSupervisor handles missing Chrome gracefully; E2E tests mock where needed |
| Provider login detection fragile | MEDIUM | Selector-based detection in capability.ts can be tuned post-validation |
| WebSocket agent bridge untested | MEDIUM | Integration tests exist; add E2E via Playwright |
| TypeError: `createOutcome` signature mismatch | LOW | `OutcomeInput` has `bindingId` but `SelectorStrategyRow` may not have `id` field - verify exists |

---

## Type Mismatch Details (for implementer)

### Event Type Updates Required

In `src/engines/capability-event-bus.ts`, add `bindingId?: string` to both event types:

**capability:executed event (line 8-15):**
```typescript
| {
    type: 'capability:executed'
    capabilityId: string
    bindingId?: string  // Optional - add this
    providerId: string
    traceId: string
    ok: boolean
    latencyMs: number
  }
```

**capability:failed event (line 16-23):**
```typescript
| {
    type: 'capability:failed'
    capabilityId: string
    bindingId?: string  // Optional - add this
    providerId: string
    traceId: string
    error: string
    recoveryBehavior: string
  }
```

### conversation-manager.ts Type Fix

Line 165: Change string literal to `PlanTier` enum.
```typescript
// Current (broken):
const resolved = await ctx.resolutionEngine.resolve(providerId, 'free')

// Fix:
import type { PlanTier } from '../engines/capability-resolution.js'
const resolved = await ctx.resolutionEngine.resolve(providerId, planTier as PlanTier)
```

---

## Success Criteria

1. `bun test tests/e2e/sandbox-feature.test.ts` passes (all assertions)
2. `bun run typecheck` returns 0 errors
3. ProviderSetupWizard completes end-to-end flow (manual validation)
4. Capability catalog loads and shows providers

---

## Recommended Implementation Order (per Ralph Loop)

```
1. Fix type errors (capability.ts, conversation-manager.ts)
2. Create src/executor/index.ts barrel (Unit 11.11)
3. Create src/server/routes/capabilities.ts (Unit 13.6)
4. Fix UI accessibility issues (htmlFor, type="button")
5. Add E2E test for capability execution
6. Run `bun run devops gate` to verify
```

---

*Reference: docs/merged-design-v2/04-merged-engines.md, docs/merged-design-v2/07-merged-api.md*