# Senior Frontend Review — Stage 2: Engines, State Management & SDK Integration

**Status:** Complete & Actionable  
**Target Components:** `src/engines/`, `src/sdk/web/use-conversation.ts`, `src/components/canvas/SessionStateProvider.tsx`, `next.config.mjs`

---

## 1. Overview & Findings

Stage 2 audits the 30 frontend domain engines, state management hydration lifecycle (Zustand & React Context), and SDK data fetching hooks.

### Key Flaws Identified:
1. **Unbounded Retries and Missing Timeout Safeguards in SDK Hooks (`src/sdk/web/use-conversation.ts`):**
   Calls to `io.get('/api/conversations')` can block indefinitely if the backend proxy times out or fails to respond, leaving components in perpetual `loading: true` state.
2. **Local Route Shadowing vs Proxy Ambiguity:**
   Next.js static export mode (`TAURI_STATIC_EXPORT=1`) disables rewrites defined in `next.config.mjs`, routing `/api/*` calls to Next.js route handlers in `src/app/api/`. In standalone mode, rewrites proxy these calls to `http://localhost:9420`. The SDK must fall back cleanly when the backend is unreachable.
3. **SessionState Hydration Mismatch:**
   Local storage state synchronization during initial SSR render causes hydration mismatch warnings on browser refresh.

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/sdk/web/use-conversation.ts` — Abort Signal & Timeout Enforcement

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/sdk/web/use-conversation.ts`  
**Target Lines:** 24–47

#### Target Code to Replace:
```typescript
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await io.get<ConversationDetail[]>('/api/conversations', {
        responseSchema: ConversationArraySchema,
      })
      if (!mountedRef.current) return
      // Backend returns ConversationDetail[] (array directly) — transform to domain models
      const raw = res.data
      setConversations(
        Array.isArray(raw)
          ? raw.map(transformConversation)
          : ((raw as { conversations?: ConversationDetail[] }).conversations ?? []).map(
              transformConversation,
            ),
      )
    } catch (e) {
      if (!mountedRef.current) return
      setError(e instanceof Error ? e.message : 'Failed to load conversations')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [io])
```

#### Replacement Code (Verbatim):
```typescript
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await io.get<ConversationDetail[]>('/api/conversations', {
        responseSchema: ConversationArraySchema,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!mountedRef.current) return
      const raw = res.data
      setConversations(
        Array.isArray(raw)
          ? raw.map(transformConversation)
          : ((raw as { conversations?: ConversationDetail[] }).conversations ?? []).map(
              transformConversation,
            ),
      )
    } catch (e) {
      clearTimeout(timer)
      if (!mountedRef.current) return
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Conversation request timed out after 8s')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load conversations')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [io])
```

---

### Fix 2: `src/engines/index.ts` — Engine Initialization Safety Guard

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/engines/index.ts`  
**Target Action:** Add defensive error boundaries around engine instantiation to prevent window load crashes when a single engine fails to seed.

---

## 3. Stage 2 Verification Protocol

```bash
# 1. Run unit tests for SDK hooks
bun test tests/unit/use-conversation.test.ts

# 2. Run engine integration tests
bun test tests/integration/
```
