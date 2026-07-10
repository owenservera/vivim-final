# Unit 12.2: MirrorEngine Action Stubs

**Phase:** 12 | **File:** `src/engines/mirror-engine.ts`
**Depends:** 12.1 ChromeGovernor Boot Stubs | **Produces:** Real UI mirror action execution

## Purpose
Fixes the 3 stub methods in MirrorEngine: action execution (type/click/navigate via Governor CDP) and observation start/stop. Currently these return empty or hardcoded values.

## Current Stubs

### Stub 1: Execute Action (line 150)
```typescript
// Execute action via Governor CDP — stub for v1
return { success: true, actionId: action.id };
```
Replace with real CDP execution via `Governor.cdp.send()`.

### Stub 2: Start Observation (line 170)
```typescript
// Start observation via Governor — stub for v1
```
Replace with real observation loop using `setInterval` + CDP `Runtime.evaluate`.

### Stub 3: Stop Observation (line 176)
```typescript
// Stop observation — stub for v1
```
Replace with `clearInterval()` + save final state.

## Required Changes
- Inject `Governor` (or `CDPProxy`) into MirrorEngine constructor
- `executeAction(action)`: use `Governor.cdp.send()` to perform CDP commands based on action type
  - `type`: `Runtime.evaluate` to set input value
  - `click`: `Runtime.evaluate` to click element
  - `navigate`: `Page.navigate`, wait for load
- `startObservation(slaveId)`: set interval to poll page state (URL, title, visible text)
- `stopObservation()`: clear interval, persist final state to MirrorStore
- Return real action results with success/failure, duration, error details

## Tests
- [ ] `executeAction({ type: 'click', selector: '#btn' })` sends CDP click (requires browser)
- [ ] `startObservation('slave_1')` begins polling page state
- [ ] `stopObservation()` stops polling and returns final state
- [ ] All existing MirrorEngine tests still pass

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/engines/mirror-engine.test.ts` passes
