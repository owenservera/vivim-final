# Data Model: Frontend Audit Remediation

**Date**: 2026-07-21
**Spec**: `specs/034-frontend-audit-remediation/spec.md`

## Overview

No new database models required. This is a frontend-only remediation. The data model describes client-side state structures.

## Client-Side State

### Message

Represents a single chat message in the conversation.

```typescript
interface Message {
  id: string;                    // ULID
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;             // Unix ms
  provider?: string;             // e.g., 'chatgpt', 'claude', 'gemini'
  model?: string;                // e.g., 'gpt-4', 'claude-3-opus'
  streaming?: boolean;           // true while response is streaming
  error?: string;                // error message if response failed
  metadata?: Record<string, unknown>;  // provider-specific metadata
}
```

### ChatState

Zustand store for chat message management.

```typescript
interface ChatState {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  selectedProvider: string;
  selectedModel: string;
  
  // Actions
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  setProvider: (provider: string) => void;
  setModel: (model: string) => void;
  appendStreamingText: (text: string) => void;
  setStreamingComplete: (message: Message) => void;
}
```

### DrawerState

Zustand store for drawer panel management.

```typescript
interface DrawerState {
  activeDrawer: string | null;
  drawerHistory: string[];
  
  // Actions
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  goBack: () => void;
  isDrawerOpen: (id: string) => boolean;
}
```

### UnifiedIOConfig

Configuration for the UnifiedIO API layer.

```typescript
interface UnifiedIOConfig {
  baseUrl: string;               // NEXT_PUBLIC_API_URL
  timeout: number;               // ms, default 30000
  retries: number;               // default 3
  retryDelay: number;            // ms, default 1000
  deduplicationWindow: number;   // ms, default 5000
  enableTracing: boolean;        // default true
}
```

### ProviderOption

Provider selection UI state.

```typescript
interface ProviderOption {
  slug: string;                  // e.g., 'chatgpt'
  name: string;                  // e.g., 'ChatGPT'
  models: ModelOption[];
  enabled: boolean;
}

interface ModelOption {
  id: string;                    // e.g., 'gpt-4'
  name: string;                  // e.g., 'GPT-4'
  description: string;
  maxTokens: number;
}
```

### ComponentRegistration

UniversalComponentRegistry entry.

```typescript
interface ComponentRegistration {
  id: string;                    // e.g., 'canvas.living-canvas'
  component: React.ComponentType<any>;
  category: string;              // e.g., 'canvas', 'chat', 'drawer'
  priority: number;              // lower = higher priority
  lazy?: boolean;                // true = React.lazy loaded
  fallback?: React.ComponentType; // loading state
}
```

### WebSocketMessage

Real-time message from backend WebSocket.

```typescript
interface WebSocketMessage {
  type: 'text' | 'tool_call' | 'error' | 'done';
  payload: {
    text?: string;
    tool?: string;
    args?: Record<string, unknown>;
    error?: string;
  };
  conversationId: string;
  messageId?: string;
  timestamp: number;
}
```

## State Relationships

```text
ChatState
├── messages: Message[]
├── selectedProvider → ProviderOption.slug
└── selectedModel → ModelOption.id

DrawerState
└── activeDrawer → ComponentRegistration.id

UnifiedIOConfig
└── baseUrl → NEXT_PUBLIC_API_URL env var

ComponentRegistration
└── component → React.ComponentType
```

## State Transitions

### Message Lifecycle

```text
[User types message]
  → sendMessage() called
  → Message added to ChatState.messages with streaming: true
  → WebSocket connection established
  → Streaming text appended via appendStreamingText()
  → Streaming complete → setStreamingComplete()
  → Message updated with streaming: false
```

### Drawer Lifecycle

```text
[User clicks drawer trigger]
  → openDrawer(id) called
  → activeDrawer set to id
  → drawerHistory pushed
  → Lazy component loaded via React.lazy
  → Suspense resolves, panel renders

[User clicks close]
  → closeDrawer() called
  → activeDrawer set to null
  → Component remains in DOM (optional: unmount for memory)
```

### API Request Lifecycle

```text
[Component calls useUnifiedIO().fetch()]
  → Request deduplicated if within window
  → Request sent with timeout
  → Retries on failure (up to 3 times)
  → Trace recorded if enabled
  → Response returned to component
```

## Validation Rules

- Message.content MUST NOT be empty
- Message.id MUST be valid ULID
- UnifiedIOConfig.baseUrl MUST be valid URL
- DrawerState.activeDrawer MUST be valid ComponentRegistration.id or null
- ProviderOption.slug MUST match pattern: `^[a-z][a-z0-9-]*$`
