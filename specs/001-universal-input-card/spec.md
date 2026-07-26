# Feature Specification: Universal Atomic TextEntryBox + Pluggable Capability Drawer

**Feature Branch**: `001-universal-input-card`

**Created**: 2026-07-26

**Status**: Draft

**Input**: Design doc `docs/designs/universal-input-card-dense-capability-bar.md` (v3)

---

## User Scenarios & Testing

### User Story 1 - Bare Minimum Input (Priority: P1)

A user opens the chat surface and sees only a textarea + send button. No model pill, no capability chips, no footer hints. They type a message and press Enter to send.

**Why this priority**: This is the irreducible atomic unit. Everything else builds on it. Without this, there is no input at all.

**Independent Test**: Open the app, verify only textarea + send button render (no toolbar, no chips, no footer). Type "hello" and press Enter — message is sent and appears in the thread.

**Acceptance Scenarios**:
1. **Given** a fresh load with no localStorage config, **When** the chat composer renders, **Then** it shows only a textarea (with placeholder "Message...") and a Send button — no model selector, no chips, no footer
2. **Given** the textarea is empty, **When** the user clicks Send, **Then** nothing happens (disabled state)
3. **Given** the user types text and clicks Send or presses Enter, **Then** the text is sent via `POST /api/conversations/:id/send` and the textarea clears
4. **Given** the user holds Shift and presses Enter, **Then** a newline is inserted instead of sending

---

### User Story 2 - Stateful Role Context (Priority: P1)

The TextEntryBox knows which workspace, surface, region, and Z-layer it belongs to. Two boxes in different workspaces behave differently — different placeholder, different submit action, different add-ons.

**Why this priority**: The architecture allows multiple text entry boxes across the multi-surface canvas. Each must know its identity.

**Independent Test**: Mount two ComposerShell instances with different `scope` props and verify they render different placeholders and submit different endpoints.

**Acceptance Scenarios**:
1. **Given** a ComposerShell with `scope.behavior = 'chat'`, **When** it renders, **Then** the placeholder is "Message..." and submit calls `sendMessage()`
2. **Given** a ComposerShell with `scope.behavior = 'search'`, **When** it renders, **Then** the placeholder is "Search..." and submit fires a search event
3. **Given** a ComposerShell with `scope.behavior = 'prompt'`, **When** it renders, **Then** the placeholder is "What should the agent do?"
4. **Given** a ComposerShell with `scope.behavior = 'command'`, **When** it renders, **Then** the placeholder is "Type a command..."
5. **Given** a ComposerShell with a specific `instanceId`, **When** the user toggles add-ons, **Then** the config is saved to `vivim:composer-addons:{instanceId}` in localStorage

---

### User Story 3 - Toggle Add-Ons via Gear Menu (Priority: P2)

A power user wants a model selector and capability toggles. They click the gear icon, check "Model Selector" and "Capability Toggles", and the toolbar appears above the textarea.

**Why this priority**: This demonstrates the pluggable architecture. The component is usable without it, but this is the primary customization surface.

**Independent Test**: Click gear icon, check checkboxes, verify add-ons appear/disappear.

**Acceptance Scenarios**:
1. **Given** no add-ons are enabled, **When** the user clicks the gear icon, **Then** a menu with all available add-on checkboxes appears
2. **Given** the gear menu is open, **When** the user checks "Model Selector", **Then** a model pill appears above the textarea
3. **Given** the gear menu is open, **When** the user unchecks "Model Selector", **Then** the model pill disappears
4. **Given** the user enables add-ons, **When** they reload the page, **Then** the same add-ons appear (persisted to localStorage)

---

### User Story 4 - Streaming Status Bar (Priority: P2)

While a message is being sent, a streaming status bar appears below the textarea showing a pulsing dot, "Streaming..." label, and a Stop button.

**Why this priority**: Streaming state communication is essential for good UX.

**Independent Test**: Send a message and verify the streaming bar appears. Click Stop and verify it disappears.

