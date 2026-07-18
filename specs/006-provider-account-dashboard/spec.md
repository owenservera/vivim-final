# Feature Specification: Provider Account Dashboard

**Feature Branch**: `006-provider-account-dashboard`
**Created**: 2025-07-17 | **Status**: Draft
**Input**: User description: "Build a provider account management dashboard that shows all configured provider accounts with real-time status. For each account, display: provider name/icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, session health, and quick actions (launch/reconnect Chrome, verify session, remove account). Replace the current read-only provider list with an interactive dashboard that updates in real time via WebSocket events (account:login_state, account:created, account:removed). Add a one-click "Add Account" button that kicks off the ChromeSetupWizard flow. When a session expires (detected via CDP cookie check), show a warning badge and a "Re-login" button. The backend data already exists in the providerAccount table — this spec builds the frontend dashboard and wires it to live events."

## User Scenarios & Testing

### User Story 1 — View All Provider Accounts with Live Status (Priority: P1)

User opens the provider account dashboard and sees every configured provider account as an interactive card showing provider name and icon, login state, last login timestamp, Chrome debug port, session health, and quick action buttons. The view replaces the previous read-only provider list.

**Why this priority**: This is the core surface — without it there is no dashboard. Every other story depends on accounts being visible and interactive.

**Independent Test**: Open the dashboard page with at least one seeded providerAccount row → every account renders with its name, icon, login-state badge, last-login time, debug port, session-health indicator, and action buttons. Delivers immediate value as a read-and-act status board even before any live events fire.

**Acceptance Scenarios**:

1. **Given** multiple provider accounts exist in the providerAccount table, **When** the dashboard loads, **Then** each account card displays: provider name, provider icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, and session health.
2. **Given** an account has never been logged in, **When** the dashboard renders it, **Then** its login state shows "Never logged in" (distinct neutral badge) rather than an error.
3. **Given** the dashboard is open, **When** the `account:login_state` WebSocket event arrives for an account, **Then** that card's login state and session-health indicators update in place without a page reload.
4. **Given** the `account:created` WebSocket event arrives, **When** a new account is added (e.g. via the setup wizard), **Then** a new card appears in the dashboard with no page refresh.
5. **Given** the `account:removed` WebSocket event arrives, **When** an account is deleted, **Then** that card disappears from the dashboard without a page refresh.

---

### User Story 2 — Re-login to an Expired Session (Priority: P1)

When a provider session expires (detected by a CDP cookie check showing expired cookies), the account card shows a warning badge and the user can re-login without reconfiguring the account.

**Why this priority**: Expired sessions are the primary pain point the dashboard must solve — surfacing expiry and offering one-click recovery keeps accounts usable.

**Independent Test**: Force an account into the "expired" login state → the card shows a warning badge and a "Re-login" button; clicking it launches the ChromeSetupWizard against the existing account profile and, on success, returns the card to "Authenticated". This story is independently testable from the add/remove flows.

**Acceptance Scenarios**:

1. **Given** an account's session is detected as expired via CDP cookie check, **When** the dashboard reflects the `account:login_state` event, **Then** the card shows a warning badge (e.g. amber "Session Expired") and a "Re-login" button replaces/extends the normal actions.
2. **Given** the card shows the warning badge, **When** the user clicks "Re-login", **Then** the ChromeSetupWizard launches Chrome to the provider login page using the account's existing profile.
3. **Given** re-login completes and the session is verified, **When** the next `account:login_state` event arrives, **Then** the warning badge clears and the login state returns to "Authenticated" with an updated last-login timestamp.

---

### User Story 3 — Launch / Reconnect Chrome and Verify Session (Priority: P2)

User can launch or reconnect Chrome for an account and explicitly verify the current session health from the dashboard.

**Why this priority**: These are the day-to-day recovery actions that keep accounts healthy; important but secondary to visibility and re-login.

**Independent Test**: With an account whose Chrome is stopped, click "Launch/Reconnect Chrome" → Chrome starts and the debug port populates on the card. Separately click "Verify Session" on an authenticated account → session-health indicator refreshes to reflect the live check.

**Acceptance Scenarios**:

1. **Given** an account whose Chrome process is not running, **When** the user clicks "Launch/Reconnect Chrome", **Then** Chrome is started for that account and the card's debug-port and session-health fields update to reflect the running state.
2. **Given** an authenticated account, **When** the user clicks "Verify Session", **Then** a live session check runs and the session-health indicator updates to the verified result.

---

### User Story 4 — Add a New Account (Priority: P2)

User clicks a single "Add Account" button to start onboarding a new provider account through the ChromeSetupWizard.

**Why this priority**: Account growth is needed for the dashboard to be useful long-term, but the dashboard is complete and usable without it.

**Independent Test**: Click "Add Account" → the ChromeSetupWizard flow starts; completing it produces an `account:created` event that appears as a new card. Testable independently of editing/removing existing accounts.

**Acceptance Scenarios**:

