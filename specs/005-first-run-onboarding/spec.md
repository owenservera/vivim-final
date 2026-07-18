# Feature Specification: First-Run Onboarding

**Feature Branch**: `005-first-run-onboarding`

**Created**: 2025-07-17

**Status**: Draft

**Input**: User description: "Build a guided first-run onboarding flow for vivim. When a user opens the app for the first time (no providers configured), show a step-by-step wizard that walks them through adding their first AI provider account."

## User Scenarios & Testing

### User Story 1 — New User Adds First Provider (Priority: P1)

A first-time user opens vivim. No provider accounts are configured. The onboarding wizard appears, guides them through selecting and logging in to their first AI provider, shows progress at each step, and confirms success.

**Why this priority**: Without this, new users see an empty canvas with no guidance on how to connect a provider — the app is unusable out of the box.

**Independent Test**: Start with an empty database (no provider accounts). Load the app. The wizard should appear immediately. Select a provider, complete the Chrome login flow, and verify the account appears in the provider list after completion.

**Acceptance Scenarios**:

1. **Given** no provider accounts exist in the database, **When** the app loads, **Then** the onboarding wizard appears with a welcome message and provider selection screen
2. **Given** the wizard is showing the provider selection, **When** the user selects a provider (e.g. ChatGPT), **Then** the wizard proceeds to the setup step and shows "Launching Chrome..."
3. **Given** Chrome has launched and is at the provider login page, **When** the user completes login manually in the Chrome window, **Then** the wizard detects the login, shows "Verifying session...", then "Saving account...", and finally "Account ready"
4. **Given** the setup completed successfully, **When** the wizard finishes, **Then** the new provider account is saved to the database and the wizard shows a completion screen with a "Go to Canvas" button

### User Story 2 — Returning User Skips Wizard (Priority: P1)

A user who already has providers configured should never see the onboarding wizard. The app should load directly to the canvas.

**Why this priority**: Showing the wizard to returning users is a regression that blocks normal usage.

**Independent Test**: Seed at least one provider account. Load the app. The canvas should appear immediately with no wizard.

**Acceptance Scenarios**:

1. **Given** one or more provider accounts exist, **When** the app loads, **Then** the canvas is shown immediately — no wizard appears
2. **Given** the canvas is loaded, **When** the user wants to add another provider later, **Then** they can access the same setup flow from the provider dashboard (not the wizard)

### User Story 3 — Feature Tour After First Setup (Priority: P2)

After successfully adding their first provider, show a brief interactive tour highlighting the three main surfaces of the application.

**Why this priority**: New users need to know what they can do. Without a tour, they're left on the canvas with no context.

**Independent Test**: Complete the wizard. The feature tour should appear as an overlay with navigation between steps.

**Acceptance Scenarios**:

1. **Given** the wizard just completed adding the first provider, **When** user clicks "Go to Canvas", **Then** a 3-step tour overlay highlights: (1) the infinite canvas for arranging workspaces, (2) the chat surface for conversations, (3) the provider health dashboard for monitoring
2. **Given** the tour is showing, **When** user clicks "Skip Tour" or navigates past the last step, **Then** the tour dismisses and the full canvas is shown

### Edge Cases

- What happens when Chrome binary is not found on the user's machine? → Wizard shows a clear error: "Chrome not found. Please install Google Chrome to continue." with a link to the download page.
- What happens when the login times out (user walks away)? → After 5 minutes, the wizard shows "Login timed out. You can try again." with a Retry button.
- What happens when the user closes the Chrome window before logging in? → The wizard detects the Chrome process died and shows "Chrome was closed. Click Retry to try again."
- What happens when the user already has Chrome profiles from a previous install? → The wizard reuses existing profiles (ChromeSetupWizard.needsSetup() check).

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect first-run state by checking the provider account count in the database
- **FR-002**: Wizard MUST display all seeded provider types as selectable options with name and icon
- **FR-003**: Wizard MUST call the existing `ChromeSetupWizard.runSetup()` method to launch Chrome and handle login
- **FR-004**: Wizard MUST show progress indicators for each setup step: launching, waiting for login, verifying session, saving account
- **FR-005**: Wizard MUST handle setup failures: Chrome not found, login timeout, process crash — each with a user-friendly message and retry option
- **FR-006**: System MUST skip the wizard entirely when provider accounts already exist
- **FR-007**: Feature tour MUST highlight three regions: canvas, chat surface, and health dashboard
- **FR-008**: Feature tour MUST be dismissible with a "Skip" button and must not appear on subsequent launches

### Key Entities

- **OnboardingState**: Tracks which step the user is currently on (provider_selection, launching_chrome, waiting_for_login, verifying_session, saving_account, complete), the selected provider slug, and whether setup succeeded or failed
- **ProviderOption**: Represents a provider available for setup — includes provider slug, display name, icon, and login URL (derived from seeded provider data)

## Success Criteria

### Measurable Outcomes

- **SC-001**: New users can complete the full onboarding flow from app launch to "Account ready" in under 5 minutes
- **SC-002**: Setup failure rate across supported providers is under 10% (excluding user-cancelled setups)
- **SC-003**: Returning users never see the onboarding wizard (0 false positives for first-run detection)
- **SC-004**: Users who view the feature tour can name all three main surfaces when asked (measured via optional feedback prompt)

## Assumptions

- Chrome is installed on the user's machine (or the wizard handles the not-found case with a clear error)
- The `ChromeSetupWizard` engine handles the actual Chrome launch, login detection, and account saving — this spec covers only the frontend wizard UI and first-run detection
- Provider data (names, icons, login URLs) is available from the seeded provider manifests in `seeds/providers/`
- The feature tour is shown once per lifetime — tracked by a flag in local storage or database
- The canvas, chat surface, and health dashboard are already implemented and can be targeted by tour highlights
