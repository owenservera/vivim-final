# Research: First-Run Onboarding

**Feature**: 005-first-run-onboarding | **Date**: 2025-07-17

## Decision 1: Frontend Components Already Exist

**Finding**: `FirstRunWizard.tsx` (369 lines in `web/ui/src/features/canvas/`) and `provider-setup-wizard.tsx` (538 lines in `web/ui/src/features/`) both exist with full UIs.

**FirstRunWizard** has 5 steps: Welcome → Providers → Workspace → Import → Done.
- Provider step calls `POST /api/plugins/install` — this route may not exist
- Workspace step creates canvas layers via `POST /api/canvas/layers`
- Import step uploads files via `POST /api/upload/import`
- Sets `vivim.welcome_completed` in localStorage on workspace creation

**Provider Setup Wizard** has 6 steps: workspace → restore → provider → account → login → done.
- Uses existing `setupApi` client for Chrome launch, verify, complete
- Has full Chrome launch flow with port/profile management

**Decision**: Reuse both components. Wire FirstRunWizard's "Install Providers" step to use the provider-setup-wizard flow instead of `POST /api/plugins/install`. Add first-run detection hook.

**Rationale**: Both UIs are production-quality. Don't rebuild what exists.

## Decision 2: First-Run Detection via provider count

**Finding**: No first-run detection exists. The FirstRunWizard renders whenever its parent component mounts it.

**Decision**: Create `useFirstRun()` hook that:
1. Checks localStorage for `vivim.onboarding_complete` — if set, return false
2. Calls `GET /api/providers` — if count > 0, return false
3. Otherwise return true (show wizard)

**Rationale**: Providers are the gating factor — no providers = no functionality.

## Decision 3: Feature Tour as overlay component

**Finding**: No feature tour exists. Users go from wizard to blank canvas with no guidance.

**Decision**: Create `FeatureTour.tsx` overlay with 3 highlighted steps:
1. Canvas — "Your infinite workspace — drag, resize, and organize layers"
2. Chat — "Talk to your AI providers in the chat panel"
3. Health — "Monitor provider status in the health dashboard"

Store `vivim.tour_complete` in localStorage to prevent re-showing.

**Rationale**: Simple React component with z-index overlay + CSS highlight rings.

## Decision 4: Provider install flow

**Finding**: FirstRunWizard calls `POST /api/plugins/install` which may not exist. The actual ChromeSetupWizard backend exists with `runSetup()`.

**Decision**: Change FirstRunWizard's provider step to trigger the existing provider-setup-wizard flow's ProviderStep component, which already has Chrome launch/verify/complete logic wired.

**Rationale**: Use the battle-tested Chrome login flow, not a non-existent plugin install route.
