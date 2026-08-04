# PRD #2: Chat UX Improvements

## Problem Statement

The chat interface (`ChatSurface.tsx`, `ChatSlotSurface.tsx`) is functional but lacks polish:
- Streaming text renders with a static `▍` cursor — no blinking animation
- `MessageBlock.tsx` exists but has no hover actions (copy/retry/edit)
- `StreamingIndicator.tsx` and `StreamingStatusBar.tsx` exist but no standalone typing indicator component
- Keyboard shortcuts: Enter/Shift+Enter wired in `TextEntryBox.tsx`, but **Ctrl+N for new conversation is missing**
- No message grouping — consecutive same-role messages have uniform `gap: 8` spacing
- No visual distinction between user/assistant/system messages beyond background color
- `ConversationSearch.tsx` exists for sidebar filtering, but no in-thread message search
- No role badges/icons — only color differentiates message roles

## Goals

1. **Streaming UX** — CSS `@keyframes blink` cursor animation during active stream
2. **Message actions** — copy, retry, edit on hover for each message block
3. **Keyboard shortcuts** — Enter to send (already wired), Shift+Enter for newline (already wired), Ctrl+N for new conversation (missing)
4. **Typing indicator** — standalone animated dots component with 500ms delay
5. **Message grouping** — consecutive messages from same role visually grouped with reduced spacing
6. **Role visual distinction** — badges/icons for user/assistant/system beyond color alone
7. **In-thread search** — search within current conversation messages (not just sidebar filter)

## Scope

| Area | Files | Action | Existing? |
|------|-------|--------|-----------|
| Streaming cursor | `globals.css`, `Composer.tsx` | Add `@keyframes blink`, replace static `▍` | ❌ New |
| Message actions | `MessageBlock.tsx` | Add hover action bar with copy/retry/edit buttons | ⚠️ Modify (file exists) |
| Copy utility | New `hooks/useCopyToClipboard.ts` | Clipboard API wrapper with toast feedback | ❌ New |
| Keyboard shortcuts | `page.tsx` | Add Ctrl+N handler to existing keyboard useEffect | ⚠️ Modify (handler exists) |
| Typing indicator | New `components/chat/TypingIndicator.tsx` | Animated dots, 500ms delay, configurable | ❌ New |
| Message grouping | `Composer.tsx` | Detect consecutive same-role, reduce gap, add role badge | ⚠️ Modify |
| Role badges | `Composer.tsx` | Small avatar/icon per role (user circle, assistant bolt) | ⚠️ Modify |
| In-thread search | `Composer.tsx` | Ctrl+F overlay to filter messages within current thread | ❌ New |
| Smooth text reveal | `Composer.tsx`, `globals.css` | CSS transition on streaming text opacity/transform | ⚠️ Modify |

## Non-Goals

- Voice input/output
- File attachments in chat (covered by Area 3 Canvas)
- Multi-model comparison view
- Inline message editing with backend persistence (requires API changes — separate PRD)

## Existing Code Assessment

| Component | Location | Status |
|-----------|----------|--------|
| `MessageBlock.tsx` | `components/chat/MessageBlock.tsx` | Exists — renders content blocks (text, code, thinking, tool-call, etc.) but NO hover actions |
| `StreamingIndicator.tsx` | `components/canvas/StreamingIndicator.tsx` | Exists — shows WS status badge + "Streaming..." dots as a status bar |
| `StreamingStatusBar.tsx` | `components/chat/addons/StreamingStatusBar.tsx` | Exists — red dot + "Streaming..." text with stop button (add-on) |
| `TextEntryBox.tsx` | `components/chat/TextEntryBox.tsx` | Exists — Enter sends, Shift+Enter newline already wired |
| `ConversationSearch.tsx` | `components/chat/ConversationSearch.tsx` | Exists — sidebar conversation filter only |
| `Composer.tsx` | `components/chat/Composer.tsx` | Exists — orchestrates streaming, renders messages, uses `RenderBlocks` |
| `ComposerShell.tsx` | `components/chat/ComposerShell.tsx` | Exists — manages draft, addons, send dispatch |
| `globals.css` | `app/globals.css` | Has `stream-pulse`, `fade-in-up`, `scale-in` — NO `blink` keyframe |

## Implementation Steps

### Step 1: Streaming cursor animation
Add `@keyframes blink` to `globals.css`. Update `Composer.tsx:243` to use animated cursor class instead of static `▍`.

### Step 2: Message actions — hover bar
Update `MessageBlock.tsx` to accept `onCopy`, `onRetry`, `onEdit` callbacks. Add `onMouseEnter`/`onMouseLeave` state to show/hide action bar. Actions: copy (clipboard API), retry (re-send), edit (placeholder — future).

### Step 3: Copy-to-clipboard utility
Create `hooks/useCopyToClipboard.ts` — wraps `navigator.clipboard.writeText`, returns `{ copied, copy }`. Show brief "Copied!" toast on success.

### Step 4: Typing indicator component
Create `components/chat/TypingIndicator.tsx` — three animated dots using CSS. Accept `delay` prop (default 500ms) to avoid flash on fast responses. Render in `Composer.tsx` between last message and streaming block.

### Step 5: Keyboard shortcuts
Add Ctrl+N handler to `page.tsx` existing `useEffect` keyboard listener. Trigger new conversation creation (same as empty state button).

### Step 6: Message grouping
Update `Composer.tsx` message render loop to detect consecutive same-role messages. Apply reduced `marginTop` (2px) for same-role, normal gap (8px) for role changes. Add subtle role badge (initials circle for user, bolt icon for assistant).

### Step 7: In-thread search
Add Ctrl+F handler in `Composer.tsx` that opens a small search overlay. Filter rendered messages by text match. Highlight matching text. Close on Escape or Ctrl+F again.

### Step 8: Smooth text reveal
Add CSS class `.streaming-reveal` with `opacity: 0 → 1` transition + `translateY(2px → 0)` for newly appended streaming blocks.

## Acceptance Criteria

- [ ] Streaming text shows blinking cursor (`@keyframes blink`) during active stream
- [ ] Hovering a message reveals copy/retry/edit action bar
- [ ] Copy button copies message content to clipboard with toast feedback
- [ ] Enter sends, Shift+Enter creates newline (existing — verify no regression)
- [ ] Ctrl+N creates new conversation
- [ ] Typing indicator (animated dots) appears within 500ms of stream start
- [ ] Consecutive assistant messages have reduced gap (2px vs 8px)
- [ ] Each message shows role badge (user circle / assistant bolt)
- [ ] Ctrl+F opens in-thread search, Escape closes
- [ ] Streaming text has smooth opacity transition on new chunks
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

## Priority

**P0** — Core user-facing experience. Must complete before Areas 3–10.

## Estimated Effort

~5–6 hours. Component modifications + new utilities + CSS animations + keyboard wiring.
