# Feature Specification: Command Language (Enhanced)

**Feature Branch**: `029-command-language`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Design a comprehensive command language that merges agentic coding conventions and traditional messaging/social media conventions. Minimize user time-to-action. Add NLP layer with DB-backed descriptions, color-coded prompt box, progressive live interpretation, and multi-command combo detection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prefix-Based Command Routing (Priority: P1)

As a power user, I want to type a single prefix character (`/`, `@`, `#`, `!`, `~`, `$`, `?`) and get instant deterministic command resolution — no NLP latency, no ambiguity. This is the foundation of the entire command surface.

**Why this priority**: Every other user story depends on the parser/resolver infrastructure. Without it, no prefix commands work. This is the blocking MVP.

**Independent Test**: Can be tested by typing `/health` in the composer and verifying the system health response returns within 100ms. Delivers the core routing layer.

**Acceptance Scenarios**:

1. **Given** the user types `/health` in the composer, **When** they press Enter, **Then** the system health response is returned without any NLCL fallback
2. **Given** the user types `@claude explain recursion`, **When** they press Enter, **Then** the prompt is routed to the Claude provider and a response streams back
3. **Given** the user types `!fleet`, **When** they press Enter, **Then** the Chrome fleet status is displayed
4. **Given** the user types `#important`, **When** they press Enter, **Then** the current conversation is tagged "important"
5. **Given** the user types `~last /save`, **When** they press Enter, **Then** the last AI response is saved as a flashcard
6. **Given** the user types a plain text query with no prefix, **When** the parser completes, **Then** it falls through to the NLCL catalog for natural language resolution
7. **Given** the user types `/sw`, **When** the autocomplete fires, **Then** `/switch` appears as the top match with score >= 0.9

---

### User Story 2 - Command Palette with Autocomplete (Priority: P1)

As a user, I want a command palette (⌘K) that opens instantly, shows all available commands grouped by prefix/category, and supports fuzzy search with MRU ranking. Inline autocomplete should appear as I type prefix characters in the composer.

**Why this priority**: The palette is the discoverability surface. Without it, users can't learn the prefix system. Ships alongside P1 parser because both are foundational UX.

**Independent Test**: Can be tested by pressing ⌘K, typing "health", and verifying `!health` appears as the top result. Delivers discoverability + execution.

**Acceptance Scenarios**:

1. **Given** the user presses ⌘K, **When** the palette opens, **Then** all commands are listed grouped by prefix (`/`, `@`, `#`, `!`, `~`, `$`)
2. **Given** the palette is open, **When** the user types "send", **Then** `/send` and `@email` appear as top matches
3. **Given** the user types `/` in the composer, **When** the inline menu appears, **Then** slash commands are listed with icons and descriptions
4. **Given** the user has used `/health` 5 times recently, **When** the palette opens, **Then** `/health` is boosted to the top of results
5. **Given** the user presses `?` in the palette, **When** the cheat sheet renders, **Then** all commands are shown grouped by category with keyboard shortcuts

---

### User Story 3 - Context-Aware Command Execution (Priority: P2)

As a user, I want commands to be context-aware: when I have an active conversation, `~last` references the last AI response; when I have due flashcards, `/review` is boosted; when Gmail is connected, `/send` pre-fills my email.

**Why this priority**: Context awareness is what makes the command language feel intelligent rather than mechanical. Depends on P1 infrastructure.

**Independent Test**: Can be tested by sending a message to Claude, then typing `~last /save` and verifying the flashcard contains the AI response text. Delivers the "use AI output" workflow.

**Acceptance Scenarios**:

1. **Given** the last AI response exists, **When** the user types `~last`, **Then** the reference resolves to the full response text
2. **Given** `dueMemoryCount > 0`, **When** the palette opens, **Then** `/review` is boosted above other commands
3. **Given** an active conversation exists, **When** the user types `#important`, **Then** the tag is applied to the active conversation
4. **Given** Gmail accounts are connected, **When** the user types `/send`, **Then** the `to` field suggests recent contacts

---

### User Story 4 - DevOps & System Surface (Priority: P2)

As a developer/operator, I want `!`-prefixed commands to expose system-level operations: health checks, fleet status, capability listing, invariant checks, and audit commands. These should work from the same composer as chat commands.

