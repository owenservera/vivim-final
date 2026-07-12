# M-005: Conversation Create

**Phase:** 100 (User-Centric Frontend)
**Depends:** 100.1 (Conversation List View)
**Status:** NOT STARTED

## User Story

> As a user, I want to start a new conversation with my AI provider.

## Moment Definition

**Entry State:** User clicks "New Conversation" button
**Exit State:** New conversation appears in list, selected, ready for messages

## Visual State

```
┌─────────────────────────────────────────────────────┐
│ Vivim Sandbox                    [Claude ▾] [⚙]   │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Conversations     │  New Conversation               │
│ ├ New Conv ✓     │  ─────────────────               │
│ ├ Chat 1         │  Start typing your message...    │
│ └ Chat 2         │                                  │
│                  │                                  │
│ ──────────────── │                                  │
│ Capabilities     │                                  │
│ ├ Claude         │                                  │
│ └ ChatGPT        │                                  │
│                  │                                  │
└──────────┴──────────────────────────────────────────┘
```

## Component Spec

### ConversationList
```tsx
// web/sandbox/src/features/conversation-list.tsx
interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}

// Renders:
// - "New Conversation" button at top
// - List of conversations with title
// - Active conversation highlighted
```

### CreateConversationModal
```tsx
// web/sandbox/src/features/create-conversation-modal.tsx
interface CreateConversationModalProps {
  providers: Provider[]
  onSubmit: (providerId: string, title?: string) => void
  onClose: () => void
}

// Renders:
// - Provider dropdown (pre-selected from header)
// - Optional title input
// - Create button
```

## Store Contract

```typescript
// web/sandbox/src/store/conversation-store.ts
interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  loading: boolean
  
  list: () => Promise<void>
  create: (providerId: string, title?: string) => Promise<Conversation>
  select: (id: string) => void
}

// Actions:
// list()           → GET /api/conversations
// create()         → POST /api/conversations
// select(id)       → Sets activeConversationId
```

## API Calls

```
POST /api/conversations
Request: { providerId: string, title?: string }
Response: {
  id: string
  providerId: string
  title: string
  state: "active"
  createdAt: string
}
```

## Test Scenario

```typescript
test('M-005: User creates new conversation', async ({ page }) => {
  // Prerequisites: Provider connected (M-004)
  
  // Click "New Conversation"
  await page.click('[data-testid="create-conversation"]')
  
  // Modal appears
  await expect(page.locator('[data-testid="create-modal"]')).toBeVisible()
  
  // Select provider (pre-selected)
  await expect(page.locator('[data-testid="provider-select"]')).toHaveValue('claude')
  
  // Enter title
  await page.fill('[data-testid="conversation-title"]', 'My Test Chat')
  
  // Submit
  await page.click('[data-testid="create-submit"]')
  
  // Modal closes
  await expect(page.locator('[data-testid="create-modal"]')).not.toBeVisible()
  
  // New conversation appears in list
  await expect(page.locator('[data-testid="conversation-item"]')).toContainText('My Test Chat')
  
  // New conversation is selected
  await expect(page.locator('[data-testid="conversation-item"].active')).toContainText('My Test Chat')
})
```

## Gate Criteria

- [ ] "New Conversation" button renders
- [ ] Modal opens on click
- [ ] Provider dropdown shows connected providers
- [ ] Title input accepts text
- [ ] POST /api/conversations succeeds
- [ ] New conversation appears in list
- [ ] New conversation is auto-selected
- [ ] `bun run typecheck` passes

---

*This moment enables the core conversation loop.*
