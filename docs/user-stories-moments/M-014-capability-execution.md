# M-014: Capability Execution with Result

**Phase:** 100 (User-Centric Frontend)
**Depends:** 100.7 (Capability Toolbar), 100.8 (Capability Result Panel), 90.6 (Capability API)
**Status:** NOT STARTED

## User Story

> As a user, I want to click a capability button and see the result inline.

## Moment Definition

**Entry State:** User clicks capability button in conversation context
**Exit State:** Capability executes, result displayed inline

## Visual State

```
┌─────────────────────────────────────────────────────┐
│ Vivim Sandbox                    [Claude ▾] [⚙]   │
├──────────┬──────────────────────────────────────────┤
│          │  Conversation: My Test Chat              │
│ Conversations     │  ────────────────────────────    │
│ ├ My Test Chat ✓ │                                  │
│                  │  User: Take a screenshot          │
│                  │                                  │
│ Capabilities     │  [📸 Screenshot] [🔍 Search]     │
│ ├ Screenshot     │                                  │
│ ├ Search         │  ┌────────────────────────────┐  │
│ └ Summarize      │  │ 📸 Screenshot Result       │  │
│                  │  │                            │  │
│                  │  │ [image displayed here]     │  │
│                  │  │                            │  │
│                  │  │ Captured at 14:32:05       │  │
│                  │  └────────────────────────────┘  │
│                  │                                  │
│                  ├──────────────────────────────────┤
│                  │ [Type your message...    ] [Send] │
└──────────┴──────────────────────────────────────────┘
```

## Component Spec

### CapabilityToolbar
```tsx
// web/sandbox/src/features/capability-toolbar.tsx
interface CapabilityToolbarProps {
  capabilities: CapabilityUIContract[]
  onExecute: (slug: string) => void
  executing: string | null
}

// Renders:
// - Horizontal bar of capability buttons
// - Each button shows icon + label
// - Active/ executing state shown
// - Only shows capabilities for current conversation
```

### CapabilityResultPanel
```tsx
// web/sandbox/src/features/capability-result-panel.tsx
interface CapabilityResultPanelProps {
  result: ExecutionResult
  capability: CapabilityUIContract
}

// Renders:
// - Result header with capability name
// - Result content based on result_component
// - Timestamp
// - Copy/retry buttons
```

### CapabilityExecuteButton
```tsx
// web/sandbox/src/features/capability-execute-button.tsx
interface CapabilityExecuteButtonProps {
  capability: CapabilityUIContract
  onExecute: (slug: string) => void
  executing: boolean
}

// Renders:
// - Button with icon from ui_icon
// - Label from ui_label
// - Loading spinner when executing
// - Disabled during execution
```

## Store Contract

```typescript
// web/sandbox/src/store/execution-store.ts
interface ExecutionState {
  activeExecution: {
    slug: string
    status: 'idle' | 'running' | 'complete' | 'error'
    result?: ExecutionResult
    error?: string
  } | null
  
  execute: (conversationId: string, slug: string) => Promise<void>
  clearResult: () => void
}

// Actions:
// execute()        → POST /api/conversations/:id/capabilities/:slug/execute
//                  → WebSocket capability:progress events
// clearResult()    → Resets activeExecution
```

## API Calls

```
POST /api/conversations/:id/capabilities/:slug/execute
Request: {}
Response: {
  executionId: string
  status: "running"
}

WebSocket: capability:progress
{
  type: "capability:progress",
  step: 1,
  total: 3,
  description: "Launching Chrome...",
  moduleId: "screenshot",
  slaveId: "slave-1"
}

WebSocket: capability:complete
{
  type: "capability:complete",
  executionId: string,
  result: {
    success: true,
    data: { ... },
    latencyMs: 2500
  }
}
```

## Test Scenario

```typescript
test('M-014: User executes capability and sees result', async ({ page }) => {
  // Prerequisites: Conversation active, capability available
  
  // Capability toolbar visible
  await expect(page.locator('[data-testid="capability-toolbar"]')).toBeVisible()
  
  // Click capability button
  await page.click('[data-testid="capability-screenshot"]')
  
  // Button shows loading
  await expect(page.locator('[data-testid="capability-screenshot"]')).toHaveAttribute(
    'data-status',
    'running'
  )
  
  // Result panel appears
  await expect(page.locator('[data-testid="capability-result"]')).toBeVisible()
  
  // Progress shown
  await expect(page.locator('[data-testid="capability-progress"]')).toContainText(
    'Launching Chrome...'
  )
  
  // Wait for completion (within 15s)
  await expect(page.locator('[data-testid="capability-result-content"]')).toBeVisible({
    timeout: 15000
  })
  
  // Result has image (for screenshot capability)
  await expect(page.locator('[data-testid="capability-result-content"] img')).toBeVisible()
  
  // Timestamp shown
  await expect(page.locator('[data-testid="capability-timestamp"]')).toMatch(/\d{2}:\d{2}:\d{2}/)
})
```

## Gate Criteria

- [ ] CapabilityToolbar renders with available capabilities
- [ ] Capability buttons show correct icons and labels
- [ ] Click triggers execution
- [ ] Button shows loading state during execution
- [ ] POST /api/conversations/:id/capabilities/:slug/execute succeeds
- [ ] WebSocket progress events update UI
- [ ] Result panel displays after completion
- [ ] Result content renders based on result_component
- [ ] Copy/retry buttons work
- [ ] `bun run typecheck` passes

---

*This moment validates the capability system end-to-end.*
