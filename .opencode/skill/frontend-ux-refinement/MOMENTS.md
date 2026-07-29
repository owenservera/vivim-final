# User Moments Catalog

Every user interaction is a "moment." Each moment must be defined, wired, tested, verified, and recorded.

---

## Moment Definition Schema

```yaml
moment:
  id: <category>_<action>_<surface>
  category: entry | data-flow | state | error | visual | completion
  surfaces: [cli, api, mcp, ui]
  slot: <slot_id>          # which slot resolves this
  capability: <slug>       # backend capability slug
  entry_point: <how user reaches this>
  action: <what user does>
  expected_outcome: <what user sees/gets>
  error_case: <what goes wrong>
  test_level: code | visual | both
```

---

## Category 1: Entry Points

### 1.1 Application Boot

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `boot_backend` | `bun run dev` | Server starts | `/api/health` returns 200 | Port conflict, DB unreachable | code |
| `boot_frontend` | `bun run dev` | Vite dev server starts | `http://localhost:3000` loads | Build error, missing deps | code |
| `boot_chrome` | `bun run devops runtime-test engage` | Chrome slave launches | Browser navigates to provider | Profile missing, auth expired | visual |
| `boot_slot_registry` | App mount | `registerDefaults()` runs | All slots resolve to components | Missing slot definition, import error | code |

### 1.2 Provider Selection

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `select_provider_header` | Click provider in header | Provider switches | ChatPage re-renders with new provider context | Provider not registered | both |
| `select_provider_sidebar` | Click provider in sidebar | Active provider changes | Sidebar highlights, composer updates | No accounts for provider | both |
| `select_provider_nl` | "switch to gemini" | NL resolves provider | Provider context updates, UI reflects | Ambiguous NL, provider offline | code |

### 1.3 Conversation Management

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `new_conversation` | Click "New Chat" slot | Conversation created | Empty thread, ready for input | API error, provider session invalid | both |
| `select_conversation` | Click conversation in sidebar | Messages load | Thread populates with history | Conversation not found, network error | both |
| `rename_conversation` | Edit title in sidebar | Title updates | Sidebar shows new title | Permission denied, not found | code |
| `delete_conversation` | Click delete | Confirmation dialog | Dialog appears, confirm deletes | No confirm, API error | both |

---

## Category 2: Data Flow

### 2.1 Message Send

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `send_text` | Click send button / Enter | Message sent | User message appears in thread, streaming begins | Network error, provider offline, rate limit | both |
| `send_with_attachment` | Click attach + send | File uploaded + message sent | Attachment renders in bubble, message streams | File too large, unsupported type | both |
| `send_empty` | Click send with no input | Nothing happens | Send button disabled or no-op | N/A | code |
| `send_long_message` | Paste 10K chars | Message sent | Full text renders, no truncation | Provider char limit | code |

### 2.2 Message Receive (Streaming)

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `receive_streaming_text` | Backend streams response | Progressive render | Text appears word-by-word in `chat.streaming` slot | Parse failure, network drop | visual |
| `receive_streaming_blocks` | Backend sends ContentBlock[] | Block rendering | Each block renders in `chat.result` slot | Unknown block type, malformed JSON | both |
| `receive_tool_call` | Backend sends tool_call block | Tool UI renders | Tool call shows args + result | Tool not registered, timeout | both |
| `receive_reasoning` | Backend sends reasoning block | Collapsed reasoning | Thinking block visible but collapsed | Parse error | visual |
| `receive_file` | Backend sends file block | File preview renders | Image/link/file card displays | Unsupported file type | both |
| `stream_complete` | `[DONE]` or completion signal | Streaming stops | Spinner disappears, message finalized | Timeout, incomplete parse | both |
| `stream_error` | Network drop mid-stream | Error handling | Partial content preserved, error shown | Silent failure | both |

### 2.3 Conversation History

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `load_history` | Open conversation | Messages fetched | Thread populates with past messages | Network error, empty conversation | code |
| `load_more_history` | Scroll to top | Older messages loaded | Pagination works, scroll position preserved | No more messages, API error | both |
| `history_stream_blocks` | Open conversation with blocks | Block content loaded | `chat.result` renders historical blocks | Block data corrupted | both |

---

## Category 3: State Transitions

### 3.1 Authentication

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `login_check` | App boot | Check auth state | Auth status displayed in header | Session expired | code |
| `login_provider` | First use of provider | Chrome profile restored | Provider marked as authenticated | Profile not found, cookies expired | visual |
| `session_expiry` | Provider call fails | Detect expired session | Auth warning shown, relogin suggested | Silent failure | both |
| `relogin_flow` | User confirms relogin | Chrome relogin executed | Provider re-authenticated | Login failed, user aborted | visual |

### 3.2 Provider Status

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `provider_online` | Preflight check | Provider available | Green status indicator | Provider down | code |
| `provider_offline` | Preflight check | Provider unavailable | Red status, send disabled | False positive | code |
| `provider_switching` | Change provider | Transition state | Loading indicator, then new provider | Timeout, partial state | both |

### 3.3 Capability State

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `capability_loading` | Trigger capability | Loading state | Spinner or progress in slot | Stuck loading | visual |
| `capability_success` | Capability completes | Success state | Result rendered, status updated | Silent success | both |
| `capability_error` | Capability fails | Error state | Error message in `chat.error` slot | Error swallowed | both |
| `capability_retry` | User clicks retry | Re-execution | Capability runs again | Infinite retry loop | both |

