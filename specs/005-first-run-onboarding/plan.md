# Implementation Plan: First-Run Onboarding

**Branch**: `005-first-run-onboarding` | **Date**: 2025-07-17

## Summary

Frontend code research: `FirstRunWizard.tsx` (369 lines, 5-step wizard) and `provider-setup-wizard.tsx` (538 lines, 6-step setup flow) already exist. The gap is wiring them together with first-run detection and a feature tour overlay.

## Technical Context

**Language**: TypeScript / React 18  
**Existing Frontends**: FirstRunWizard.tsx, provider-setup-wizard.tsx, ChromeSetupWizard (backend)  
**Flow**: App load → check providers count → 0? wizard : canvas  
**No new backend needed** — all APIs and engines exist.

## Constitution Check — PASS

- No CDP imports in UI code
- All actions via capability execution
- No new error surfaces needed

## Implementation Status

| Component | Status |
|-----------|--------|
| FirstRunWizard.tsx | ✅ Exists (5 steps, provider selection, workspace config, import) |
| provider-setup-wizard.tsx | ✅ Exists (workspace → provider → account → login → done) |
| ChromeSetupWizard (backend) | ✅ Exists (launch, verify, save) |
| First-run detection | ❌ Not wired — need to check provider count on app load |
| Feature tour overlay | ❌ Missing — 3-step highlight needed |

## Remaining Work

1. Add `useFirstRun()` hook — checks `GET /api/providers` count; returns true if 0
2. Wire FirstRunWizard to provider-setup-wizard using capability:setup:* capabilities
3. Add `FeatureTour` overlay component (3 steps: canvas, chat, health)
4. Store `onboardingComplete` flag in localStorage
5. Unit test the first-run detection hook