**Why this priority**: The `!` surface is the developer's fast path. Depends on P1 parser + capability binding.

**Independent Test**: Can be tested by typing `!caps` and verifying the full capability list is returned. Delivers operator visibility.

**Acceptance Scenarios**:

1. **Given** the user types `!health`, **When** they press Enter, **Then** a formatted health summary is returned (providers, engines, uptime)
2. **Given** the user types `!invariants`, **When** they press Enter, **Then** invariant check results are displayed
3. **Given** the user types `!deploy`, **When** they press Enter, **Then** the production-build workflow is triggered (with confirmation)
4. **Given** the user types `!trace export`, **When** they press Enter, **Then** trace data is exported

---

### User Story 5 - Provider Mentions & Routing (Priority: P2)

As a multi-provider user, I want `@<provider>` mentions to route prompts directly to a specific provider without switching conversations. This is the "chat with Claude while using Gemini" pattern.

**Why this priority**: Provider mentions are a core differentiator. Depends on P1 parser + provider system.

**Independent Test**: Can be tested by typing `@gemini what is rust?` and verifying the response comes from Gemini. Delivers multi-provider fluency.

**Acceptance Scenarios**:

1. **Given** the user types `@claude explain recursion`, **When** they press Enter, **Then** the prompt is sent to Claude and the response streams back
2. **Given** the user types `@chatgpt summarize this`, **When** they press Enter, **Then** the prompt is sent to ChatGPT
3. **Given** an invalid provider slug, **When** the user types `@invalid do something`, **Then** an error toast shows "Unknown provider: invalid"
4. **Given** a provider is disconnected, **When** the user types `@deepseek ask something**, **Then** a warning shows "Provider deepseek is not connected"

---

### User Story 6 - Capability Direct Invoke (Priority: P3)

As a developer, I want `$cap:<id>` syntax to invoke capabilities directly with named arguments, bypassing NLP and prefix routing. This is the power-user escape hatch for scripting and automation.

**Why this priority**: Low-traffic but critical for automation workflows. Depends on P1 infrastructure.

**Independent Test**: Can be tested by typing `$cap:system:health` and verifying the raw capability response. Delivers scriptability.

**Acceptance Scenarios**:

1. **Given** the user types `$cap:system:health`, **When** they press Enter, **Then** the raw capability response is returned
2. **Given** the user types `$cap:memory:create --content "hello" --category test`, **When** they press Enter, **Then** a flashcard is created with the specified content
3. **Given** an invalid capability ID, **When** the user types `$cap:nonexistent:foo`, **Then** an error shows "Unknown capability: nonexistent:foo"

---

### User Story 7 - NLP Intent Detection & Live Interpretation (Priority: P1)

As a user, I want the prompt box to silently detect my intent as I type — with or without explicit prefixes — and show a live, progressive interpretation of what will happen when I press Enter. The prompt box color should change to indicate the detected command category.

**Why this priority**: This is the core UX innovation. It makes the command language invisible to casual users while giving power users instant feedback. Ships alongside P1 because it's the primary interaction model.

**Independent Test**: Can be tested by typing "help me switch to claude and ask about rust" and verifying the interpretation shows "Switch to Claude → Ask: explain recursion" with appropriate colors.

**Acceptance Scenarios**:

1. **Given** the user types `@claude explain recursion`, **When** the interpretation renders, **Then** the prompt box border turns Violet (LLM category), and the interpretation shows "Send to Claude · Prompt: explain recursion"
2. **Given** the user types `help me switch to claude and ask about rust`, **When** the interpretation renders, **Then** the prompt box shows a blended color (Session blue → LLM violet), and the interpretation reads "Switch to Claude, then ask about rust"
3. **Given** the user types plain text with no detectable command intent, **When** the interpretation renders, **Then** the prompt box remains neutral (default color) and no interpretation is shown
4. **Given** the user types a combo `!health and list my conversations`, **When** the interpretation renders, **Then** both commands are shown as color-separated steps: 🔴 Health check → 🔵 List conversations
5. **Given** the user presses Enter on a multi-command combo, **When** execution begins, **Then** the interpretation transitions to a horizontal progress bar with color-separated segments, and the user can arrow-key navigate between steps
6. **Given** the user types `/send` and the interpretation shows "Send email", **When** they keep typing `boss@co.io`, **Then** the interpretation progressively expands to "Send email to boss@co.io"
7. **Given** the interpretation is visible, **When** the user presses Escape, **Then** the interpretation dismisses and the prompt box returns to neutral

---

### User Story 8 - Full Engine Command Surface (Priority: P2)

As a user, I want every operation any engine can do — conversation CRUD, provider management, memory operations, canvas commands, channel operations, session management, workflow triggers, and devops automation — accessible from the same prompt box, with NLP descriptions that make them discoverable without reading docs.

**Why this priority**: This makes the entire vivim system accessible through one surface. Depends on P1 parser + NLP layer.

**Independent Test**: Can be tested by typing "show me my providers" and verifying the system maps to `cap:provider:health_get` and returns provider status.

**Acceptance Scenarios**:

1. **Given** the user types "create a new conversation with claude", **When** the interpretation renders, **Then** it shows "Create conversation · Provider: Claude" and executes on Enter
2. **Given** the user types "what's the system health", **When** the interpretation renders, **Then** it maps to `!health` with Rose (system) color
3. **Given** the user types "save this as a flashcard", **When** the interpretation renders, **Then** it maps to `/save` with Amber (memory) color
4. **Given** the user types "list all my tags", **When** the interpretation renders, **Then** it maps to `#list` with Emerald (tag) color

