# Command Language Specification — VIVIM Unified Command Surface

**Phase:** Design Session  
**Date:** 2026-07-19  
**Baseline:** edge-pwa CommandPalette + ActionRail + NLCL Catalog + Capability Registry  
**Goal:** Minimize user time-to-action across all surfaces (CLI, API, UI, MCP)

---

## 1. Harvested Baseline (edge-pwa)

### 1.1 Type System

```typescript
// palette/types.ts — the canonical CommandSpec interface
interface CommandContext {
  activeProvider: string | null
  activeConvId: string | null
  activeAccountId: string | null
  lastAssistantText: string | null
  lastAssistantAt: number | null
  lastUserPrompt: string | null
  gmailAccounts: Array<{ hash: string; email: string }>
  dueMemoryCount: number
  panelStatus: 'connecting' | 'connected' | 'disconnected'
}

type ArgKind = 'text' | 'email' | 'tag' | 'path' | 'choice' | 'select'
  | 'conv' | 'memory' | 'textarea'

interface ArgSpec {
  name: string
  kind: ArgKind
  placeholder: string
  required: boolean
  default?: string | ((ctx: CommandContext) => string | null)
  multiline?: boolean
  suggestions?: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  options?: Array<{ value: string; label: string }>
  acceptContextRef?: 'lastAssistant' | 'activeConv'
}

interface CommandSpec {
  id: string           // e.g. "email.send", "memory.create"
  namespace: string    // e.g. "email", "memory", "system"
  title: string        // human-readable label
  subtitle?: string
  keywords?: string[]
  icon?: string
  when?: (ctx: CommandContext) => boolean   // visibility gate
  boost?: (ctx: CommandContext) => number   // ranking boost 0-1
  args?: ArgSpec[]
  run: (args: Record<string, unknown>, ctx: CommandContext) => Promise<CommandResult>
}

interface LiveCommand extends CommandSpec {
  live: true
  suggest: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  runOnSuggestion: (s: Suggestion, ctx: CommandContext) => Promise<CommandResult>
}

type CommandResult =
  | { ok: true; toast: string; detail?: string; openUrl?: string; followup?: string }
  | { ok: false; toast: string; detail?: string }
```

### 1.2 Ranking Formula

```
score = 0.45 * fuzzy + 0.20 * mru + 0.25 * boost(ctx) + 0.10 * namespacePrefix
```

### 1.3 Harvested Commands (edge-pwa)

| Namespace | Command | Type | Args |
|-----------|---------|------|------|
| conversation | `conversation.list` | static | limit |
| conversation | `conversation.archive` | static | id (conv) |
| conversation | `conversation.unarchive` | static | id (conv) |
| email | `email.send` | static | to, subject, body |
| email | `email.draft` | static | to, subject, body |
| memory | `memory.create` | static | content, summary, category |
| memory | `memory.due` | static | — |
| memory | `memory.search` | static | q |
| search | `search` | **live** | q (streaming suggestions) |
| tag | `tag.set` | static | conversationId, tag |
| tag | `tag.search` | static | tag |
| tag | `tag.list` | static | — |
| notebook | `notebook.create` | static | title |
| notebook | `notebook.add` | static | notebookId, content, title |
| notebook | `notebook.list` | static | — |
| bookmark | `bookmark.toggle` | static | conversationId |
| bookmark | `bookmark.list` | static | — |
| files | `fs.write` | static | path, content |
| files | `fs.read` | static | path |
| files | `fs.list` | static | path |
| trace | `trace.export` | static | — |
| trace | `trace.clear` | static | — |
| config | `config.export` | static | — |
| config | `config.import` | static | json |
| system | `system.openBrowser` | static | url |
| system | `system.info` | static | — |

### 1.4 ActionRail Verbs (8 quick-apply buttons)

| Verb | Shortcut | Tier | Description |
|------|----------|------|-------------|
| Email | `e` | primary | Draft/send via Gmail API |
| Card | `f` | primary | Create FSRS flashcard |
| Pin | `p` | primary | Pin current AI response |
| Note | `n` | secondary | Add to notebook |
| Tag | `t` | secondary | Tag conversation |
| Export | `x` | secondary | Export to file (md/txt) |
| Bookmark | `b` | secondary | Toggle bookmark |
| Notebook | `o` | secondary | Create new notebook |