**Acceptance Scenarios**:
1. **Given** the user sends a message, **When** the request is in flight, **Then** a streaming status bar appears with a pulsing red dot, "Streaming..." text, and a Stop button
2. **Given** the streaming bar is visible, **When** the user clicks Stop, **Then** the streaming state is set to false and the bar disappears
3. **Given** the streaming bar is visible, **When** the request completes, **Then** the bar disappears

---

### Edge Cases

- What happens when localStorage is full or corrupted? → Catch block returns default config, no crash
- What happens when no provider is active? → Send button is disabled, placeholder still shows
- What happens when the same workspace+surface combo has multiple instances? → Each has a unique `instanceId` and separate localStorage key
- What happens when an add-on is enabled but its data hasn't loaded yet (e.g. models fetching)? → Add-on renders a null/loading state gracefully

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST render a `TextEntryBox` (auto-resizing textarea) + `SendButton` as the minimum atomic input unit
- **FR-002**: System MUST accept a `ComposerInstanceScope` prop on every shell instance identifying its workspace, surface, region, Z-layer, and behavior mode
- **FR-003**: Placeholder text MUST be derived from `scope.behavior` ('chat' → "Message...", 'search' → "Search...", 'prompt' → "What should the agent do?", 'command' → "Type a command...", 'comment' → "Add a comment...")
- **FR-004**: Submit behavior MUST vary by `scope.behavior` (chat → `sendMessage()`, search/execute/prompt/command/comment → dispatch capability events)
- **FR-005**: Each shell instance MUST persist its enabled add-ons to `vivim:composer-addons:{instanceId}` in localStorage
- **FR-006**: Add-ons MUST be pluggable via a `BUILTIN_ADDONS` array with key, position ('top'|'bottom'|'inline'), Component, label, and icon
- **FR-007**: A gear menu MUST expose toggles for all registered add-ons
- **FR-008**: All components MUST use `style={{}}` + CSS variables (`--bg`, `--accent`, `--text`, `--border`, etc.) — no Tailwind
- **FR-009**: The `ComposerShell` MUST normalize `ContentPart` blocks from the backend to the legacy `{kind, content, index}` format for `MessageBlock.tsx` compatibility
- **FR-010**: The ML prerouter `classify()` MUST be called on every submit before sending

### Key Entities

- **TextEntryBox**: Atomic textarea component. Pure input. No knowledge of add-ons, streaming, models, or workspace scope.
- **SendButton**: Atomic submit button. Disabled when text is empty.
- **ComposerShell**: Wrapper component that receives `scope` and children add-ons. Manages localStorage, fetches models+capabilities, orchestrates submit.
- **ComposerInstanceScope**: Value object carrying `workspaceId`, `surfaceSlug`, `regionSlotId`, `activeZLayer`, `instanceId`, `behavior`.
- **ComposerAddOn**: Interface for pluggable add-ons with key, position, Component, label, icon.
- **ComposerShellContext**: Context object passed to every add-on containing scope, provider state, model state, capability state, attachment state, streaming state, and toggle functions.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: TextEntryBox + SendButton render in under 100ms on a cold mount
- **SC-002**: All add-ons can be toggled on/off without a full re-render of the shell
- **SC-003**: No regressions in existing send flow — messages send correctly via the existing Composer integration
- **SC-004**: TypeScript strict mode passes with no `any` types
- **SC-005**: All components pass `bun test` for the frontend test suite

---

## Assumptions

- The existing `Composer.tsx` remains as the parent component that manages WebSocket streaming, message history, and error state — `ComposerShell` replaces only the input area
- `ChatSlotSurface` layout is NOT changed — `ComposerShell` is an internal sub-component of `Composer`
- Models and capabilities are fetched from the existing per-provider API endpoints
- `ZLayerId` type is already defined in `frontend/src/shared/z-layer.ts`
- `WorkspaceTaxonomy` types are already defined in `frontend/src/shared/workspace.ts`
