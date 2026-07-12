# M-006: Message Send

**Phase:** 100 (User-Centric Frontend)
**Depends:** 100.3 (Message Thread View), 100.4 (Message Send Composer)
**Status:** NOT STARTED

## User Story

> As a user, I want to type a message and send it to my AI provider.

## Moment Definition

**Entry State:** User types in message composer
**Exit State:** Message sent, appears in thread, loading state shown

## Visual State

```
┌─────────────────────────────────────────────────────┐
│ Vivim Sandbox                    [Claude ▾] [⚙]   │
├──────────┬──────────────────────────────────────────┤
│          │  Conversation: My Test Chat              │
│ Conversations     │  ────────────────────────────    │
│ ├ My Test Chat ✓ │                                  │
│ └ Chat 2         │  User: What is the capital       │
│                  │  of France?                       │
│                  │                                  │
│                  │  Claude: ▊ (thinking...)          │
│                  │                                  │
│                  ├──────────────────────────────────┤
│                  │ [Type your message...    ] [Send] │
└──────────┴──────────────────────────────────────────┘
```

## Component Spec

### MessageThread
```tsx
// web/sandbox/src/features/message-thread.tsx
interface MessageThreadProps {
  messages: Message[]
  loading: boolean
}

// Renders:
// - Scrollable list of MessageBubble components
// - Auto-scroll to bottom on new message
// - Loading indicator when waiting for response
```

### MessageComposer
```tsx
// web/sandbox/src/features/message-composer.tsx
interface MessageComposerProps {
  onSend: (message: string) => void
  disabled: boolean
}

// Renders:
// - Text input (auto-expanding textarea)
// - Send button (enabled when text present)
// - Enter to send, Shift+Enter for newline
```

### MessageBubble
```tsx
// web/sandbox/src/features/message-bubble.tsx
interface MessageBubbleProps {
  message: Message
}

// Renders:
// - Role label (User/Claude)
// - Message content (markdown rendered)
// - Timestamp
// - Status indicator (sent/delivered/error)
```

## Store Contract

```typescript
// web/sandbox/src/store/conversation-store.ts
interface ConversationState {
  messages: Message[]
  sending: boolean
  
  send: (conversationId: string, content: string) => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
  appendMessage: (message: Message) => void
}

// Actions:
// send()              → POST /api/conversations/:id/send
// loadMessages()      → GET /api/conversations/:id/messages
// appendMessage()     → Adds to messages array (from WS)
```

## API Calls

```
POST /api/conversations/:id/send
Request: { message: string }
Response: {
  messageId: string
  sentAt: string
}

GET /api/conversations/:id/messages
Request: ?limit=50&before=<messageId>
Response: ConversationMessageRow[]

WebSocket: conversation:complete
{
  type: "conversation:complete",
  conversationId: string,
  message: {
    id: string,
    role: "assistant",
    content: string,
    providerId: string
  }
}
```

## Test Scenario

```typescript
test('M-006: User sends message and sees it in thread', async ({ page }) => {
  // Prerequisites: Conversation created (M-005)
  
  // Type message
  const composer = page.locator('[data-testid="message-composer"]')
  await composer.fill('What is the capital of France?')
  
  // Send button enabled
  await expect(page.locator('[data-testid="send-button"]')).toBeEnabled()
  
  // Click send
  await page.click('[data-testid="send-button"]')
  
  // Message appears in thread
  await expect(page.locator('[data-testid="message-bubble"]').last()).toContainText(
    'What is the capital of France?'
  )
  
  // Composer cleared
  await expect(composer).toHaveValue('')
  
  // Loading state shown
  await expect(page.locator('[data-testid="response-loading"]')).toBeVisible()
  
  // Wait for response (within 10s)
  await expect(page.locator('[data-testid="message-bubble"]').last()).toContainText(
    'Paris',
    { timeout: 10000 }
  )
})
```

## Gate Criteria

- [ ] MessageComposer renders with input and send button
- [ ] Send button enables when text present
- [ ] Enter key sends message
- [ ] Message appears in thread immediately (optimistic)
- [ ] POST /api/conversations/:id/send succeeds
- [ ] Loading state shows while waiting
- [ ] Response appears via WebSocket
- [ ] Auto-scroll to bottom on new message
- [ ] `bun run typecheck` passes

---

*This moment is the core interaction loop.*
