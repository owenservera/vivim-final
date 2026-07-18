# Quickstart: MVP Implementation

**Spec:** [spec.md](./spec.md)  
**Date:** 2026-07-17

## Prerequisites

- Bun v1.2+
- Node.js v20+
- Chrome browser (for CDP connection)
- PowerShell 7+ (Windows)

## Setup

```powershell
# From repo root
Set-Location "C:\0-BlackBoxProject-0\vivim-final"

# Install dependencies
bun install

# Database setup (first time only)
bun run db:setup

# Verify baseline
bun run typecheck
bun test
```

## Development

```powershell
# Start backend + frontend
pwsh scripts/start-bg.ps1

# Or start individually
pwsh scripts/start-backend.ps1
pwsh scripts/start-frontend.ps1

# Check health
pwsh scripts/health-check.ps1
```

## Build Order

### Phase 1: Provider Driver (Critical Path)
```bash
# Create driver
# src/engines/provider-driver.ts
# Tests: tests/unit/engines/provider-driver.test.ts
bun run typecheck
bun test tests/unit/engines/provider-driver*
```

### Phase 2: Frontend Chat Page
```bash
# Create chat page foundation
# web/ui/src/features/chat/ChatPage.tsx
# web/ui/src/features/chat/chatApi.ts
# web/ui/src/features/chat/useConversation.ts
bun run typecheck  # frontend
```

### Phase 3-6: Frontend Components
```bash
# All components in web/ui/src/features/chat/
# Components: ConversationSidebar, ConversationView, MessageBubble,
# ContentBlockRenderer, TextBlock, CodeBlock, LinkBlock, ThinkingBlock,
# ToolUseBlock, ErrorBlock, Composer, ProviderSelector, StreamingIndicator
bun run typecheck  # frontend
```

### Phase 7-8: Persistence
```bash
# Canvas mirror store
# src/storage/impl/canvas-mirror-store-impl.ts
# Settings store
# src/storage/impl/settings-store-impl.ts
bun run typecheck
bun test tests/unit/storage/*
```

### Phase 9-10: Integration & Verification
```bash
bun run typecheck
bun test
bun run lint
bun run devops invariants check --category B
bun run devops verify-cross-surface
```

## Testing

```powershell
# Unit tests
bun test tests/unit/

# Integration tests
bun test tests/integration/

# Specific engine test
bun test tests/unit/engines/provider-driver

# Coverage
bun test --coverage
```

## Key Files

| File | Purpose |
|------|---------|
| `docs/goals/MVP.md` | MVP goals (P0/P1/P2) |
| `specs/015-mvp-implementation/spec.md` | Feature spec |
| `specs/015-mvp-implementation/plan.md` | Implementation plan |
| `specs/015-mvp-implementation/tasks.md` | Task breakdown |
| `src/schema/streaming.ts` | ContentBlock type |
| `src/engines/provider-driver.ts` | Provider driver (to create) |
| `web/ui/src/features/chat/` | Chat UI components (to create) |

## Troubleshooting

### Typecheck fails
```powershell
bun run typecheck 2>&1 | Select-Object -First 50
```

### Tests fail
```powershell
bun test 2>&1 | Select-Object -First 50
```

### Frontend won't start
```powershell
# Check if port 5173 is in use
netstat -ano | findstr :5173

# Kill existing process
taskkill /PID <pid> /F
```

### CDP connection fails
```powershell
# Check Chrome is running with remote debugging
# Verify debug port in ProviderAccount record
bun run devops runtime-test preflight
```
