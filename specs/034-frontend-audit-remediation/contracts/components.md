# Component Contracts: Frontend Audit Remediation

**Date**: 2026-07-21
**Spec**: `specs/034-frontend-audit-remediation/spec.md`

## Overview

This document defines the TypeScript interfaces for all new and modified components. These contracts serve as the source of truth for implementation and testing.

## New Component Contracts

### ChatHeader

Provider and model selection UI.

```typescript
// web/ui/src/components/chat/ChatHeader.tsx

interface ChatHeaderProps {
  /** Currently selected provider slug */
  provider: string;
  /** Currently selected model ID */
  model: string;
  /** Available provider options */
  providers: ProviderOption[];
  /** Callback when provider changes */
  onProviderChange: (provider: string) => void;
  /** Callback when model changes */
  onModelChange: (model: string) => void;
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
}

interface ChatHeaderReturn {
  JSX.Element;
}
```

### MessageList

Renders chat messages with streaming support.

```typescript
// web/ui/src/components/chat/MessageList.tsx

interface MessageListProps {
  /** Array of chat messages */
  messages: Message[];
  /** Current streaming text (partial response) */
  streamingText: string;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Ref for auto-scrolling to bottom */
  scrollRef: React.RefObject<HTMLDivElement>;
}

interface MessageListReturn {
  JSX.Element;
}
```

### ChatInput

Message composer with send button.

```typescript
// web/ui/src/components/chat/ChatInput.tsx

interface ChatInputProps {
  /** Callback when message is sent */
  onSend: (message: string) => void;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Whether the input is disabled */
  disabled: boolean;
  /** Placeholder text */
  placeholder?: string;
}

interface ChatInputReturn {
  JSX.Element;
}
```

## New Hook Contracts

### useChatState

Manages chat message state and streaming.

```typescript
// web/ui/src/hooks/useChatState.ts

interface UseChatStateOptions {
  /** Provider to use for messages */
  provider: string;
  /** Model to use for messages */
  model: string;
  /** Conversation ID for WebSocket routing */
  conversationId: string;
}

interface UseChatStateReturn {
  /** Array of chat messages */
  messages: Message[];
  /** Current streaming text (partial response) */
  streamingText: string;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Send a new message */
  sendMessage: (text: string) => Promise<void>;
  /** Clear all messages */
  clearMessages: () => void;
  /** Get message by ID */
  getMessage: (id: string) => Message | undefined;
}

function useChatState(options: UseChatStateOptions): UseChatStateReturn;
```

### useDrawerState

Manages drawer panel open/close state.

```typescript
// web/ui/src/hooks/useDrawerState.ts

interface UseDrawerStateReturn {
  /** Currently active drawer ID (null if none) */
  activeDrawer: string | null;
  /** Open a drawer by ID */
  openDrawer: (id: string) => void;
  /** Close the active drawer */
  closeDrawer: () => void;
  /** Go back in drawer history */
  goBack: () => void;
  /** Check if a specific drawer is open */
  isDrawerOpen: (id: string) => boolean;
}

function useDrawerState(): UseDrawerStateReturn;
```

## Modified Component Contracts

### UnifiedIOProvider (fix useMemo side effect)

```typescript
// web/ui/src/components/canvas/UnifiedIOProvider.tsx

// BEFORE (broken):
const memoizedConfig = useMemo(() => {
  // SIDE EFFECT: config initialization
  initializeConfig(baseUrl);
  return { baseUrl, timeout, retries };
}, [baseUrl]);

// AFTER (fixed):
const memoizedConfig = useMemo(() => ({
  baseUrl,
  timeout,
  retries,
  retryDelay,
  deduplicationWindow,
  enableTracing,
}), [baseUrl, timeout, retries, retryDelay, deduplicationWindow, enableTracing]);
```

### LivingCanvas (add React.memo)

```typescript
// web/ui/src/components/canvas/LivingCanvas.tsx

// BEFORE:
export function LivingCanvas(props: LivingCanvasProps) { ... }

// AFTER:
export const LivingCanvas = React.memo(function LivingCanvas(props: LivingCanvasProps) { ... });
```

### DrawerSystem (add React.memo + lazy loading)

```typescript
// web/ui/src/components/canvas/DrawerSystem.tsx

// Lazy-loaded panels
const LazyPanel1 = React.lazy(() => import('./panels/Panel1'));
const LazyPanel2 = React.lazy(() => import('./panels/Panel2'));
// ... etc

// React.memo wrapper
export const DrawerSystem = React.memo(function DrawerSystem(props: DrawerSystemProps) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      {activeDrawer === 'panel1' && <LazyPanel1 />}
      {activeDrawer === 'panel2' && <LazyPanel2 />}
      {/* ... */}
    </Suspense>
  );
});
```

## Error Boundary Contracts

### RouteLevelErrorBoundary

```typescript
// web/ui/src/components/ErrorBoundary.tsx

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RouteLevelErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState;
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
  render(): React.ReactNode;
}
```

### DrawerLevelErrorBoundary

```typescript
// web/ui/src/components/canvas/DrawerErrorBoundary.tsx

interface DrawerErrorBoundaryProps {
  drawerId: string;
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

class DrawerLevelErrorBoundary extends React.Component<DrawerErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState;
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
  render(): React.ReactNode;
}
```

## Validation Rules

- All component props MUST be typed (no `any`)
- All hook return values MUST be typed
- All error boundaries MUST implement `getDerivedStateFromError` and `componentDidCatch`
- All lazy-loaded components MUST have a Suspense fallback
- All memo-wrapped components MUST use `React.memo` (not `memo` from React)
