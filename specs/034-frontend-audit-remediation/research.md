# Research: Frontend Audit Remediation

**Date**: 2026-07-21
**Spec**: `specs/034-frontend-audit-remediation/spec.md`

## Research Question 1: Vitest vs Bun Test Runner for Frontend

### Decision: Vitest

### Rationale
- Vitest integrates natively with Next.js 16 and React 19
- Provides accurate coverage reporting via c8/istanbul
- Supports React Testing Library out of the box
- Hot module replacement during test watch mode
- Compatible with Bun runtime (Vitest runs on Node but tests execute in Bun-compatible environment)

### Alternatives Considered
- **Bun test runner**: Better for backend (Prisma, engines), but lacks React Testing Library integration and coverage reporting for frontend
- **Jest**: Legacy choice, slower than Vitest, poor ESM support
- **Playwright**: E2E only, not suitable for unit tests

## Research Question 2: Lazy Loading Strategy

### Decision: React.lazy + Suspense for drawer panels

### Rationale
- DrawerSystem.tsx renders 16+ panels; only the active panel needs to be in the initial bundle
- React.lazy provides code-splitting at the component level
- Suspense provides loading states during chunk fetch
- Dynamic imports with `next/dynamic` for route-level code splitting

### Alternatives Considered
- **Bundle all panels**: Simpler but increases initial bundle size by ~40%
- **Manual chunk splitting**: More control but requires webpack config changes
- **Loadable Components**: Third-party dependency, unnecessary complexity

## Research Question 3: API Consolidation Path

### Decision: UnifiedIOProvider as sole API layer

### Rationale
- UnifiedIOProvider already handles retry, dedup, trace, abort
- backend-client.ts is older, lacks trace support, has hardcoded URLs
- Consolidation reduces maintenance burden and ensures consistent error handling
- Migration path: mark backend-client.ts as `@deprecated`, migrate consumers incrementally

### Alternatives Considered
- **Keep both layers**: Increases maintenance burden, inconsistent error handling
- **Replace backend-client entirely**: Risky, requires migrating all consumers at once
- **Create new unified layer**: Unnecessary, UnifiedIOProvider already exists

## Research Question 4: Error Boundary Placement

### Decision: Three-tier error boundaries

### Rationale
- Route-level (layout.tsx): Catches errors in entire routes
- Drawer-level (DrawerSystem.tsx): Catches errors in individual drawers
- Component-level (LivingCanvas.tsx): Catches errors in critical UI components
- Three tiers ensure graceful degradation without white-screen-of-death

### Alternatives Considered
- **Single route-level boundary**: Too coarse, entire app crashes on component error
- **Component-level only**: Too fine-grained, too many boundaries
- **No error boundaries**: Unacceptable for production

## Research Question 5: Tailwind Conversion Strategy

### Decision: Manual conversion with visual parity verification

### Rationale
- Inline styles in page.tsx and DrawerSystem.tsx are relatively simple
- Manual conversion ensures exact Tailwind utility class mapping
- Visual parity verified via Playwright screenshot tests
- Automated tools (tailwind-merge, class-variance-authority) assist with complex cases

### Alternatives Considered
- **Automated conversion tools**: Unreliable for complex inline styles
- **CSS Modules**: Would require restructuring, Tailwind is already adopted
- **Styled Components**: Adds runtime overhead, inconsistent with Tailwind

## Research Question 6: Test Coverage Targets

### Decision: ≥60% on critical components

### Rationale
- UniversalComponentRegistry: Core infrastructure, must be tested (80% target)
- useWebSocket: Critical for real-time features (75% target)
- UnifiedIOProvider: API layer, must be tested (70% target)
- prerouter: ML advisory layer, lower priority (60% target)
- LivingCanvas: Complex component, reasonable coverage (60% target)
- Composer: User-facing, reasonable coverage (60% target)

### Alternatives Considered
- **100% coverage**: Unrealistic for complex React components, diminishing returns
- **No coverage targets**: Unacceptable, no safety net for refactoring
- **Backend-only coverage**: Ignores frontend quality

## Research Question 7: Component Decomposition Boundaries

### Decision: Single-responsibility components with typed props

### Rationale
- page.tsx (817 lines) violates single-responsibility principle
- Decomposition into ChatHeader, MessageList, ChatInput, useChatState, useDrawerState
- Each component has clear props interface and single responsibility
- Custom hooks extract state management logic from components

### Alternatives Considered
- **Keep monolith**: Simpler but untestable, blocks all improvements
- **Decompose into 20+ tiny components**: Over-engineered, hard to navigate
- **Decompose into containers + components**: Unnecessary pattern for React 19

## Research Question 8: TypeScript Strictness Enforcement

### Decision: Incremental migration with `noImplicitAny: true`

### Rationale
- Current tsconfig.json has `noImplicitAny: false`, weakening type safety
- Constitutional requirement (§V Code Quality) mandates strict TypeScript
- Incremental migration: fix type errors in each file as it's touched
- Use `unknown` + type narrowing instead of `any`

### Alternatives Considered
- **Keep `noImplicitAny: false`**: Violates constitution, technical debt
- **Enable all strict flags at once**: Too many errors, blocks development
- **Use `// @ts-ignore`**: Suppresses errors, defeats purpose

## Summary

All research questions resolved. No `NEEDS CLARIFICATION` markers remain. The spec is ready for planning and implementation.
