# Implementation Plan: Frontend Audit Remediation

**Branch**: `034-frontend-audit-remediation` | **Date**: 2026-07-21 | **Spec**: `specs/034-frontend-audit-remediation/spec.md`

**Input**: Feature specification from `specs/034-frontend-audit-remediation/spec.md`

## Summary

Remediate 25 audit findings (P0–P3) across the `web/ui/` frontend: decompose the 817-line `page.tsx` monolith, enforce TypeScript strictness, consolidate dual API layers, establish test infrastructure, fix performance anti-patterns, and apply production hardening.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: React 19, Next.js 16, Tailwind CSS v4, shadcn/ui, Zustand, React Query, Zod, Vitest, React Testing Library
**Storage**: SQLite via Prisma (backend), client-side state via Zustand + React Query
**Testing**: Vitest (`bun test` in `web/ui/`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server, modern browsers
**Project Type**: Full-stack monorepo (backend engines + API + React frontend)
**Linter/Formatter**: Biome
**Build**: Next.js 16 (app router)

**Performance Goals**: ≥20% bundle reduction via lazy loading, zero unnecessary re-renders, <100ms component mount time
**Constraints**: Governor Canon (no CDP in frontend), Store Contracts (engines behind interfaces), One Entry Point (all operations via UnifiedCapability)

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports BunCdpClient directly — frontend uses API routes only
- [x] Store Contracts: engines depend on contracts, not impls — frontend never touches storage layer
- [x] One Entry Point: new operations are UnifiedCapabilities — API consolidation enforces this
- [x] Custom errors: no raw `new Error()` in engines — frontend uses error boundaries
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions — FR-002 enforces this
- [x] Tests: unit + integration + typecheck + lint gates — FR-005/FR-006 establish this

## Project Structure

### Documentation (this feature)

```text
specs/034-frontend-audit-remediation/
├── spec.md              # This file (WHAT/WHY)
├── plan.md              # Technical design (HOW)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
├── tasks.md             # Phase 2 output
└── checklists/
    └── requirements.md  # Quality gate
```

### Source Code (affected files)

```text
web/ui/src/
├── app/
│   ├── page.tsx                    # P0: Decompose from 817→≤200 lines
│   ├── layout.tsx                  # Add error boundary wrapper
│   └── globals.css                 # Tailwind conversion
├── components/
│   ├── canvas/
│   │   ├── LivingCanvas.tsx        # P2: Add React.memo, extract hooks
│   │   ├── DrawerSystem.tsx        # P2: Add React.memo, lazy load panels
│   │   ├── UnifiedIOProvider.tsx    # P0: Fix useMemo side effect
│   │   ├── CommandPalette.tsx      # P2: Lazy load
│   │   ├── NotificationsCenter.tsx # P0: Migrate to UnifiedIO
│   │   └── register-all.ts        # Test coverage target
│   ├── chat/
│   │   └── Composer.tsx            # Fix hook dependencies
│   └── Providers.tsx               # Add error boundary
├── hooks/
│   ├── useWebSocket.ts             # Fix hook dependencies
│   └── useAutoResize.ts            # Test coverage target
├── sdk/
│   └── backend-client.ts           # P0: Deprecate (keep for backward compat)
├── ml/
│   └── prerouter.ts                # Test coverage target
└── shared/
    └── universal-registry.ts       # Test coverage target
```

### Test Infrastructure (new)

```text
web/ui/
├── vitest.config.ts                # New: Vitest configuration
├── src/
│   ├── __tests__/
│   │   ├── shared/
│   │   │   └── universal-registry.test.ts
│   │   ├── hooks/
│   │   │   ├── useWebSocket.test.ts
│   │   │   └── useAutoResize.test.ts
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── UnifiedIOProvider.test.tsx
│   │   │   │   └── LivingCanvas.test.tsx
│   │   │   └── chat/
│   │   │       └── Composer.test.tsx
│   │   └── ml/
│   │       └── prerouter.test.ts
│   └── test-utils/
│       ├── render.tsx              # Custom render with providers
│       └── mocks/
│           └── api.ts              # Mock UnifiedIO responses
```

## Complexity Tracking

> No Constitution Check violations — all changes are compliant.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | N/A | N/A |

## Phase 0: Research

### Research Questions

1. **Vitest vs Bun test runner**: Vitest is chosen for `web/ui/` because it integrates natively with Next.js 16, supports React Testing Library out of the box, and provides accurate coverage reporting. Bun's test runner is used for backend only.

2. **Lazy loading strategy**: React.lazy + Suspense for drawer panels. The `DrawerSystem.tsx` renders 16+ panels; only the active panel needs to be in the bundle. Dynamic imports with `next/dynamic` for route-level code splitting.

3. **API consolidation path**: UnifiedIOProvider already handles retry, dedup, trace, abort. backend-client.ts will be marked `@deprecated` with a migration guide. All new code must use UnifiedIO. Existing consumers will be migrated incrementally.

4. **Error boundary placement**: Route-level (layout.tsx) + drawer-level (DrawerSystem.tsx) + component-level (LivingCanvas.tsx). Three tiers ensure graceful degradation.

5. **Tailwind conversion**: Inline styles in `page.tsx` and `DrawerSystem.tsx` will be converted to equivalent Tailwind utility classes. Visual parity verified via Playwright screenshot tests.

## Phase 1: Technical Design

### Component Decomposition Plan

**Current state**: `page.tsx` (817 lines) contains:
- Provider/model selection (lines 1–150)
- Chat message state management (lines 150–350)
- Message rendering (lines 350–550)
- Drawer state management (lines 550–700)
- WebSocket handling (lines 700–817)

**Target state**: `page.tsx` (~150 lines) delegates to:
- `ChatHeader.tsx` — provider/model selection (~120 lines)
- `MessageList.tsx` — message rendering (~180 lines)
- `ChatInput.tsx` — composer + send (~100 lines)
- `useChatState.ts` — custom hook for message state (~150 lines)
- `useDrawerState.ts` — custom hook for drawer management (~80 lines)

### API Consolidation Plan

**Current state**: Two competing API layers:
- `backend-client.ts` — older, Zod-validated fetch, hardcoded URLs
- `UnifiedIOProvider` — newer, trace-aware, retry, dedup, abort

**Target state**: UnifiedIOProvider is the sole API layer. backend-client.ts is deprecated with `@deprecated` JSDoc tag. All imports migrated to use `useUnifiedIO()` hook.

### Test Coverage Targets

| Component | Current Coverage | Target | Priority |
|-----------|-----------------|--------|----------|
| universal-registry.ts | 0% | 80% | P1 |
| useWebSocket.ts | 0% | 75% | P1 |
| UnifiedIOProvider.tsx | 0% | 70% | P1 |
| prerouter.ts | 0% | 60% | P2 |
| LivingCanvas.tsx | 0% | 60% | P2 |
| Composer.tsx | 0% | 60% | P2 |

## Quickstart Validation

### End-to-End Scenario: Chat Message Flow

1. **Given** the frontend is loaded at `http://localhost:3000`
2. **When** the user types a message in the composer
3. **Then** `ChatInput` component calls `useUnifiedIO().sendMessage()`
4. **And** the message appears in `MessageList` via `useChatState` hook
5. **And** the response streams in via WebSocket (useWebSocket hook)
6. **And** the response is rendered in `MessageList` with proper formatting

### Validation Commands

```bash
# Type safety
cd web/ui && bun run typecheck

# Tests
cd web/ui && bun test

# Lint
cd web/ui && bun run lint

# Bundle analysis
cd web/ui && bun run build --analyze

# Visual regression
cd web/ui && bun test --reporter=playwright
```

## Data Model

No new database models required. This is a frontend-only remediation.

### Client-Side State

- **Zustand store** (`useChatState`): messages, streaming state, provider/model selection
- **React Query** (`useUnifiedIO`): server state, cache, background refetch
- **React Context** (`ThemeProvider`, `UnifiedIOProvider`, `UniversalComponentRegistry`, `QueryClientProvider`): app-wide configuration

## Contracts

### Component Props Contracts

```typescript
// ChatHeader.tsx
interface ChatHeaderProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

// MessageList.tsx
interface MessageListProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
}

// ChatInput.tsx
interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled: boolean;
}
```

### Hook Contracts

```typescript
// useChatState.ts
interface UseChatStateReturn {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
}

// useDrawerState.ts
interface UseDrawerStateReturn {
  activeDrawer: string | null;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  isDrawerOpen: (id: string) => boolean;
}