---

### Edge Cases

- What happens when the user types `/` followed by a space and then text? → Treated as a slash command with empty command name, show help
- What happens when `~last` is used but no AI response exists? → Error toast: "No previous response to reference"
- What happens when the user types `@` followed by an unknown provider? → Show provider suggestions
- What happens when two commands have the same prefix and namespace? → Disambiguate by args or show choice prompt
- What happens when the user types `!health` while offline? → Show cached health data with "stale" indicator
- What happens when a prefix command overlaps with a NLCL pattern? → Prefix wins (deterministic), NLCL is fallback only
- What happens when the user types `$cap:foo` with missing required args? → Show arg form with validation errors
- What happens when combo detection is ambiguous? → Show top-2 interpretations, user picks with arrow keys
- What happens when NLP confidence is below threshold? → Show "I think you want to..." with confidence indicator
- What happens when the user types rapidly? → Debounce 150ms, abort previous interpretation, show latest

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect prefix characters (`/`, `@`, `#`, `!`, `~`, `$`, `?`) at the first character of user input and route to the appropriate parser
- **FR-002**: System MUST resolve prefix commands via fuzzy matching with MRU ranking and context-boost scoring
- **FR-003**: System MUST fall through to NLCL catalog when no prefix is detected (plain text → natural language)
- **FR-004**: System MUST validate command arguments using Zod schemas with type coercion
- **FR-005**: System MUST resolve `~` context references (`~last`, `~this`, `~msg:ID`, `~conv:ID`, `~file:path`) before command execution
- **FR-006**: System MUST map each `UnifiedCommandSpec` to a `UnifiedCapability` via `capabilityId` for execution
- **FR-007**: System MUST provide autocomplete suggestions within 50ms for prefix-triggered input
- **FR-008**: System MUST track MRU command usage per-session and persist across sessions
- **FR-009**: System MUST support all 6 provider slugs in `@` mentions: `chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`
- **FR-010**: System MUST expose `!` commands for all existing devops operations (health, fleet, invariants, audit, deploy, converge, trace, config)
- **FR-011**: System MUST support `$cap:<namespace>:<action>` direct capability invocation with `--key=value` named arguments
- **FR-012**: System MUST show destructive command confirmations for `!deploy`, `!config import`, `!trace clear`
- **FR-013**: System MUST provide a `?` discovery prefix that lists all commands grouped by category
- **FR-014**: System MUST work across all surfaces: CLI, API (`/api/interpret`), UI (composer), MCP
- **FR-015**: System MUST NOT require NLCL/NLP for prefix commands — routing is deterministic and works offline
- **FR-016**: System MUST store NLP descriptions and trigger patterns in a `CommandDescription` Prisma model, with one consumer-friendly description + multiple trigger patterns per command
- **FR-017**: System MUST detect multi-command combos in plain text and decompose them into sequential or parallel execution plans
- **FR-018**: System MUST render live interpretation outside the prompt box with progressive disclosure (intent label → full preview)
- **FR-019**: System MUST change prompt box color based on detected command category using the category → primary → shades color system
- **FR-020**: System MUST transition multi-command interpretations to horizontal color-separated progress bars after Enter, with keyboard navigation between steps
- **FR-021**: System MUST support configurable interpretation placement (above, below, floating) via a rendering slot system
- **FR-022**: System MUST expose the full engine command surface (conversation, provider, memory, canvas, channel, session, workflow, automation) through the command language
- **FR-023**: System MUST provide confidence indicators for NLP-matched commands (low/med/high), with threshold gating for auto-execution
- **FR-024**: System MUST debounce interpretation rendering at 150ms to avoid flicker during rapid typing

