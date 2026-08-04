# PRD #9: Provider Setup Wizard

## Problem Statement

Provider setup is complex and confusing:

- No guided flow for adding a new provider
- No validation of provider credentials before saving
- No visual feedback during provider health check
- No provider comparison (which provider for which task?)
- No provider quick-switch
- Provider status not clearly visible

## Goals

1. **Setup wizard** — step-by-step guided flow for adding providers
2. **Credential validation** — validate API keys/tokens before saving
3. **Health check feedback** — visual spinner/checkmark during health check
4. **Provider comparison** — side-by-side comparison of capabilities
5. **Quick switch** — dropdown to switch active provider
6. **Status indicators** — clear visual status (connected, error, degraded)

## Scope

| Area | Files | Action |
|------|-------|--------|
| Setup wizard | `ProviderSetupWizard.tsx` (new) | Multi-step wizard: select provider → enter credentials → validate → health check → done |
| Credential form | `ProviderCredentialForm.tsx` (new) | Dynamic form based on provider type (API key, OAuth, etc.) |
| Health check | `ProviderHealthCheck.tsx` (new) | Visual spinner/checkmark during health check |
| Provider comparison | `ProviderComparison.tsx` (new) | Side-by-side capability comparison |
| Quick switch | `ProviderQuickSwitch.tsx` (new) | Dropdown to switch active provider |
| Status indicators | `ProviderStatusBadge.tsx` (new) | Badge: connected (green), error (red), degraded (yellow) |

## Non-Goals

- Provider marketplace/discovery
- Provider billing/usage tracking
- Provider auto-configuration

## Existing Code Assessment

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Provider catalog | `features/onboard-flow.tsx:43` | ✅ Exists | Limited: only `PROVIDERS` array, no setup wizard |
| Provider onboarding | `features/onboard-flow.tsx` | ⚠️ Partial | 3-step flow: Pick → Login → Ready. Limited UX, no credential validation, no health check feedback |
| Provider switch | ❌ Missing | No quick switch component |
| Provider status | ❌ Missing | No status indicators |
| Provider comparison | ❌ Missing | No comparison view |
| Credential validation | ❌ Missing | No form validation |
| Health check UI | ❌ Missing | Only backend health check, no frontend feedback |

## Implementation Steps

### Step 1: ProviderSetupWizard
- Create `components/providers/ProviderSetupWizard.tsx` — multi-step wizard with progress indicator
- Steps:
  1. Provider selection (show icons, names, descriptions)
  2. Credentials (dynamic form based on provider)
  3. Validation (real-time validation, success/error states)
  4. Health check (spinner/checkmark with timing)
  5. Summary (show configured provider)
- Progress bar, back/next buttons, step-specific validation

### Step 2: ProviderCredentialForm
- Create `components/providers/ProviderCredentialForm.tsx` — dynamic form based on provider type
- Provider types:
  - **API Key**: single text input with visibility toggle
  - **OAuth**: redirect button to auth provider
  - **Service account**: multiple fields (JSON/keys)
  - **Custom**: text area for arbitrary config
- Real-time validation, error messages, field-level validation
- Save to local state, not backend (backend step 3)

### Step 3: ProviderHealthCheck
- Create `components/providers/ProviderHealthCheck.tsx` — visual spinner/checkmark during health check
- States:
  - **Idle**: default state with "Start Health Check" button
  - **Checking**: spinner with timeout (3-5s)
  - **Success**: checkmark with success message
  - **Error**: error icon with error message, retry option
- Simulates backend health check (no real API calls)

### Step 4: ProviderComparison
- Create `components/providers/ProviderComparison.tsx` — side-by-side capability comparison
- Show all providers in grid
- Columns: Provider, Capabilities (tokens, context length, features), Integration ease, Model quality, Pricing, Supported modalities
- Highlight target provider with different styling
- Allow user to favorite/compare providers

### Step 5: ProviderQuickSwitch
- Create `components/providers/ProviderQuickSwitch.tsx` — dropdown to switch active provider
- Show currently active provider (with status badge)
- List all providers with status badges
- Click to switch provider (shows confirmation)
- Accessible with keyboard navigation

### Step 6: ProviderStatusBadge
- Create `components/providers/ProviderStatusBadge.tsx` — badge with status color
- **Connected**: green badge with checkmark, "Connected"
- **Error**: red badge with X, "Error"
- **Degraded**: yellow badge with warning, "Degraded"
- **Not connected**: gray badge, "Not connected"
- Add tooltip with status details

## Acceptance Criteria

- [ ] Setup wizard guides user through adding provider
- [ ] Credentials validated before saving
- [ ] Health check shows visual feedback
- [ ] Provider comparison shows capabilities side-by-side
- [ ] Quick switch dropdown works
- [ ] Status badges show correct colors
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Priority

**P2** — Improves provider management UX but not blocking core functionality.

## Estimated Effort

~4–5 hours. Wizard + forms + comparison + quick switch + status badges.
