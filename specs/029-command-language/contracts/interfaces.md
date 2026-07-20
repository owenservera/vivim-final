# Interface Contracts: Command Language

**Feature**: `029-command-language`
**Date**: 2026-07-19

## Contract 1: CommandLanguageEngine API

The primary engine interface exposed to the CLI, API, and UI layers.

```typescript
interface CommandLanguageEngine {
  /**
   * Parse user input and detect intent (prefix or NLP).
   * Returns parsed command or null if no match.
   */
  detectIntent(
    input: string,
    ctx: CommandContext
  ): Promise<CommandIntent | null>

  /**
   * Resolve a parsed command to a full command spec.
   * Returns the spec with execution handler.
   */
  resolveCommand(
    parsed: ParsedCommand,
    ctx: CommandContext
  ): UnifiedCommandSpec | null

  /**
   * Execute a resolved command with validated args.
   * Returns execution result.
   */
  executeCommand(
    spec: UnifiedCommandSpec,
    args: Record<string, unknown>,
    ctx: CommandContext
  ): Promise<CommandResult>

  /**
   * Get autocomplete suggestions for partial input.
   * Debounced internally (150ms).
   */
  suggest(
    input: string,
    ctx: CommandContext
  ): Promise<Suggestion[]>

  /**
   * Detect multi-command combos in plain text.
   * Returns combo plan or null if single command.
   */
  detectCombo(
    input: string,
    ctx: CommandContext
  ): Promise<CommandCombo | null>

  /**
   * Get current interpretation state for rendering.
   */
  getInterpretation(): InterpretationState

  /**
   * Update interpretation level (L0-L3).
   */
  setDisclosureLevel(level: DisclosureLevel): void

  /**
   * Get color for a command category.
   */
  getCategoryColor(category: CommandCategory): CategoryColor

  /**
   * Record command usage for MRU tracking.
   */
  recordMRU(commandId: string): void

  /**
   * Get MRU commands (last N).
   */
  getMRU(limit?: number): string[]
}
```

---

## Contract 2: CommandStore (Storage Contract)

Engine-facing interface for MRU persistence and command lookup.

```typescript
interface CommandStore {
  /**
   * Get recent commands for a session.
   */
  getRecentCommands(
    sessionId: string,
    limit?: number
  ): Promise<string[]>

  /**
   * Record a command execution.
   */
  recordCommand(
    sessionId: string,
    commandId: string
  ): Promise<void>

  /**
   * Clear MRU for a session.
   */
  clearRecentCommands(sessionId: string): Promise<void>
}
```

---

## Contract 3: CommandDescriptionStore (Storage Contract)

Engine-facing interface for NLP description + pattern lookup.

```typescript
interface CommandDescriptionStore {
  /**
   * Get all enabled command descriptions.
   */
  getAll(): Promise<CommandDescriptionRow[]>

  /**
   * Get descriptions by category.
   */
  getByCategory(
    category: string
  ): Promise<CommandDescriptionRow[]>

  /**
   * Get description by command ID.
   */
  getByCommandId(
    commandId: string
  ): Promise<CommandDescriptionRow | null>

  /**
   * Search patterns by fuzzy match.
   * Returns top N matches with confidence scores.
   */
  searchPatterns(
    query: string,
    options?: {
      limit?: number
      category?: string
      prefix?: string
      minConfidence?: number
    }
  ): Promise<PatternMatchResult[]>

  /**
   * Upsert a command description (for seeding).
   */
  upsert(
    commandId: string,
    data: {
      description: string
      patterns: string[]
      category: string
      prefix?: string
      confidence?: number
    }
  ): Promise<void>

  /**
   * Bulk upsert (for seed scripts).
   */
  bulkUpsert(
    rows: Array<{
      commandId: string
      description: string
      patterns: string[]
      category: string
      prefix?: string
      confidence?: number
    }>
  ): Promise<void>
}
```

---

## Contract 4: InterpretationRenderer (UI Contract)

Frontend interface for rendering live interpretation.

```typescript
interface InterpretationRenderer {
  /**
   * Render interpretation above/below/floating/inline.
   * Configurable position and expansion behavior.
   */
  render(state: InterpretationState): React.ReactNode

  /**
   * Get prompt box border color for current intent.
   */
  getPromptBoxColor(
    intent: CommandIntent | null
  ): string

  /**
   * Render multi-command progress bar.
   * Color-separated segments with keyboard navigation.
   */
  renderProgressBar(
    combo: CommandCombo,
    currentStep: number
  ): React.ReactNode

  /**
   * Handle keyboard navigation in progress bar.
   */
  handleProgressKey(
    key: string,
    combo: CommandCombo,
    currentStep: number
  ): { action: 'next' | 'prev' | 'execute' | 'cancel' }
}
```

---

## Contract 5: API Request/Response

### POST /api/interpret (Enhanced)

**Request**:
```json
{
  "input": "switch to claude and ask about rust",
  "sessionId": "abc123",
  "context": {
    "activeProvider": "gemini",
    "activeConvId": "conv_xyz"
  }
}
```

**Response**:
```json
{
  "intent": {
    "commandId": "combo",
    "confidence": 0.92,
    "combo": {
      "intents": [
        {
          "commandId": "slash.switch",
          "confidence": 0.95,
          "category": "session",
          "args": { "provider": "claude" },
          "interpretation": "Switch to Claude"
        },
        {
          "commandId": "mention.claude",
          "confidence": 0.88,
          "category": "llm",
          "args": { "prompt": "ask about rust" },
          "interpretation": "Ask about rust"
        }
      ],
      "executionOrder": "sequential",
      "interpretation": "Switch to Claude, then ask about rust",
      "dominantCategory": "session"
    }
  },
  "color": {
    "primary": "#6366F1",
    "shades": {
      "light": "hsl(245, 58%, 81%)",
      "medium": "hsl(245, 58%, 61%)",
      "dark": "hsl(245, 58%, 46%)"
    }
  }
}
```

### GET /api/command-descriptions

**Response**:
```json
{
  "commands": [
    {
      "commandId": "slash.new",
      "description": "Create a new conversation",
      "patterns": ["new chat", "start conversation", "begin fresh"],
      "category": "conversation",
      "prefix": "/",
      "confidence": 0.95
    }
  ],
  "total": 200
}
```