### 1.5 Inline Slash Commands (Composer)

```typescript
const SLASH_COMMANDS = [
  { cmd: '/new',    label: 'New chat',          icon: '+' },
  { cmd: '/focus',  label: 'Toggle focus mode', icon: '⊡' },
  { cmd: '/help',   label: 'Show shortcuts',    icon: '?' },
  { cmd: '/clear',  label: 'Clear conversation',icon: '⌫' },
  { cmd: '/copy',   label: 'Copy last response',icon: '⎘' },
]
```

### 1.6 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `?` (in palette) | Show cheat sheet |
| `Escape` | Close/back |
| `↑↓` | Navigate results |
| `Enter` | Execute selected |
| `⌥+Enter` | Inject context ref (lastAssistant/activeConv) |
| `e/f/p/n/t/x/b/o` | ActionRail verb shortcuts |

---

## 2. vivim-final Real Capabilities (Grounding)

### 2.1 NLCL Catalog Patterns (1483 lines, 12 categories)

| Category | Patterns | Key Commands |
|----------|----------|--------------|
| file | 5 | open, list, search, create, read |
| browser | 5 | navigate, search, open, extract, screenshot |
| llm | 7 | ask, summarize, translate, explain, rewrite, code, web.query |
| email | 1 | send |
| app | 1 | launch (notepad, calc, chrome, etc.) |
| conversation | 3 | create, list, switch |
| system | 6 | health, providers, fleet, capabilities, version, workspace, help |
| canvas | 5 | set_background, add_layer, remove_layer, set_layout, set_theme |
| channel | 4 | add, connect, list, remove |
| session | 3 | load, start, list |
| memory | 2 | recall, store |
| automation | 4 | research, extract, summarize, monitor, test |
| opencode | 3 | send, session.create, session.list |

### 2.2 Capability Registry (UnifiedCapability)

Each capability exposes surfaces: `cli`, `ui`, `api`, `mcp`

| Capability ID | CLI Command | API Path | Category |
|---------------|-------------|----------|----------|
| `cap:help` | `help` | `GET /api/help` | system |
| `cap:conversation:switch` | `conversations switch` | `POST /api/conversations/switch` | conversation |
| `cap:system:capabilities` | `capabilities` | `GET /api/capabilities` | system |
| `cap:web:query` | `web query` | `POST /api/web/query` | web |
| `cap:workflow:create_newsletter` | `workflow newsletter` | `POST /api/workflows/newsletter` | workflow |
| `cap:schedule:register` | `schedule register` | `POST /api/schedules` | schedule |
| `cap:conversation:create` | — | — | conversation |
| `cap:conversation:list` | — | — | conversation |
| `cap:system:health` | — | — | system |
| `cap:provider:health_get` | — | — | system |
| `cap:fleet:status` | — | — | system |
| `cap:setup:workspace_get` | — | — | system |
| `cap:system:version` | — | — | system |
| `cap:canvas:*` | — | — | canvas |
| `cap:channel:*` | — | — | channel |
| `cap:session:*` | — | — | session |
| `cap:opencode:*` | — | — | agent |

### 2.3 CLI Builtin Commands

| Command | Description |
|---------|-------------|
| `automate` | Agent-driven frontend automation (navigate, click, type, screenshot) |
| `moments` | User-journey provider account setup (list, launch, verify, complete, health, setup) |

### 2.4 API Routes

| Router | Endpoints |
|--------|-----------|
| interpret | `POST /api/interpret` (NL → capability) |
| capability | CRUD + execute |
| conversation | CRUD + switch |
| knowledge | Graph queries |
| kernel | Oracle queries |
| automation | Orchestrator |
| canvas | Layer/layout/theme |
| channel | Streaming channels |
| session | Session management |
| memory-viz | Memory visualization |
| setup | Workspace setup |
| webhook | External hooks |
| mux | Multiplexer |

---

## 3. Unified Command Language Design

### 3.1 Grammar — 5 Prefix Layers

The command language uses **prefix characters** to disambiguate intent at the first keystroke. This merges social conventions (`@`, `#`), agentic coding (`/`), devops (`!`), and inline references (`~`).

```
input := command | query

command := prefix body
prefix := '/' | '@' | '#' | '!' | '~' | '$' | '?'
body   := WORDS (whitespace-separated tokens)

query  := PLAIN_TEXT  (natural language, routed via NLCL)
```

