# Task 11 — Coordinate GuidedLanding ↔ OnboardingTour in `page.tsx`

**Phase**: B (Make first-run work in dev)
**Depends on**: Task 01 (needs `ONBOARDING_STEPS` to exist so OnboardingTour renders)
**Effort**: 30 min
**Files touched**:
- `frontend/src/app/page.tsx`

## Context

Both `<GuidedLanding>` (line 231) and `<OnboardingTour>` (line 314) mount at root. On first run, GuidedLanding opens (z=2000) AND OnboardingTour independently fetches state and may also open (z=1100). They don't coordinate. The user sees two overlays at once.

## Goal

Add coordination: `<OnboardingTour>` only mounts after GuidedLanding completes (or when `needsSetup === false` on initial mount, for returning users).

## Spec

### Find the existing structure

In `frontend/src/app/page.tsx`, find:
- The `needsSetup` state (set by `checkNeedsSetup()` on mount).
- The `<GuidedLanding>` render (with `onComplete` handler).
- The `<OnboardingTour>` render (with `userId="user:demo"`).

### Add a `guidedComplete` state

```tsx
const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
const [guidedComplete, setGuidedComplete] = useState<boolean>(false);

useEffect(() => {
  checkNeedsSetup().then(setNeedsSetup);
}, []);

// If needsSetup is false on initial mount, mark guided as "complete" (skipped)
useEffect(() => {
  if (needsSetup === false) {
    setGuidedComplete(true);
  }
}, [needsSetup]);
```

### Update GuidedLanding's `onComplete` handler

```tsx
<GuidedLanding
  mode={needsSetup ? 'onboarding' : 'assistant'}
  open={guidedOpen}
  onOpenChange={setGuidedOpen}
  onComplete={(convId, provider) => {
    setGuidedOpen(false);
    setNeedsSetup(false);
    setGuidedComplete(true);  // ← NEW: allow OnboardingTour to mount
    refreshConversations();
    refreshProviders();
  }}
/>
```

### Conditionally render OnboardingTour

```tsx
{guidedComplete && (
  <OnboardingTour
    userId="user:demo"
    onAction={(command) => {
      // Wired in Task 12
      io.post('/api/interpret', { command });
    }}
  />
)}
```

### Edge case: returning user who dismissed the tour

If `needsSetup === false` on mount AND the user previously dismissed the tour, `OnboardingTour` will fetch state, see `dismissed: true`, and not render. That's the existing behavior — no change needed.

### Edge case: user re-opens GuidedLanding via Cmd+Shift+H

When the user opens GuidedLanding in `assistant` mode (via Cmd+Shift+H), `guidedComplete` is already `true`, so `OnboardingTour` stays mounted underneath. GuidedLanding renders at z=2000, OnboardingTour at z=1100 — GuidedLanding covers it. When GuidedLanding closes, OnboardingTour is still there (if not dismissed). This is fine.

If you want to hide OnboardingTour while GuidedLanding is open in assistant mode, add:

```tsx
{guidedComplete && !guidedOpen && (
  <OnboardingTour ... />
)}
```

But this would unmount/remount OnboardingTour every time the user toggles the assistant, losing in-progress tour state. Better to leave it mounted and let z-index handle visual stacking.

## Acceptance criteria

- [ ] `page.tsx` has a `guidedComplete` state.
- [ ] `<OnboardingTour>` only renders when `guidedComplete === true`.
- [ ] On first run (fresh DB), only GuidedLanding renders — OnboardingTour does not render simultaneously.
- [ ] After completing GuidedLanding, OnboardingTour mounts and starts.
- [ ] Returning users (`needsSetup === false` on mount) see OnboardingTour immediately (if not dismissed).
- [ ] Cmd+Shift+H reopens GuidedLanding in assistant mode without unmounting OnboardingTour.

## Verification

```bash
cd /home/z/my-project/vivim-final
bun run dev

# Test 1: First run
# Delete the DB to simulate fresh install
rm -f ~/.local/share/vivim/cap-store/cap-store.sqlite*
bun x prisma db push  # re-create empty
bun run dev
# Open http://localhost:3000
# Verify: only GuidedLanding renders (chat-as-landing-page). No spotlight tour.
# Complete first-run (pick ChatGPT, log in).
# Verify: GuidedLanding closes, OnboardingTour starts.

# Test 2: Returning user
# (DB now has a provider account from Test 1)
# Refresh http://localhost:3000
# Verify: GuidedLanding does not auto-open. OnboardingTour starts (if not dismissed).

# Test 3: Assistant re-open
# Press Cmd+Shift+H
# Verify: GuidedLanding opens in assistant mode, OnboardingTour stays mounted underneath.
# Press Cmd+Shift+H again to close.
# Verify: OnboardingTour is still where you left it.
```

## Notes

- This task doesn't change `GuidedLanding` or `OnboardingTour` themselves — only how `page.tsx` orchestrates them.
- If `OnboardingTour`'s `userId` prop is hardcoded to `"user:demo"`, leave it for now. Multi-user is out of scope (Decision: non-decisions).
- The `onAction` wiring is stubbed here and fully implemented in Task 12. Don't skip the stub — without it, the prop type may not match.
