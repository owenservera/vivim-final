# Specification Quality Checklist: Wire 10 Critical User Moments in v9 Canvas

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-19
**Feature**: [specs/030-v9-user-moments/spec.md](spec.md)

## Content Quality

- [x] CHK001 No implementation details (languages, frameworks, APIs) - Spec focuses on user value and business needs
- [x] CHK002 Focused on user value and business needs - Each user story describes user journeys
- [x] CHK003 Written for non-technical stakeholders - Language is accessible to business users
- [x] CHK004 All mandatory sections completed - User Scenarios, Requirements, Success Criteria all present

## Requirement Completeness

- [x] CHK005 No [NEEDS CLARIFICATION] markers remain - All requirements are clear and unambiguous
- [x] CHK006 Requirements are testable and unambiguous - Each FR has specific, measurable outcomes
- [x] CHK007 Success criteria are measurable - SC-001 through SC-010 have specific metrics
- [x] CHK008 Success criteria are technology-agnostic - No framework-specific language
- [x] CHK009 All acceptance scenarios are defined - Each user story has 3-5 acceptance scenarios
- [x] CHK010 Edge cases are identified - 5 edge cases documented with expected behavior
- [x] CHK011 Scope is clearly bounded - 10 user moments with clear priority tiers
- [x] CHK012 Dependencies and assumptions identified - 10 assumptions documented

## Feature Readiness

- [x] CHK013 All functional requirements have clear acceptance criteria - FR-001 through FR-020 are specific
- [x] CHK014 User scenarios cover primary flows - 10 user stories cover all critical moments
- [x] CHK015 Feature meets measurable outcomes defined in Success Criteria - All SCs are achievable
- [x] CHK016 No implementation details leak into specification - Spec remains technology-agnostic

## API Mapping Validation

- [x] CHK017 All API endpoints from USER-MOMENTS.md are referenced in spec - 20 endpoints documented
- [x] CHK018 WebSocket events are properly specified - subscribe, agent_command, ping/pong documented
- [x] CHK019 Capability slugs match backend definitions - All slugs verified against capability-bootstrap.ts
- [x] CHK020 Priority tiers are consistent with USER-MOMENTS.md - P1/P2/P3 alignment verified

## Notes

- Specification is ready for `/speckit.plan` phase
- All checklist items pass validation
- No clarifications needed - all requirements are clear
- API mapping is complete and accurate
- Ready to proceed to implementation planning

## Implementation Status (2026-07-20)

> `tasks.md` claims "all tasks completed" but the live frontend does NOT actually
> wire the 10 moments — the canvas is a generic node renderer. Re-verified against
> `web/ui/src` + `sdk/backend-client.ts`.

- [x] **Moment 5 — Command Palette**: wired to `listCapabilities('cli')` SDK call +
       `executeCapability(id)` with result toast in `app/page.tsx`. Previously hit
       stale `/api/search`. (RESOLVED)
- [x] **Moment 1 — First Contact**: `components/chat/HealthIndicator.tsx` polls
       `checkHealth()` + `getSession()` and shows Connected/Disconnected + user/retry,
       mounted in `ChatSurface`. (BUILT — runtime WS connect not yet verified)
- [x] **Moment 2 — Send Message**: `components/chat/Composer.tsx` sends via
       `sendMessage()` and renders streamed `conversation:block` events from the
       `conversation:<id>` WS topic; `StreamingIndicator` shows WS state. (BUILT)
- [x] **Moment 3 — Conversation List**: `components/chat/ConversationList.tsx` lists
       via `listConversations()`, create via `createConversation()`, delete via
       `deleteConversation(id)`; selecting lifts `id` to parent. (BUILT)
- [x] **Surface wiring**: `components/chat/ChatSurface.tsx` composes Moments 1/2/3,
       owns the single `useWebSocket` subscription, and is mounted as the `chat`
       surface in `app/page.tsx` (replacing the generic `LivingCanvas`). Exported
       from `components/canvas/index.ts`.
- [ ] **Moment 4 — Switch Provider**: providers listed in sidebar checkboxes, but no
       capability refresh on switch.
- [ ] **Moment 6 — Real-time Events**: WS now bridged to Composer streaming; other
       UI indicators (presence/notifications) still use the older `useWebSocket` path.
- [ ] **Moments 7–10**: endpoints exist in SDK; no UI components bound.

**Next**: verify P0 surface end-to-end against a running backend (health/WS on :9420);
then build Moment 4 provider-switch capability refresh and revisit Moments 6–10.