#### Prefix Semantics

| Prefix | Domain | Origin | Example |
|--------|--------|--------|---------|
| `/` | **Slash Commands** | Discord/Slack/consumer chat | `/new`, `/switch claude`, `/send email` |
| `@` | **Provider/Entity Mentions** | Social media / email | `@claude explain recursion`, `@john@email.com` |
| `#` | **Tags/Categories** | Social media hashtags | `#rust add tag`, `#important tag conversation` |
| `!` | **DevOps/System Actions** | CLI/automation | `!health`, `!fleet status`, `!deploy` |
| `~` | **Context References** | Internal (ref to last msg) | `~last save as flashcard`, `~this email to boss` |
| `$` | **Capability Direct Invoke** | Developer/direct API | `$cap:memory:create --content "..."` |
| `?` | **Discovery/Help** | Query/discovery | `?what can you do`, `?providers` |

### 3.2 Command Spec v2 (extends edge-pwa)

```typescript
// src/engines/command-language/types.ts

export type Prefix = '/' | '@' | '#' | '!' | '~' | '$' | '?'

export type CommandCategory =
  | 'conversation' | 'memory' | 'email' | 'file' | 'browser'
  | 'llm' | 'system' | 'canvas' | 'channel' | 'session'
  | 'workflow' | 'schedule' | 'automation' | 'provider' | 'agent'

export type ArgKind =
  | 'text'       // free text
  | 'textarea'   // multiline text
  | 'email'      // email address with autocomplete
  | 'tag'        // hashtag with autocomplete
  | 'path'       // file path
  | 'choice'     // fixed options
  | 'select'     // dropdown
  | 'conv'       // conversation ID
  | 'provider'   // provider slug (chatgpt, claude, gemini, etc.)
  | 'url'        // URL with validation
  | 'json'       // JSON payload
  | 'ref'        // context reference (~last, ~this, ~msg:ID)
  | 'cron'       // cron expression
  | 'duration'   // time duration (5m, 1h, 1d)

export interface ArgSpec {
  name: string
  kind: ArgKind
  placeholder: string
  required: boolean
  default?: string | ((ctx: CommandContext) => string | null)
  multiline?: boolean
  suggestions?: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  options?: Array<{ value: string; label: string }>
  acceptContextRef?: 'lastAssistant' | 'activeConv' | 'lastFile' | 'lastUrl'
  validation?: (value: string) => string | null  // returns error or null
}

export interface UnifiedCommandSpec {
  id: string                    // "email.send", "provider.switch", etc.
  prefix: Prefix                // which trigger character
  namespace: string             // "email", "provider", "system", etc.
  title: string
  subtitle?: string
  keywords?: string[]
  icon?: string
  category: CommandCategory
  surfaces: Array<'cli' | 'ui' | 'api' | 'mcp' | 'palette'>

  // Visibility + ranking
  when?: (ctx: CommandContext) => boolean
  boost?: (ctx: CommandContext) => number
  destructive?: boolean         // requires confirmation

  // Arguments
  args?: ArgSpec[]

  // Execution
  run: (args: Record<string, unknown>, ctx: CommandContext) => Promise<CommandResult>

  // For palette autocomplete
  aliases?: string[]
  examples?: string[]

  // Capability binding (maps to UnifiedCapability)
  capabilityId?: string         // "cap:email:send", etc.

  // NLCL integration (maps to catalog pattern)
  patternId?: string            // "email.send", "browser.navigate", etc.
}

export interface UnifiedLiveCommand extends UnifiedCommandSpec {
  live: true
  suggest: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  runOnSuggestion: (s: Suggestion, ctx: CommandContext) => Promise<CommandResult>
}
```

### 3.3 CommandTable — Full Registry

#### `/` Slash Commands (Consumer-grade, minimal typing)

