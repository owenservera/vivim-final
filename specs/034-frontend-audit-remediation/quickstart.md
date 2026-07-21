# Quickstart: Frontend Audit Remediation

**Date**: 2026-07-21
**Spec**: `specs/034-frontend-audit-remediation/spec.md`

## Prerequisites

- Bun runtime installed
- Node.js 18+ installed
- Git installed
- Access to `web/ui/` directory

## Setup

```bash
# 1. Navigate to frontend directory
cd web/ui

# 2. Install dependencies
bun install

# 3. Add test dependencies
bun add -d vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# 4. Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:9420" > .env.local

# 5. Verify setup
bun run typecheck
bun run lint
```

## Running Tests

```bash
# Run all tests
cd web/ui && bun test

# Run tests with coverage
cd web/ui && bun test --coverage

# Run specific test file
cd web/ui && bun test src/__tests__/shared/universal-registry.test.ts

# Run tests in watch mode
cd web/ui && bun test --watch
```

## Running Development Server

```bash
# Start frontend dev server
cd web/ui && bun run dev

# Start backend server (separate terminal)
bun run serve

# Verify frontend loads
# Open http://localhost:3000
```

## Validation Checklist

After implementation, verify:

```bash
# 1. Type safety
cd web/ui && bun run typecheck
# Expected: 0 errors

# 2. Lint
cd web/ui && bun run lint
# Expected: 0 warnings

# 3. Tests
cd web/ui && bun test
# Expected: all tests pass

# 4. Coverage
cd web/ui && bun test --coverage
# Expected: ≥60% on critical paths

# 5. No console.log
grep -r "console.log" web/ui/src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results

# 6. No any types
grep -r ": any" web/ui/src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results

# 7. page.tsx line count
wc -l web/ui/src/app/page.tsx
# Expected: ≤200 lines

# 8. Bundle size
cd web/ui && bun run build
# Check output for lazy-loaded chunks
```

## Component Decomposition Guide

### Extracting ChatHeader

```typescript
// 1. Create new file
touch web/ui/src/components/chat/ChatHeader.tsx

// 2. Move provider/model selection logic from page.tsx
// 3. Define props interface
// 4. Export component
// 5. Import in page.tsx
```

### Extracting MessageList

```typescript
// 1. Create new file
touch web/ui/src/components/chat/MessageList.tsx

// 2. Move message rendering logic from page.tsx
// 3. Define props interface
// 4. Export component
// 5. Import in page.tsx
```

### Extracting ChatInput

```typescript
// 1. Create new file
touch web/ui/src/components/chat/ChatInput.tsx

// 2. Move composer/send logic from page.tsx
// 3. Define props interface
// 4. Export component
// 5. Import in page.tsx
```

### Extracting Custom Hooks

```typescript
// 1. Create new files
touch web/ui/src/hooks/useChatState.ts
touch web/ui/src/hooks/useDrawerState.ts

// 2. Move state management logic from page.tsx
// 3. Define hook interfaces
// 4. Export hooks
// 5. Import in page.tsx
```

## API Consolidation Guide

### Migrating from backend-client to UnifiedIO

```typescript
// BEFORE (deprecated):
import { fetchCapabilities } from '@/sdk/backend-client';
const caps = await fetchCapabilities();

// AFTER (canonical):
import { useUnifiedIO } from '@/components/canvas/UnifiedIOProvider';
const { fetch } = useUnifiedIO();
const caps = await fetch('/api/capabilities');
```

### Marking backend-client as deprecated

```typescript
// web/ui/src/sdk/backend-client.ts

/**
 * @deprecated Use useUnifiedIO() from UnifiedIOProvider instead.
 * This module will be removed in a future version.
 * 
 * Migration guide:
 * 1. Import useUnifiedIO from '@/components/canvas/UnifiedIOProvider'
 * 2. Call useUnifiedIO() to get the fetch function
 * 3. Replace direct fetch calls with the unified fetch
 */
export async function fetchCapabilities() { ... }
```

## Troubleshooting

### Tests fail with "Cannot find module"

```bash
# Ensure vitest.config.ts exists and is configured
cat web/ui/vitest.config.ts

# Reinstall dependencies
cd web/ui && rm -rf node_modules && bun install
```

### Type errors after enabling noImplicitAny

```bash
# Find all any types
grep -r ": any" web/ui/src/ --include="*.ts" --include="*.tsx"

# Replace with unknown + narrowing
# Example:
# BEFORE: function process(data: any) { return data.foo; }
# AFTER: function process(data: unknown) { return (data as { foo: string }).foo; }
```

### Lazy loading fails

```bash
# Ensure React.lazy import is correct
# Ensure Suspense wrapper is present
# Check browser console for chunk loading errors
```

### console.log not removed

```bash
# Find all console.log statements
grep -rn "console.log" web/ui/src/ --include="*.ts" --include="*.tsx"

# Remove or replace with proper logging
# Example:
# BEFORE: console.log('debug:', data);
# AFTER: // removed (or use a proper logger if needed)
```