---

## Category 4: Error Handling

### 4.1 Network Errors

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `network_timeout` | Fetch times out | Timeout error | "Request timed out" message with retry option | Silent hang | code |
| `network_offline` | No connectivity | Offline detection | "You are offline" banner | False online | code |
| `network_partial` | Connection drops mid-stream | Partial content | Partial text preserved, error shown | Data loss | both |

### 4.2 Parse Errors

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `parse_invalid_json` | Malformed response | Parse error | Fallback to raw text, error logged | Crash | code |
| `parse_unknown_block` | Unknown ContentBlock type | Block skipped | Other blocks render, unknown ignored | Silent skip | code |
| `parse_incomplete` | Truncated stream | Incomplete data | Partial render, retry option | Stuck state | both |

### 4.3 Provider Errors

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `provider_rate_limit` | Too many requests | Rate limit message | "Slow down" with backoff timer | Infinite retry | code |
| `provider_auth_fail` | Invalid credentials | Auth error | "Session expired" + relogin prompt | Silent failure | both |
| `provider_unavailable` | Provider down | Unavailable message | "Provider unavailable" + fallback option | Confusing error | code |

### 4.4 UI Errors

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `slot_resolution_fail` | Slot not found | Fallback renders | Unknown slot shows placeholder | Blank area | code |
| `component_crash` | React error boundary | Error boundary catches | Fallback UI with retry | White screen | both |
| `hot_swap_conflict` | Two overrides for same slot | Last wins | Most specific override applied | Random order | code |

---

## Category 5: Visual Feedback

### 5.1 Loading States

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `loading_spinner` | Any async operation | Spinner visible | Animated spinner in correct position | No feedback | visual |
| `loading_skeleton` | Data loading | Skeleton renders | Placeholder matches content shape | Layout shift | visual |
| `loading_progress` | Known-duration operation | Progress bar | Percentage or steps shown | Stuck at 0% | visual |

### 5.2 Streaming Visual

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `stream_cursor` | Text streaming | Blinking cursor | Cursor at end of streaming text | No cursor | visual |
| `stream_word_by_word` | Progressive render | Words appear | Natural reading pace, no jank | All-at-once, janky | visual |
| `stream_block_separator` | Multiple blocks | Visual separation | Blocks separated with spacing/dividers | Run-together | visual |

### 5.3 Transitions

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `provider_switch_transition` | Change provider | Smooth transition | Fade/slide between provider contexts | Flash of wrong content | visual |
| `conversation_switch` | Change conversation | Thread transition | Messages swap with transition | Old messages flash | visual |
| `sidebar_collapse` | Toggle sidebar | Animation | Smooth collapse/expand | Janky animation | visual |

### 5.4 Empty States

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `empty_thread` | New conversation | Welcome message | "Start a conversation" prompt | Blank screen | visual |
| `empty_provider` | No provider selected | Selection prompt | "Select a provider" guidance | Confusing blank | visual |
| `empty_search` | No results | No-results state | "No conversations found" message | Infinite loading | visual |

---

## Category 6: Completion

### 6.1 Message Delivered

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `message_sent` | Send completes | User message final | Message bubble renders with timestamp | Missing timestamp | both |
| `message_delivered` | Provider confirms | Delivery status | Checkmark or status indicator | Stuck in "sending" | both |

### 6.2 Capability Complete

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `capability_result` | Execution finishes | Result rendered | `chat.result` slot shows output | No result shown | both |
| `capability_status` | Status update | Badge updates | Status badge reflects completion | Stale status | code |

### 6.3 Cross-Surface Confirmation

| Moment | Entry | Action | Expected | Error | Test |
|--------|-------|--------|----------|-------|------|
| `cli_api_match` | CLI + API test | Same result | Both surfaces return identical data | Parity gap | code |
| `ui_api_match` | UI + API test | Same data rendered | UI displays what API returns | UI shows stale data | both |
| `mcp_api_match` | MCP + API test | Same result | MCP tool returns same as API | Different responses | code |

---

## Testing Strategy Per Moment

### Code-First (No Browser)

Use for: API contracts, slot resolution, type safety, database state, error handling logic.

```bash
# Quick verification suite
bun run devops runtime-test health
bun run devops runtime-test test --nl="<goal>"
bun run devops runtime-test test-cap --slug=<slug>
bun run devops verify-cross-surface
```

### Browser-Visual (Playwright MCP)

Use for: Visual proof, DOM assertions, streaming behavior, layout, accessibility.

```
1. playwright_browser_navigate → http://localhost:5173
2. playwright_browser_snapshot → accessibility tree
3. playwright_browser_find → locate elements
4. playwright_browser_take_screenshot → visual proof
5. playwright_browser_console_messages → error check
```

### Hybrid (Both)

Use for: Full user journeys, critical paths, shipping gates.

1. Code-test first (fast, deterministic)
2. Browser-test after (visual proof)
3. Record in UI test registry

---

## Moment Priority Matrix

| Priority | Category | Rationale |
|----------|----------|-----------|
| P0 | Entry (boot, provider select) | If broken, nothing works |
| P0 | Data flow (send, stream) | Core user value |
| P0 | Error handling (network, parse) | Data loss / confusion |
| P1 | State transitions (auth, status) | Blocks functionality |
| P1 | Completion (delivery, result) | User confidence |
| P2 | Visual feedback (loading, transitions) | Polish, not blocking |
| P2 | Empty states | First impression |
| P3 | Animations, transitions | Delight, not required |