| Command | Args | Description | Maps To |
|---------|------|-------------|---------|
| `/new` | provider? | New conversation | `cap:conversation:create` |
| `/switch` | provider | Switch provider | `cap:conversation:switch` |
| `/list` | type? (conv/session/tag) | List items | `cap:conversation:list` |
| `/search` | query | Full-text search | `LiveCommand` (Tantivy) |
| `/send` | to, subject?, body? | Send email | `cap:email:send` |
| `/draft` | to, subject?, body? | Draft email | `cap:email:draft` |
| `/save` | content?, category? | Save flashcard | `cap:memory:create` |
| `/review` | — | Review due cards | `cap:memory:due` |
| `/recall` | topic? | Search memories | `cap:memory:search` |
| `/tag` | tag, conv? | Tag conversation | `cap:tag:set` |
| `/export` | path?, format? | Export response | `cap:file:write` |
| `/open` | url | Open in browser | `cap:browser:navigate` |
| `/screenshot` | — | Capture screen | `cap:browser:screenshot` |
| `/health` | — | System health | `cap:system:health` |
| `/providers` | — | List providers | `cap:provider:health_get` |
| `/fleet` | — | Chrome fleet status | `cap:fleet:status` |
| `/help` | — | Show commands | `cap:help` |
| `/clear` | — | Clear conversation | UI-only |
| `/focus` | — | Toggle focus mode | UI-only |
| `/copy` | — | Copy last response | UI-only |
| `/undo` | — | Undo last action | History-based |
| `/automate` | args... | Browser automation | `automate` builtin |
| `/moments` | args... | Provider setup | `moments` builtin |
| `/opencode` | prompt | Send to OpenCode | `cap:opencode:send` |
| `/session` | action, provider? | Session management | `cap:session:*` |
| `/newsletter` | recipients? | Create newsletter | `cap:workflow:create_newsletter` |
| `/schedule` | cron, action | Register schedule | `cap:schedule:register` |
| `/background` | imageQuery | Set canvas bg | `cap:canvas:set_background` |
| `/theme` | light/dark/auto | Set theme | `cap:canvas:set_theme` |
| `/layout` | grid/list/freeform | Set layout | `cap:canvas:set_layout` |

#### `@` Provider/Entity Mentions

| Pattern | Description | Example |
|---------|-------------|---------|
| `@<provider> <prompt>` | Send to specific provider | `@claude explain recursion` |
| `@<email> <subject> <body>` | Email shorthand | `@boss@co.io Meeting at 3pm` |
| `@<provider>:` inline | Provider prefix | `@gemini: what is rust?` |

Providers: `chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok`

#### `#` Tags / Categories

| Pattern | Description | Example |
|---------|-------------|---------|
| `#<tag> <command>` | Apply tag to command result | `#rust /save` |
| `#<tag>` alone | Tag current conversation | `#important` |
| `#list` | List all tags | `#list` |
| `#search <tag>` | Search by tag | `#search rust` |

#### `!` DevOps / System Actions

| Pattern | Description | Maps To |
|---------|-------------|---------|
| `!health` | Full health check | `cap:system:health` |
| `!fleet` | Chrome fleet status | `cap:fleet:status` |
| `!providers` | Provider health | `cap:provider:health_get` |
| `!caps` | List capabilities | `cap:system:capabilities` |
| `!version` | System version | `cap:system:version` |
| `!workspace` | Working directory | `cap:setup:workspace_get` |
| `!trace export` | Export traces | trace export |
| `!trace clear` | Clear traces | trace clear |
| `!config export` | Export config | config export |
| `!config import` | Import config | config import |
| `!deploy` | Production build | `production-build` skill |
| `!audit` | Source code audit | `source-audit` skill |
| `!gate` | Quality gate | `unified-gate` |
| `!converge` | Spec converge | `speckit-converge` |
| `!invariants` | Check invariants | `devops invariants check` |

#### `~` Context References

| Pattern | Description | Example |
|---------|-------------|---------|
| `~last` | Reference last AI response | `~last save as flashcard` |
| `~this` | Reference current selection | `~this email to john@co.io` |
| `~msg:<id>` | Reference specific message | `~msg:abc123 tag important` |
| `~conv:<id>` | Reference conversation | `~conv:xyz export` |
| `~file:<path>` | Reference file | `~file:src/index.ts explain` |

#### `$` Direct Capability Invoke (Developer)

| Pattern | Description | Example |
|---------|-------------|---------|
| `$<capId>` | Invoke capability directly | `$cap:memory:create --content "..."` |
| `$<capId> --<arg>` | Named arguments | `$cap:web:query --url=https://...` |

#### `?` Discovery