1. **Given** the user is on the dashboard, **When** they click the "Add Account" button, **Then** the ChromeSetupWizard flow is launched (one click, no intermediate manual steps).
2. **Given** the wizard completes and creates the account, **When** the `account:created` event fires, **Then** the new account card appears in the dashboard.

---

### User Story 5 — Remove an Account (Priority: P3)

User can remove a provider account they no longer use, with a confirmation step to prevent accidental loss.

**Why this priority**: A safe cleanup action; valuable but not core to the monitoring use case.

**Independent Test**: Click "Remove" on an account → confirmation dialog appears → on confirm, the account is removed and the `account:removed` event removes the card. Independently demonstrable.

**Acceptance Scenarios**:

1. **Given** the user clicks "Remove" on an account card, **When** a confirmation dialog appears, **Then** the dialog warns that removal deletes the account (and its Chrome profile) before any deletion occurs.
2. **Given** the user confirms removal, **When** the account is deleted, **Then** the `account:removed` event removes the card from the dashboard.

---

### Edge Cases

- What happens when the WebSocket connection drops? The dashboard SHOULD retain the last known state and indicate a disconnected/live-status indicator, then reconcile when the connection is re-established (the backend re-broadcasts current state on (re)subscribe).
- How does the dashboard handle an `account:login_state` event for an account not currently rendered (e.g. created before subscription)? It SHOULD treat it as an upsert and surface the card.
- How are duplicate rapid events for the same account handled? The card SHOULD debounce/throttle visual updates so it reflects the latest state without flicker.
- What happens when last-login timestamp is null (never logged in)? The card SHOULD display "Never" rather than a blank or error.
- What happens when the debug port is not assigned (Chrome not running)? The card SHOULD show "—" or "Not running" rather than a stale port.
- What happens if the ChromeSetupWizard is already running for an account when "Re-login" or "Add Account" is clicked? The action SHOULD be guarded to avoid launching a second concurrent wizard for the same account.

## Requirements

### Functional Requirements

- **FR-001**: Dashboard MUST display every provider account from the providerAccount table, each as an interactive card.
- **FR-002**: Each account card MUST display: provider name, provider icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, and session health.
- **FR-003**: Dashboard MUST update in real time via WebSocket events `account:login_state`, `account:created`, and `account:removed`, applying changes in place without a page reload.
- **FR-004**: Dashboard MUST provide a per-account "Launch/Reconnect Chrome" action.
- **FR-005**: Dashboard MUST provide a per-account "Verify Session" action that runs a live session check and refreshes the session-health indicator.
- **FR-006**: Dashboard MUST provide a per-account "Remove Account" action with a confirmation dialog before deletion.
- **FR-007**: When a session is detected as expired (via CDP cookie check), the account card MUST show a warning badge and a "Re-login" button.
- **FR-008**: Dashboard MUST provide a single "Add Account" button that launches the ChromeSetupWizard flow in one click.
- **FR-009**: When re-login completes and the session is verified, the account card MUST return to the "Authenticated" state with an updated last-login timestamp.
- **FR-010**: The dashboard MUST replace the existing read-only provider list surface entirely (no duplicate/legacy read-only view remaining).

### Key Entities

- **ProviderAccountSummary**: The dashboard's view model per account — providerSlug, providerName, providerIcon, loginState, lastLoginAt, debugPort, sessionHealth. Derived from the backend providerAccount record plus live Chrome/CDP state.
- **AccountLiveEvent**: The WebSocket payload shapes for `account:login_state` (state change for one account), `account:created` (new account), and `account:removed` (deleted account id).

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can see the full status of all configured accounts within 1 second of opening the dashboard.
- **SC-002**: A status change from a WebSocket event is reflected on the affected card within 200ms of receipt.
- **SC-003**: A user can start adding a new account in a single click (one action from dashboard to wizard launch).
- **SC-004**: 100% of account cards show a correct, non-blank login state, last-login, debug port, and session-health value (or an explicit "never"/"not running" placeholder) — no undefined/error fields.
- **SC-005**: An expired session is surfaced with a warning badge and re-login path such that a user can recover the session in under 3 visible steps.
- **SC-006**: The legacy read-only provider list is no longer reachable — the dashboard is the sole provider-account surface.

## Assumptions

- The backend `providerAccount` table and its existing fields (provider, login state, last-login timestamp, debug port, session health) are already populated and authoritative; this spec adds no new backend schema.
- Live session-expiry detection is performed by an existing CDP cookie check that emits `account:login_state` with an "expired" state; the dashboard only consumes the event.
- The ChromeSetupWizard flow already exists and can be launched by the frontend for both "Add Account" and "Re-login" against an existing account profile.
- Real-time updates use the application's existing WebSocket transport and event-bus conventions (the same channel that carries other live events); the dashboard subscribes on open and reconciles on reconnect.
- Provider icons are available via the existing provider-type conceptual model / icon resolution already used elsewhere in the UI.
- Mobile/touch layout is out of scope for v1; the dashboard is designed for desktop canvas/tab surfaces.
- "Remove Account" deletes the account record and its associated Chrome profile; recovery of a removed account requires re-running the setup wizard.