### Key Entities

- **UnifiedCommandSpec**: A command definition with prefix, namespace, args, capability binding, surfaces, and context-aware ranking
- **UnifiedLiveCommand**: A command that provides real-time streaming suggestions (e.g., search)
- **CommandContext**: Current session state (active provider, conversation, last response, Gmail accounts, due memory count, panel status)
- **ArgSpec**: Argument definition with kind, validation, suggestions, and context-ref support
- **CommandResult**: Execution result with toast message, optional detail, and optional follow-up action
- **CommandDescription**: Prisma model — NLP description + trigger patterns per command, linked to `UnifiedCommandSpec` via command ID
- **CommandIntent**: Detected intent from user input — command ID, confidence, resolved args, category, color
- **CommandCombo**: Decomposed multi-command plan — array of `CommandIntent` with execution order (sequential/parallel)
- **CommandCategoryColor**: Color definition per category — primary hue + 3 shades (light/medium/dark)
- **InterpretationState**: Live interpretation state — intent, progress, expansion level, dismissal state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Prefix command resolution completes in < 100ms (no NLP latency)
- **SC-002**: Autocomplete suggestions appear within 50ms of keystroke
- **SC-003**: User can execute "send email with AI response" in ≤ 4 keystrokes (`/send` → `Enter`)
- **SC-004**: User can switch providers in ≤ 1 keystroke (`@claude ...`)
- **SC-005**: All 8 ActionRail verb shortcuts continue to work unchanged
- **SC-006**: 100% of existing NLCL catalog patterns remain accessible via plain text (no regression)
- **SC-007**: Prefix commands work without network connectivity (deterministic routing)
- **SC-008**: `bun run devops verify-cross-surface` passes — all capabilities resolve across CLI/API/MCP/UI
- **SC-009**: NLP intent detection matches correct command ≥ 85% of the time for common phrases
- **SC-010**: Multi-command combo detection correctly decomposes ≥ 80% of compound intents
- **SC-011**: Live interpretation renders within 200ms of keystroke (after debounce)
- **SC-012**: Prompt box color changes are imperceptible (< 16ms frame budget)

## Assumptions

- Users will learn prefix characters through the `?` discovery surface and autocomplete hints
- The edge-pwa CommandSpec type system is the baseline; we extend, not replace
- Existing NLCL catalog patterns (1483 lines) continue to work as plain-text fallback
- The `CapabilityResolutionEngine` is the execution backend for all commands
- ChromeGovernor is NOT involved in command routing (no CDP dependency)
- The command language engine is a new engine in the 13-engine architecture (L2-L3 layer)
- All commands are PowerShell-compatible in CLI mode
- The composer UI slot (`chat.composer`) supports inline autocomplete overlays
- The `CommandDescription` model is seeded from the existing command registry + NLCL catalog
- NLP matching uses a lightweight local model (no external API calls for intent detection)
- Color system uses HSL color space for shade generation, with WCAG AA contrast compliance
- The interpretation rendering slot is configurable but defaults to above the prompt box

---

## Appendix A: NLP Layer Design

### A.1 CommandDescription Prisma Model

```prisma
model CommandDescription {
  id          String   @id @default(cuid())
  commandId   String   // maps to UnifiedCommandSpec.id (e.g., "slash.new", "mention.claude")
  description String   // consumer-friendly: "Create a new conversation"
  patterns    String   // JSON array of trigger phrases: ["new chat", "start conversation", "begin fresh"]
  category    String   // command category for color mapping
  prefix      String?  // optional prefix hint for routing: "/", "@", "#", "!", "~", "$", "?"
  confidence  Float    // base confidence for NLP matching (0.0-1.0)
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([commandId])
  @@index([category])
  @@index([enabled])
}
```