| Pattern | Description |
|---------|-------------|
| `?` or `?help` | Show all commands grouped by category |
| `?providers` | Show provider status |
| `?tags` | Show all tags |
| `?recent` | Show recent commands (MRU) |
| `?<query>` | Search commands by keyword |

### 3.4 Parser Architecture

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
┌────────┐  ┌────────────┐
│ Slash  │  │  NLCL      │  ← natural language (no prefix)
│ Parser │  │  Catalog   │
└───┬────┘  └─────┬──────┘
    │             │
    ▼             ▼
┌────────────────────────┐
│  Command Resolver       │  ← namespace.command matching
│  (fuzzy + MRU + boost) │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Arg Parser             │  ← positional + named (--key=value)
│  (Zod validation)       │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│  Capability Executor    │  ← calls UnifiedCapabilityRegistry
│  (POST /api/interpret)  │
└────────────────────────┘
```

### 3.5 Inline Autocomplete Flow

When user types a prefix character, the palette opens with filtered results:

```
User types: /sw
    → Palette shows:
      ├─ /switch        "Switch provider"     (score: 0.95)
      └─ /session       "Session management"  (score: 0.31)

User types: @cl
    → Palette shows:
      ├─ @claude        "Send to Claude"      (score: 0.98)
      └─ @chatgpt       "Send to ChatGPT"     (score: 0.22)

User types: !h
    → Palette shows:
      ├─ !health        "System health"       (score: 0.97)
      └─ !help          "Show commands"       (score: 0.85)
```

### 3.6 Context-Aware Boost Rules

| Context State | Boosted Commands | Reason |
|---------------|------------------|--------|
| `lastAssistantText` present | `email.send`, `memory.create`, `notebook.add`, `export` | "Use the AI response" workflow |
| `dueMemoryCount > 0` | `memory.due` | Review cards |
| `activeConvId` present | `tag.set`, `bookmark.toggle`, `conversation.archive` | Operate on active conv |
| `gmailAccounts.length > 0` | `email.*` | Gmail available |
| Provider connected | `@provider` mentions | Direct send |

### 3.7 Keyboard Shortcuts v2

| Key | Surface | Action |
|-----|---------|--------|
| `⌘K` / `Ctrl+K` | Global | Open command palette |
| `/` | Composer | Trigger slash menu |
| `@` | Composer | Provider mention autocomplete |
| `#` | Composer | Tag autocomplete |
| `!` | Composer | DevOps command autocomplete |
| `~` | Composer | Context reference autocomplete |
| `?` | Palette | Show cheat sheet |
| `Escape` | Palette | Close/back |
| `↑↓` | Palette/Composer | Navigate |
| `Enter` | Palette | Execute |
| `⌘⇧Enter` | Composer | Send to all providers (compare) |
| `⌥+Enter` | ArgForm | Inject context ref |
| `e/f/p/n/t/x/b/o` | ActionRail | Quick-apply verbs |
| `⌘Z` | Global | Undo last action |
| `⌘⇧C` | Global | Copy last response |
| `⌘⇧N` | Global | New conversation |

---

## 4. Implementation Plan

### 4.1 New Files

| File | Purpose |
|------|---------|
| `src/engines/command-language/types.ts` | Extended type system (UnifiedCommandSpec, ArgSpec v2) |
| `src/engines/command-language/parser.ts` | Prefix detection + token parsing |
| `src/engines/command-language/resolver.ts` | Fuzzy command resolver with ranking |
| `src/engines/command-language/autocomplete.ts` | Live suggestion engine |
| `src/engines/command-language/registry.ts` | Unified command registry (merges palette + NLCL + capability) |
| `src/engines/command-language/args.ts` | Zod-based arg validation + context injection |
| `src/engines/command-language/slash-specs.ts` | `/` command definitions |
| `src/engines/command-language/mention-specs.ts` | `@` mention definitions |
| `src/engines/command-language/devops-specs.ts` | `!` system command definitions |
| `src/engines/command-language/context-ref.ts` | `~` reference resolution |
| `src/engines/command-language/index.ts` | Barrel exports |

### 4.2 Modified Files

| File | Change |
|------|--------|
| `src/engines/nlcl/catalog.ts` | Add prefix metadata to patterns |
| `src/engines/capability-bootstrap.ts` | Register command-language commands |
| `src/server/interpret-router.ts` | Accept prefix-commands via `/api/interpret` |
| `src/cli/index.ts` | Wire prefix commands to CLI REPL |
| `web/ui/src/ui/slots.ts` | Add palette slot for command UI |

