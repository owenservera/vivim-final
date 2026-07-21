# Feature Specification: Frontend Audit Remediation

**Feature Branch**: `034-frontend-audit-remediation`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Deep inspect the frontend (web/ui/) and remediate all P0-P3 audit findings from the comprehensive code quality audit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monolith Decomposition (Priority: P1)

The 817-line `page.tsx` must be decomposed into focused, composable components. Currently a single file contains the entire chat interface, provider selection, model switching, drawer state management, and message rendering — violating single-responsibility and making the code untestable.

**Why this priority**: P0 finding — the monolith blocks all other improvements. Every other story depends on a decomposed, testable component tree.

**Independent Test**: Can be fully tested by verifying that `page.tsx` is under 200 lines, each extracted component renders in isolation, and the chat flow still works end-to-end.

**Acceptance Scenarios**:

1. **Given** the frontend is loaded, **When** the user sends a message, **Then** the message flows through the decomposed component tree and renders correctly
2. **Given** the page.tsx monolith, **When** decomposition is complete, **Then** each extracted component has its own file with clear props interface
3. **Given** the decomposed components, **When** unit tests are written, **Then** each component has ≥80% test coverage

---

### User Story 2 - Type Safety Enforcement (Priority: P1)

TypeScript strictness must be enforced: `noImplicitAny: false` must become `true`, all `any` types replaced with `unknown` + narrowing, and the dual API layer (backend-client vs UnifiedIO) consolidated into a single consistent pattern.

**Why this priority**: P0 finding — type safety is a constitutional requirement (Constitution §V). The dual API layer creates confusion and inconsistent error handling.

**Independent Test**: Can be fully tested by running `bun run typecheck` with zero errors and verifying all API calls go through UnifiedIO.

**Acceptance Scenarios**:

1. **Given** the tsconfig.json, **When** `noImplicitAny` is set to `true`, **Then** `bun run typecheck` passes with zero errors
2. **Given** the backend-client.ts, **When** deprecation is complete, **Then** all components import from UnifiedIOProvider
3. **Given** the hardcoded `http://localhost:9420`, **When** env variable is used, **Then** `NEXT_PUBLIC_API_URL` is referenced everywhere

---

### User Story 3 - Test Infrastructure (Priority: P2)

Zero test files exist in `web/ui/src/`. A test infrastructure must be established with Vitest + React Testing Library, and critical components (registry, hooks, providers) must have unit tests.

**Why this priority**: P1 finding — no tests means no safety net for any refactoring. Blocks confident iteration.

**Independent Test**: Can be fully tested by running `bun test` in `web/ui/` and seeing all tests pass with ≥60% coverage on critical paths.

**Acceptance Scenarios**:

1. **Given** the test infrastructure, **When** `bun test` runs in `web/ui/`, **Then** all tests pass
2. **Given** the UniversalComponentRegistry, **When** tested, **Then** registration, resolution, and fallback behavior are covered
3. **Given** the hooks (useWebSocket, useAutoResize), **When** tested, **Then** reconnection, subscription, and resize logic are covered

---

### User Story 4 - Performance Optimization (Priority: P2)

Performance anti-patterns must be fixed: `useMemo` with side effects in UnifiedIOProvider, missing `React.memo` on heavy components, no lazy loading for drawer panels, and unnecessary re-renders from context changes.

**Why this priority**: P2 finding — performance issues degrade UX but don't break functionality.

**Independent Test**: Can be fully tested by measuring re-render counts before/after, verifying lazy loading works, and confirming no `useMemo` side effects.

**Acceptance Scenarios**:

1. **Given** the UnifiedIOProvider, **When** useMemo is fixed, **Then** no side effects occur inside useMemo callbacks
2. **Given** heavy components, **When** React.memo is applied, **Then** unnecessary re-renders are eliminated
3. **Given** drawer panels, **When** lazy loading is implemented, **Then** initial bundle size is reduced by ≥20%

---

### User Story 5 - Production Hardening (Priority: P3)

Console.log statements must be removed, error boundaries added, inline styles converted to Tailwind classes, and stub panels with dummy data either implemented or clearly marked as TODO.

**Why this priority**: P3 finding — polish items that improve production readiness but don't affect core functionality.

**Independent Test**: Can be fully tested by searching for `console.log` (zero results), verifying error boundaries catch thrown errors, and confirming no inline styles remain.

**Acceptance Scenarios**:

1. **Given** the codebase, **When** console.log is searched, **Then** zero results in production code
2. **Given** the component tree, **When** an error is thrown, **Then** the error boundary catches it and shows a fallback UI
3. **Given** inline styles, **When** converted to Tailwind, **Then** visual appearance is identical

---

### Edge Cases

- What happens when UnifiedIOProvider is unavailable? → Fallback to backend-client with deprecation warning
- What happens when a lazy-loaded panel fails to load? → Error boundary catches, shows retry button
- What happens when WebSocket disconnects during a message send? → useWebSocket auto-reconnects, message is retried
- What happens when the backend URL is misconfigured? → Zod validation at startup fails with clear error message

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST decompose `page.tsx` into ≤200-line focused components with clear props interfaces
- **FR-002**: System MUST enforce `noImplicitAny: true` in tsconfig.json with zero type errors
- **FR-003**: System MUST consolidate dual API layers into UnifiedIOProvider exclusively
- **FR-004**: System MUST replace hardcoded `http://localhost:9420` with `NEXT_PUBLIC_API_URL` env variable
- **FR-005**: System MUST establish Vitest + React Testing Library test infrastructure in `web/ui/`
- **FR-006**: System MUST achieve ≥60% test coverage on critical components (registry, hooks, providers)
- **FR-007**: System MUST fix `useMemo` side effects in UnifiedIOProvider
- **FR-008**: System MUST add `React.memo` to heavy components (LivingCanvas, DrawerSystem, CommandPalette)
- **FR-009**: System MUST implement lazy loading for drawer panels
- **FR-010**: System MUST remove all `console.log` statements from production code
- **FR-011**: System MUST add error boundaries at route level and drawer level
- **FR-012**: System MUST convert inline styles to Tailwind CSS classes
- **FR-013**: System MUST mark stub panels with `// TODO: Implement` comments

### Key Entities

- **ComponentTree**: Decomposed hierarchy of focused React components with typed props
- **UnifiedIOProvider**: Single API layer handling fetch, retry, dedup, trace, abort
- **TestInfrastructure**: Vitest config, test utilities, mock factories, coverage thresholds
- **PerformanceProfile**: Memoization strategy, lazy loading boundaries, render optimization

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `page.tsx` is ≤200 lines with all UI logic in extracted components
- **SC-002**: `bun run typecheck` passes with zero errors under `noImplicitAny: true`
- **SC-003**: `bun test` in `web/ui/` passes with ≥60% coverage on critical paths
- **SC-004**: Zero `console.log` statements in production code
- **SC-005**: Initial bundle size reduced by ≥20% via lazy loading
- **SC-006**: Zero `any` types in `web/ui/src/` (all replaced with `unknown` + narrowing)
- **SC-007**: All API calls route through UnifiedIOProvider (backend-client.ts deprecated)

## Assumptions

- The existing React 19 + Next.js 16 + Tailwind CSS v4 stack is retained
- Vitest is the test runner (compatible with Bun runtime)
- The UnifiedIOProvider is the canonical API layer (backend-client.ts is deprecated)
- Existing component behavior must be preserved during decomposition
- The canvas (React Flow) architecture remains unchanged
- Stub panels with dummy data are out of scope for full implementation (just marked TODO)
