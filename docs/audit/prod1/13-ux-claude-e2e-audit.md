# Production UX Audit: Area 13 — Claude E2E User Experience & ProseMirror Rich Text Integration
**Provider Target:** `claude` (Anthropic Claude UI)
**Frontend Subsystem:** `frontend/src/`, `frontend/src/canvas/`, Provider UI Slots
**Audit Focus:** End-to-End User Experience, ProseMirror Typing, Reasoning/Thinking Blocks & Artifact Rendering

---

## 1. Executive Summary & User Experience Goal
The Claude provider integration manages interactions with Claude (`claude.ai`) via Chrome slave, SSE block parsing, and artifact mounting into the Vivim frontend (`frontend/`).
- **Target User Experience:**
  1. **ProseMirror Composer Integration:** Precise message insertion into `div[contenteditable="true"]` (ProseMirror rich-text editor).
  2. **Thinking / Extended Reasoning Collapsible UI:** Special UI display for Claude's thinking blocks (`content_block_start` with `type: thinking`), allowing users to expand/collapse raw reasoning logs.
  3. **Artifact Mounting Canvas:** Side-by-side split screen canvas mounting for generated artifacts (code snippets, interactive SVG diagrams, HTML previews).
  4. **Model Selection Switching:** Toggling between Claude 3.5 Sonnet, Claude 3 Opus, and Claude 3 Haiku directly from the Vivim top control bar.

---

## 2. Actual Code & UX Scan Findings

### 🟢 Finding 13.1: SSE Stream Parser Accuracy
- **Actual Code Evidence:**
  - `seeds/parsers/harvested/claude-streaming-sse.ts` correctly parses Anthropic SSE events (`content_block_start`, `content_block_delta`, `content_block_stop`) with confidence = 1.0.

### 🟡 Finding 13.2: Thinking Block UI Collapse State
- **UX Issue:** When Claude streams extended thinking/reasoning blocks, large uncollapsed blocks can push actual message content below the fold.
- **Actual Frontend Behavior:** `frontend/` requires default collapsed state for `thinking` content blocks to keep assistant response text in view.

---

## 3. Automated UX Verification & E2E Testing Protocol

Future auditing agents must run the following end-to-end UX test steps:

```bash
# Step 1: Check Claude provider status & profile authentication
bun run devops runtime-test status --provider=claude

# Step 2: Test live Claude selectors against DOM
bun run devops runtime-test onboard test-selectors --provider=claude

# Step 3: Verify Claude stream parser unit tests
bun test tests/unit/engines/harvested-parser.test.ts
```

---

## 4. Remediation & Convergence Checklist
- [ ] Ensure thinking blocks are rendered in a distinct collapsible Accordion widget in `frontend/src/components/`.
- [ ] Add side-by-side artifact preview mounting when Claude returns multi-file output.