### 4.3 Integration Points

```
CommandLanguageEngine
    ├── reads from → UnifiedCapabilityRegistry (what can I do?)
    ├── reads from → NLCL catalog (pattern matching)
    ├── reads from → CommandContext (what's the current state?)
    ├── writes to  → POST /api/interpret (execute capability)
    ├── writes to  → POST /api/capabilities/:id/execute (direct invoke)
    └── reads from → ParserStore (DB-stored parsers for live commands)
```

---

## 5. UX Flows

### 5.1 "Send email with AI response" (minimum keystrokes)

```
Type:  /send
Tab:   /send 
Type:  boss@co.io
Enter: (subject auto-filled from last prompt, body from last AI response)
Enter: Sent ✓
```

### 5.2 "Switch to Claude and ask a question"

```
Type:  @claude explain the CAP theorem
Enter: (routed to Claude provider, prompt sent)
```

### 5.3 "Tag current conversation as important"

```
Type:  #important
Enter: Tagged "important"
```

### 5.4 "Check system health"

```
Type:  !health
Enter: All systems nominal · 6 providers · 12 engines · uptime 4h32m
```

### 5.5 "Save last AI response as flashcard"

```
Type:  ~last /save #rust
Enter: Card saved · due 2026-07-26
```

### 5.6 "Open OpenCode for a coding task"

```
Type:  /opencode refactor the auth module to use JWT
Enter: Session created · prompt sent to OpenCode
```

---

## 6. Decision: Prefix vs. NLP Routing

| Approach | Pros | Cons |
|----------|------|------|
| **Prefix-first** (this spec) | Deterministic, instant, no AI needed, works offline | User must learn prefixes |
| **NLP-only** (edge-pwa approach) | Natural language, no learning curve | Slow, ambiguous, requires AI, fails on edge cases |
| **Hybrid** (recommended) | Prefix for power users, NLP fallback for casual | More complex parser |

**Recommendation:** Hybrid — prefix triggers get instant routing; plain text falls through to NLCL catalog. This gives power users sub-100ms commands while keeping natural language accessible.

---

## 7. Testing Strategy

### 7.1 Unit Tests

| Test | Coverage |
|------|----------|
| `parser.test.ts` | Prefix detection, token splitting, edge cases |
| `resolver.test.ts` | Fuzzy matching, MRU ranking, boost calculation |
| `args.test.ts` | Zod validation, context injection, suggestions |
| `context-ref.test.ts` | ~last, ~this, ~msg:ID resolution |
| `autocomplete.test.ts` | Live suggestion streaming, debounce, abort |

### 7.2 Integration Tests

| Test | Coverage |
|------|----------|
| `/send` end-to-end | Slash → arg parse → capability execute → API call |
| `@claude` mention | Mention → provider resolution → prompt routing |
| `!health` system | DevOps → capability → response formatting |
| Prefix + NLCL fallback | "/sw" resolves, plain "switch to claude" also resolves |

### 7.3 E2E Tests (Playwright)

| Test | Coverage |
|------|----------|
| Palette opens on `⌘K` | Keyboard shortcut |
| Slash menu appears on `/` | Inline autocomplete |
| `@` mentions show providers | Provider autocomplete |
| Execute and toast appears | Full round-trip |

---

## 8. Migration from edge-pwa

| edge-pwa Concept | v1 Equivalent | Notes |
|------------------|---------------|-------|
| `CommandSpec` | `UnifiedCommandSpec` | Extended with prefix, surfaces, capabilityId |
| `LiveCommand` | `UnifiedLiveCommand` | Same pattern, new type name |
| `ArgSpec` | `ArgSpec` (v2) | Added `ref`, `cron`, `duration`, `url`, `json`, `provider` kinds |
| `CommandContext` | `CommandContext` (extended) | Added `activeTags`, `recentCommands`, `sessionState` |
| `CommandPalette` | `CommandPalette` (enhanced) | Prefix-aware, inline in composer |
| `FnBridge` | Direct API calls | `POST /api/interpret` replaces HTTP bridge |
| `ActionRail` | `ActionRail` (v2) | Verb shortcuts remain, palette expands |
| `CheatSheet` | `?` prefix | Integrated into command language |
