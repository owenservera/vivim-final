# Task 12 — Wire `OnboardingTour.onAction` to `/api/interpret`

**Phase**: B (Make first-run work in dev)
**Depends on**: Task 11 (the `onAction` prop is wired into `page.tsx` there)
**Effort**: 15 min
**Files touched**:
- `frontend/src/app/page.tsx`

## Context

`OnboardingTour.onAction` prop is `() => {}` (no-op) in `page.tsx` line 314. Step action buttons (`step.action.command`) get tracked by analytics but the command is never actually dispatched to the canvas. The handler in `OnboardingTour` (line 180-187) calls `onAction?.(command)` and auto-advances — but the parent doesn't wire it to anything.

## Goal

Wire `onAction` to call `/api/interpret` with the step's command string. Same pattern `HelpWidget` already uses (line 324).

## Spec

### Find the existing structure

In `frontend/src/app/page.tsx`, find the `<OnboardingTour>` render. After Task 11, it looks like:

```tsx
{guidedComplete && (
  <OnboardingTour
    userId="user:demo"
    onAction={(command) => {
      // Stub — Task 12 fills this in
      io.post('/api/interpret', { command });
    }}
  />
)}
```

### Replace the stub with the real implementation

```tsx
{guidedComplete && (
  <OnboardingTour
    userId="user:demo"
    onAction={async (command: string) => {
      try {
        const result = await io.post('/api/interpret', { command });
        // Optionally show a toast confirming the action ran
        // toast.success(`Ran: ${command}`);
        console.log('[onboarding action]', command, result);
      } catch (err) {
        console.error('[onboarding action failed]', command, err);
        // toast.error(`Failed: ${command}`);
      }
    }}
  />
)}
```

### Confirm `io.post` exists

`io` comes from `useIO()` (the `UnifiedIOProvider` context). Check that `page.tsx` already has access to `io`. If not, add:

```tsx
import { useIO } from '@/components/canvas/UnifiedIOProvider';
// ...
const io = useIO();
```

Look at how `HelpWidget` does it — same pattern.

### Confirm `/api/interpret` exists

`/api/interpret` is the NLCL (Natural Language Command Layer) route. Check if it exists in `frontend/src/app/api/interpret/route.ts`. If it does, you're done. If not, the route may be at a different path — search for `interpret` in `frontend/src/app/api/`.

If the route is named differently (e.g. `/api/command` or `/api/nlcl`), use that path instead. The contract is: POST with `{ command: string }` body, returns `{ ok: true, result?: any }` or `{ ok: false, error: string }`.

### Verify the command strings in `ONBOARDING_STEPS`

The `command` strings in `ONBOARDING_STEPS` (Task 01) must be valid NLCL commands. Suggested commands:
- `onboarding dismiss` — should map to "dismiss the tour"
- `conversation new` — should map to "create a new conversation"
- `palette open` — should map to "open the command palette"
- `onboarding complete` — should map to "mark tour complete"

If `/api/interpret` doesn't recognize these commands, either:
1. Add them to the NLCL command registry (wherever commands are registered — check `src/capability-bootstrap.ts` or similar).
2. Or change the commands in `ONBOARDING_STEPS` to ones the NLCL already recognizes.

Option 1 is preferred — these are useful commands regardless of the tour.

## Acceptance criteria

- [ ] `page.tsx` `<OnboardingTour>` has a real `onAction` handler that calls `io.post('/api/interpret', { command })`.
- [ ] Clicking a step's action button triggers the corresponding command.
- [ ] Errors are caught and logged (not unhandled rejections).
- [ ] Console shows `[onboarding action] <command> <result>` on click.

## Verification

```bash
cd /home/z/my-project/vivim-final
bun run dev

# Open http://localhost:3000
# If first-run, complete GuidedLanding first
# When OnboardingTour starts, click the action button on step 2 ("New conversation")
# Verify:
#   - A new conversation is created (sidebar updates)
#   - Console shows [onboarding action] conversation new { ok: true, ... }
#   - Tour advances to the next step
```

## Notes

- Don't add a toast notification yet — it's optional and adds a dependency on the toast system. If you want it, check that `useToast` or `sonner` is already imported in `page.tsx`.
- If `io.post` doesn't return a typed result, that's fine — the return type is `unknown` or `any`. The handler just logs it.
- The auto-advance behavior is in `OnboardingTour` itself (line 180-187 of `OnboardingTour.tsx`) — it advances the step after calling `onAction`. You don't need to handle advance in the parent.