### A.2 Seed Strategy

- Seed from existing NLCL catalog patterns (1483 lines → ~100 commands)
- Seed from existing CLI builtin commands (automate, moments)
- Seed from new prefix commands (27 slash + 6 mention + 3 tag + 15 devops + 5 context-ref + 1 capability + 5 discovery)
- Seed from raw engine operations (conversation CRUD, provider management, canvas ops, etc.)
- Total estimated: ~200 commands with ~600 trigger patterns

### A.3 NLP Matching Pipeline

```
User Input
    │
    ▼
┌─────────────────────┐
│  Prefix Detector     │  ← first char: / @ # ! ~ $ ?
│  (deterministic)     │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐  ┌────────────────┐
│ Slash  │  │  NLP Matcher   │  ← plain text → CommandDescription
│ Parser │  │  (probabilistic)│
└───┬────┘  └─────┬──────────┘
    │             │
    ▼             ▼
┌────────────────────────┐
│  Intent Detector       │  ← single command OR combo decomposition
│  (pattern + ML hybrid) │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Confidence Gate       │  ← threshold: 0.7 auto-execute, 0.4-0.7 show interpretation, <0.4 plain text
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Color Mapper          │  ← category → primary color → shade
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Interpretation Engine │  ← progressive disclosure rendering
└────────────────────────┘
```

### A.4 Combo Detection Rules

| Input Pattern | Detected Combo | Execution Order |
|---------------|----------------|-----------------|
| "switch to claude and ask about rust" | [switch(claude), ask(rust)] | sequential |
| "health check and list conversations" | [health, list(conversations)] | parallel |
| "save this as flashcard then tag it rust" | [save(~last), tag(rust)] | sequential |
| "export the response and email it to boss" | [export(~last), send(boss)] | sequential |
| "create a conversation with gemini and ask about rust" | [create(gemini), ask(rust)] | sequential |
| "list my providers and show fleet status" | [providers, fleet] | parallel |

**Detection heuristic**: Sequential if B depends on A's output. Parallel if A and B are independent. Use dependency graph between command categories.

---

## Appendix B: Color System Design

### B.1 Category → Primary Color Mapping

| Category | Primary Hue | Hex | WCAG AA on White |
|----------|-------------|-----|-------------------|
| conversation | Blue | `#3B82F6` | ✅ 4.6:1 |
| memory | Amber | `#F59E0B` | ✅ 4.5:1 |
| email | Emerald | `#10B981` | ✅ 4.5:1 |
| file | Slate | `#64748B` | ✅ 5.0:1 |
| browser | Cyan | `#06B6D4` | ✅ 4.6:1 |
| llm | Violet | `#8B5CF6` | ✅ 4.5:1 |
| system | Rose | `#F43F5E` | ✅ 4.5:1 |
| canvas | Pink | `#EC4899` | ✅ 4.5:1 |
| channel | Teal | `#14B8A6` | ✅ 4.5:1 |
| session | Indigo | `#6366F1` | ✅ 4.5:1 |
| workflow | Orange | `#F97316` | ✅ 4.5:1 |
| automation | Lime | `#84CC16` | ✅ 4.5:1 |

### B.2 Shade System (3 levels per category)

Each category has 3 shades derived from HSL manipulation:

| Shade | Use Case | HSL Adjustment |
|-------|----------|----------------|
| Light (300) | Autocomplete suggestions, inactive states | +20% lightness |
| Medium (500) | Active prompt box border, interpretation text | Base color |
| Dark (700) | Confirmed execution, progress bars | -15% lightness |

### B.3 Color Application Rules

| Element | Color Usage |
|---------|-------------|
| Prompt box border | Changes to medium shade of detected category |
| Interpretation text | Medium shade for intent label, light shade for details |
| Progress bar segments | Dark shade for each command step |
| Palette command icons | Medium shade of command's category |
| Autocomplete items | Light shade for category badge |
| Confidence indicator | Green (high) / Yellow (medium) / Red (low) |

