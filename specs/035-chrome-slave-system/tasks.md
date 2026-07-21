# Chrome Slave System — Tasks

## Phase 1: Documentation (Setup)

- [x] T001 [P] Create unified system diagram → `docs/diagrams/chrome-slave-system.md`
  <!-- bridge:unit=1.1 feature=specs/035-chrome-slave-system -->

- [x] T002 [P] Update AGENTS.md with Chrome slave invariants → `AGENTS.md`
  <!-- bridge:unit=1.2 feature=specs/035-chrome-slave-system -->

- [x] T003 [P] Update devops-fullstack skill with lifecycle section → `.opencode/skill/devops-fullstack/SKILL.md`
  <!-- bridge:unit=1.3 feature=specs/035-chrome-slave-system -->

- [x] T004 Update design document with final decisions → `docs/designs/chrome-slave-system-design.md`
  <!-- bridge:unit=1.4 feature=specs/035-chrome-slave-system -->

## Phase 2: Integration Verification (Foundational)

- [x] T005 Verify ProfileAllocator allocation works → `tests/integration/profile-allocation.test.ts`
  <!-- bridge:unit=2.1 feature=specs/035-chrome-slave-system -->

- [x] T006 Verify FleetSupervisor spawn/kill works → `tests/integration/fleet-supervisor.test.ts`
  <!-- bridge:unit=2.2 feature=specs/035-chrome-slave-system -->

- [x] T007 Verify FleetLimiter admission control works → `tests/integration/fleet-limiter.test.ts`
  <!-- bridge:unit=2.3 feature=specs/035-chrome-slave-system -->

- [x] T008 Verify SlaveStates state machine works → `tests/unit/engines/slave-states.test.ts`
  <!-- bridge:unit=2.4 feature=specs/035-chrome-slave-system -->

## Phase 3: Capability Integration (US1: Provider Registration & Launch)

- [x] T009 Verify capability integration works end-to-end → `tests/integration/capability-integration.test.ts`
  <!-- bridge:unit=3.1 feature=specs/035-chrome-slave-system US1 -->

- [x] T010 Verify Chrome slave launches for provider → `tests/integration/chrome-slave-launch.test.ts`
  <!-- bridge:unit=3.2 feature=specs/035-chrome-slave-system US1 -->

- [x] T011 Verify profile isolation maintained → `tests/integration/profile-isolation.test.ts`
  <!-- bridge:unit=3.3 feature=specs/035-chrome-slave-system US1 -->

- [x] T012 Verify existing Chrome slave reused → `tests/integration/chrome-slave-reuse.test.ts`
  <!-- bridge:unit=3.4 feature=specs/035-chrome-slave-system US1 -->

## Phase 4: Health Monitoring (US2: Health Monitoring & Recovery)

- [x] T013 Verify health check detects failures → `tests/integration/health-monitoring.test.ts`
  <!-- bridge:unit=4.1 feature=specs/035-chrome-slave-system US2 -->

- [x] T014 Verify auto-restart on transient failures → `tests/integration/auto-restart.test.ts`
  <!-- bridge:unit=4.2 feature=specs/035-chrome-slave-system US2 -->

- [x] T015 Verify circuit breaker prevents cascade → `tests/integration/circuit-breaker.test.ts`
  <!-- bridge:unit=4.3 feature=specs/035-chrome-slave-system US2 -->

- [x] T016 Verify agent notified of persistent failures → `tests/integration/agent-notification.test.ts`
  <!-- bridge:unit=4.4 feature=specs/035-chrome-slave-system US2 -->

## Phase 5: Session Management (US3: Session Management & Relogin)

- [x] T017 Verify session expiry detection → `tests/integration/session-expiry.test.ts`
  <!-- bridge:unit=5.1 feature=specs/035-chrome-slave-system US3 -->

- [x] T018 Verify relogin flow works → `tests/integration/relogin-flow.test.ts`
  <!-- bridge:unit=5.2 feature=specs/035-chrome-slave-system US3 -->

- [x] T019 Verify profile state preserved across relogin → `tests/integration/profile-state-preservation.test.ts`
  <!-- bridge:unit=5.3 feature=specs/035-chrome-slave-system US3 -->

## Phase 6: Fleet Management (US4: Fleet Management & Admission Control)

- [x] T020 Verify admission control works → `tests/integration/admission-control.test.ts`
  <!-- bridge:unit=6.1 feature=specs/035-chrome-slave-system US4 -->

- [x] T021 Verify spawn guard prevents duplicates → `tests/integration/spawn-guard.test.ts`
  <!-- bridge:unit=6.2 feature=specs/035-chrome-slave-system US4 -->

- [x] T022 Verify pressure gate checks resources → `tests/integration/pressure-gate.test.ts`
  <!-- bridge:unit=6.3 feature=specs/035-chrome-slave-system US4 -->

- [x] T023 Verify queue timeout works → `tests/integration/queue-timeout.test.ts`
  <!-- bridge:unit=6.4 feature=specs/035-chrome-slave-system US4 -->

## Phase 7: Profile Management (US6: Profile Management & Cleanup)

- [x] T024 Verify profile cleanup works → `tests/integration/profile-cleanup.test.ts`
  <!-- bridge:unit=7.1 feature=specs/035-chrome-slave-system US6 -->

- [x] T025 Verify stray directory detection → `tests/integration/stray-detection.test.ts`
  <!-- bridge:unit=7.2 feature=specs/035-chrome-slave-system US6 -->

- [x] T026 Verify profile metadata tracked → `tests/integration/profile-metadata.test.ts`
  <!-- bridge:unit=7.3 feature=specs/035-chrome-slave-system US6 -->

## Phase 8: Polish

- [x] T027 Run full test suite → `bun test`
  <!-- bridge:unit=8.1 feature=specs/035-chrome-slave-system -->

- [x] T028 Run typecheck → `bun run typecheck`
  <!-- bridge:unit=8.2 feature=specs/035-chrome-slave-system -->

- [x] T029 Run lint → `bun run lint`
  <!-- bridge:unit=8.3 feature=specs/035-chrome-slave-system -->

- [x] T030 Run invariants check → `bun run devops invariants check --category B`
  <!-- bridge:unit=8.4 feature=specs/035-chrome-slave-system -->

- [x] T031 Run cross-surface verification → `bun run devops verify-cross-surface`
  <!-- bridge:unit=8.5 feature=specs/035-chrome-slave-system -->
