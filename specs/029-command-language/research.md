# Research: Command Language (Enhanced)

**Feature**: `029-command-language`
**Date**: 2026-07-19
**Status**: Complete

## Unknowns Resolved

### 1. NLP Matching Strategy

**Decision**: Local fuzzy matching against `CommandDescription` patterns, no external API calls.

**Rationale**: The command set is finite (~200 commands, ~600 patterns). A local trie + Levenshtein distance matcher is sufficient for sub-200ms latency. External NLP APIs add latency, cost, and privacy concerns. The pattern set is small enough that a simple fuzzy matcher with category pre-filtering achieves ≥85% accuracy.

**Alternatives Considered**:
- External NLP API (OpenAI, Claude): Rejected — adds 500ms+ latency, costs per query, requires network
- Local ML model (ONNX): Rejected — overkill for 200 commands, adds binary dependency
- Keyword extraction + TF-IDF: Rejected — pattern matching is simpler and more predictable

### 2. Combo Detection Algorithm

**Decision**: Dependency graph analysis between command categories. Commands are nodes, data dependencies are edges. Topological sort determines execution order.

**Rationale**: Multi-command combos follow predictable patterns: "save this then tag it" (sequential — tag depends on save output), "check health and list providers" (parallel — independent). A simple dependency graph between command categories (memory → tag is sequential, system → system is parallel) covers 80%+ of real-world combos.

**Alternatives Considered**:
- LLM-based decomposition: Rejected — adds latency, non-deterministic
- Rule-based pattern matching: Considered as fallback for ambiguous cases
- User confirmation for all combos: Rejected — too much friction

### 3. Color System Implementation

**Decision**: HSL color space with pre-defined primary hues per category. Shades derived by adjusting lightness (+20% for light, -15% for dark).

**Rationale**: HSL is perceptually uniform — adjusting lightness produces visually consistent shades. Pre-defined primaries ensure WCAG AA contrast compliance (verified against white and dark backgrounds). Dynamic shade generation avoids maintaining 36 static color values.

**Alternatives Considered**:
- Tailwind CSS color palette: Rejected — not all categories map cleanly to Tailwind
- CSS custom properties with lightness manipulation: Considered, but HSL in TypeScript is more portable
- Fixed 36-color palette: Rejected — harder to maintain and extend

### 4. Interpretation Rendering Position

**Decision**: Configurable via `InterpretationConfig.position` — defaults to `'above'` the prompt box.

**Rationale**: Different users prefer different positions. Above is conventional (status bar pattern). Below avoids遮挡 input. Floating allows cursor-proximate display. Inline fades as placeholder text. Making it configurable via a slot system allows runtime changes without code modification.

**Alternatives Considered**:
- Fixed above only: Rejected — no flexibility
- Always floating: Rejected — can遮挡 other UI elements
- Browser extension injection: Rejected — not applicable to web app

### 5. CommandDescription Seed Source

**Decision**: Seed from 4 sources: (1) existing NLCL catalog patterns, (2) new prefix commands, (3) CLI builtins, (4) raw engine operations.

**Rationale**: The NLCL catalog already has 1483 lines of pattern definitions. The new prefix commands add 27 slash + 6 mention + 3 tag + 15 devops + 5 context-ref + 1 capability + 5 discovery = 62 commands. CLI builtins add 2 (automate, moments). Raw engine operations add ~30 (conversation CRUD, provider management, canvas ops, etc.). Total: ~200 commands, ~600 patterns.

**Alternatives Considered**:
- Manual entry only: Rejected — too time-consuming
- Auto-generate from code: Rejected — code doesn't have consumer-friendly descriptions
- Import from external system: Rejected — no external system exists

### 6. MRU Persistence Strategy

**Decision**: In-memory LRU cache (1000 entries) with periodic flush to `Session` model JSON field.

**Rationale**: MRU data is session-scoped and read-heavy. In-memory LRU gives O(1) reads. Periodic flush (every 5 minutes or on session end) avoids constant DB writes. The `Session` model already has a JSON field for session metadata — appending `recentCommands` to it avoids a new table.

**Alternatives Considered**:
- Dedicated `CommandMRU` table: Rejected — overkill for session-scoped data
- localStorage only: Rejected — not shared across CLI/API/UI surfaces
- No persistence: Rejected — MRU loses value across sessions

## Best Practices Identified

### Prefix Command Design
- Keep prefix commands short (1-2 words max after prefix)
- Use verb-noun pattern: `/send email`, `!check health`
- Avoid abbreviations except for common ones: `/new`, `/list`, `/help`

### NLP Pattern Writing
- Use natural phrases: "switch to claude", "create a new conversation"
- Include 3-5 patterns per command for good coverage
- Avoid technical jargon in patterns — consumer-friendly language

### Color Accessibility
- Test all shades against both light (#FFFFFF) and dark (#1A1A1A) backgrounds
- Ensure ≥4.5:1 contrast ratio for text, ≥3:1 for large text
- Provide high-contrast mode fallback for users with color vision deficiency

### Combo Detection
- Default to sequential if unsure — safer than parallel
- Show confirmation for destructive combos (delete + delete)
- Allow user to reorder steps via arrow keys before execution