### B.4 Blended Colors (Multi-Command)

When multiple commands are detected in a combo:
- Sequential: First command's color dominates, second appears in progress bar
- Parallel: Colors shown side-by-side in split view
- Dominant category determines prompt box border color

### B.5 Color System Implementation

```typescript
// src/engines/command-language/colors.ts
export const CATEGORY_COLORS: Record<CommandCategory, CategoryColor> = {
  conversation: { primary: '#3B82F6', hsl: [217, 91, 60] },
  memory:       { primary: '#F59E0B', hsl: [38, 92, 50] },
  email:        { primary: '#10B981', hsl: [160, 84, 39] },
  file:         { primary: '#64748B', hsl: [215, 16, 47] },
  browser:      { primary: '#06B6D4', hsl: [189, 94, 43] },
  llm:          { primary: '#8B5CF6', hsl: [258, 90, 66] },
  system:       { primary: '#F43F5E', hsl: [347, 90, 60] },
  canvas:       { primary: '#EC4899', hsl: [330, 81, 60] },
  channel:      { primary: '#14B8A6', hsl: [168, 76, 40] },
  session:      { primary: '#6366F1', hsl: [245, 58, 61] },
  workflow:     { primary: '#F97316', hsl: [25, 95, 53] },
  automation:   { primary: '#84CC16', hsl: [84, 81, 44] },
}

export function getShade(category: CommandCategory, shade: 'light' | 'medium' | 'dark'): string {
  const base = CATEGORY_COLORS[category]
  const [h, s, l] = base.hsl
  const lightness = shade === 'light' ? l + 20 : shade === 'dark' ? l - 15 : l
  return `hsl(${h}, ${s}%, ${Math.max(0, Math.min(100, lightness))}%)`
}
```

---

## Appendix C: Progressive Interpretation Design

### C.1 Disclosure Levels

| Level | Trigger | Content | Example |
|-------|---------|---------|---------|
| L0 (None) | No intent detected | Nothing | Plain text, no command match |
| L1 (Intent) | Command detected, < 15 chars typed | Intent label only | "Send to Claude" |
| L2 (Preview) | Command detected, > 15 chars typed | Intent + extracted content | "Send to Claude · Prompt: explain recursion" |
| L3 (Full) | User hovers or presses Tab | Intent + content + execution plan | "Send to Claude · Prompt: explain recursion · Response will stream in main panel" |

### C.2 Expansion Rules

- Start at L1 when intent is first detected
- Expand to L2 after 150ms pause OR 15+ characters typed
- Expand to L3 on Tab key or hover (power user)
- Collapse back to L1 on any keystroke that changes intent
- Dismiss entirely on Escape

### C.3 Rendering Position (Configurable)

```typescript
interface InterpretationConfig {
  position: 'above' | 'below' | 'floating' | 'inline'
  expandOn: 'auto' | 'tab' | 'hover'
  dismissOn: 'escape' | 'enter' | 'blur'
  maxWidth: number // px
  animationDuration: number // ms
}
```

Default: `position: 'above'`, `expandOn: 'auto'`, `dismissOn: 'enter'`

---

## Appendix D: Post-Enter Lifecycle

### D.1 Single Command

```
[Enter pressed]
    │
    ▼
┌────────────────────────┐
│  Confirmation Toast    │  ← "Sent to Claude" (medium shade)
│  (auto-dismiss 2s)     │
└────────────────────────┘
```

### D.2 Multi-Command Combo

```
[Enter pressed]
    │
    ▼
┌────────────────────────────────────────────────┐
│  Progress Bar (horizontal, color-separated)    │
│  ┌──────┐  ┌──────┐  ┌──────┐                  │
│  │ Step1│→ │ Step2│→ │ Step3│                  │
│  │ 🔵   │  │ 🟣   │  │ 🟢   │                  │
│  └──────┘  └──────┘  └──────┘                  │
│                                                │
│  "Switch to Claude" (current step, bold)       │
│  [←] [→] navigate  [Enter] execute next       │
│  [Esc] cancel remaining                        │
└────────────────────────────────────────────────┘
```

### D.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between steps |
| `Enter` | Execute current step / advance to next |
| `Escape` | Cancel remaining steps |
| `↑` | Expand step details |
| `↓` | Collapse step details |
