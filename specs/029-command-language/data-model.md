# Data Model: Command Language (Enhanced)

**Feature**: `029-command-language`
**Date**: 2026-07-19

## Entities

### 1. CommandDescription (NEW — Prisma Model)

Stores NLP descriptions and trigger patterns for every command in the system.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | String (CUID) | Yes | Primary key |
| `commandId` | String | Yes | Maps to `UnifiedCommandSpec.id` (e.g., "slash.new", "mention.claude") |
| `description` | String | Yes | Consumer-friendly: "Create a new conversation" |
| `patterns` | String (JSON) | Yes | Array of trigger phrases: `["new chat", "start conversation", "begin fresh"]` |
| `category` | String | Yes | Command category for color mapping |
| `prefix` | String? | No | Optional prefix hint: "/", "@", "#", "!", "~", "$", "?" |
| `confidence` | Float | Yes | Base confidence for NLP matching (0.0-1.0) |
| `enabled` | Boolean | Yes | Default: true |
| `createdAt` | DateTime | Yes | Auto-set on creation |
| `updatedAt` | DateTime | Yes | Auto-updated |

**Indexes**: `commandId`, `category`, `enabled`

**Relationships**: None (standalone lookup table)

---

### 2. UnifiedCommandSpec (TypeScript — In-Memory)

Runtime command definition. Not persisted — constructed at boot from spec files.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | "slash.new", "mention.claude", "devops.health" |
| `prefix` | Prefix | Yes | "/", "@", "#", "!", "~", "$", "?" |
| `namespace` | string | Yes | "conversation", "provider", "system", etc. |
| `title` | string | Yes | Human-readable label |
| `subtitle` | string? | No | Secondary description |
| `keywords` | string[]? | No | Search keywords |
| `icon` | string? | No | Emoji or icon name |
| `category` | CommandCategory | Yes | For color mapping |
| `surfaces` | Array<'cli'\|'ui'\|'api'\|'mcp'\|'palette'> | Yes | Where this command is available |
| `when` | Function? | No | Visibility gate |
| `boost` | Function? | No | Ranking boost 0-1 |
| `destructive` | boolean? | No | Requires confirmation |
| `args` | ArgSpec[]? | No | Argument definitions |
| `run` | Function | Yes | Execution handler |
| `aliases` | string[]? | No | Alternative names |
| `examples` | string[]? | No | Usage examples |
| `capabilityId` | string? | No | Maps to UnifiedCapability |
| `patternId` | string? | No | Maps to NLCL catalog pattern |

---

### 3. CommandContext (TypeScript — Runtime)

Current session state passed to all command handlers.

| Field | Type | Description |
|-------|------|-------------|
| `activeProvider` | string \| null | Currently selected provider |
| `activeConvId` | string \| null | Active conversation ID |
| `activeAccountId` | string \| null | Active account ID |
| `lastAssistantText` | string \| null | Last AI response text |
| `lastAssistantAt` | number \| null | Timestamp of last AI response |
| `lastUserPrompt` | string \| null | Last user prompt |
| `gmailAccounts` | Array<{hash, email}> | Connected Gmail accounts |
| `dueMemoryCount` | number | Number of flashcards due for review |
| `panelStatus` | 'connecting' \| 'connected' \| 'disconnected' | Connection status |
| `activeTags` | string[] | Tags on active conversation |
| `recentCommands` | string[] | MRU command IDs (last 10) |
| `sessionState` | Record<string, unknown> | Arbitrary session state |

---

### 4. CommandIntent (TypeScript — Runtime)

Detected intent from user input.

| Field | Type | Description |
|-------|------|-------------|
| `commandId` | string | Matched command ID |
| `confidence` | number | 0.0-1.0 confidence score |
| `category` | CommandCategory | For color mapping |
| `args` | Record<string, unknown> | Resolved arguments |
| `source` | 'prefix' \| 'nlp' \| 'nlcl' | How intent was detected |
| `color` | CategoryColor | Primary color for this category |
| `interpretation` | string | Consumer-friendly description |

---

### 5. CommandCombo (TypeScript — Runtime)

Decomposed multi-command plan.

| Field | Type | Description |
|-------|------|-------------|
| `intents` | CommandIntent[] | Ordered list of intents |
| `executionOrder` | 'sequential' \| 'parallel' \| 'mixed' | How to execute |
| `dependencies` | Array<[number, number]> | Edge list: [from, to] |
| `interpretation` | string | Natural language description |
| `dominantCategory` | CommandCategory | For prompt box color |

---

### 6. InterpretationState (TypeScript — Runtime)

Live interpretation rendering state.

| Field | Type | Description |
|-------|------|-------------|
| `level` | DisclosureLevel | L0 (none), L1 (intent), L2 (preview), L3 (full) |
| `intent` | CommandIntent \| null | Current detected intent |
| `combo` | CommandCombo \| null | Multi-command plan (if detected) |
| `color` | CategoryColor | Current prompt box color |
| `position` | 'above' \| 'below' \| 'floating' \| 'inline' | Rendering position |
| `visible` | boolean | Whether interpretation is shown |
| `expanded` | boolean | Whether expanded to L3 |

---

### 7. CategoryColor (TypeScript — Static)

Color definition per command category.

| Field | Type | Description |
|-------|------|-------------|
| `category` | CommandCategory | Category name |
| `primary` | string | Hex color (e.g., "#3B82F6") |
| `hsl` | [number, number, number] | [hue, saturation, lightness] |
| `shades` | { light: string, medium: string, dark: string } | Derived shades |

---

## State Transitions

### Intent Detection State Machine

```
IDLE → DETECTING → DETECTED → RENDERING → EXECUTING → COMPLETE
  ↑         ↑          ↑           ↑            ↑
  │         │          │           │            │
  └─────────┴──────────┴───────────┴────────────┘
              (on keystroke / Escape / Enter)
```

### Disclosure Level Transitions

```
L0 (none) → L1 (intent)     : command detected
L1 (intent) → L2 (preview)   : 150ms pause OR 15+ chars
L2 (preview) → L3 (full)     : Tab key or hover
L3 (full) → L2 (preview)     : any keystroke
L2/L3 → L0 (none)            : Escape or no match
```

## Validation Rules

| Entity | Rule |
|--------|------|
| `CommandDescription.commandId` | Must match existing `UnifiedCommandSpec.id` |
| `CommandDescription.patterns` | Must be valid JSON array of strings |
| `CommandDescription.confidence` | Must be 0.0-1.0 |
| `CommandDescription.category` | Must be valid `CommandCategory` |
| `CommandIntent.confidence` | Must be 0.0-1.0 |
| `CommandCombo.intents` | Must have ≥1 intent |
| `CommandCombo.dependencies` | Must be valid edge list (no cycles) |
