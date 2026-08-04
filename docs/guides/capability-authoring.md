# Capability Authoring Guide

> **Scope:** How to add, register, and wire new `UnifiedCapability` entries for any surface.  
> **Source:** Lessons distilled from the 10x Provider Upgrade session (2026-08-01).

---

## The One Entry Point Invariant

Every operation in vivim must be a `UnifiedCapability`. CLI commands, UI actions, MCP tools,
and API endpoints are **thin shells** that all route to:

```
POST /api/interpret → POST /api/capabilities/:id/execute
```

Never hand-write a CLI command, UI action, or API route that bypasses the registry.

---

## Where Capabilities Live

| Location | Purpose |
|----------|---------|
| `src/engines/capability-bootstrap.ts` | Core system capabilities (conversation, memory, session) |
| `src/engines/capability-bootstrap-generated.ts` | Auto-generated from taxonomy pool (196 caps) |
| `src/engines/provider-caps.ts` | Provider-specific capabilities (Claude, ChatGPT, Gemini) |
| `src/engines/session-caps.ts` | Session-scoped capabilities |
| `src/engines/command-parity-capabilities.ts` | CLI parity shims |
| `devops/llm-testing/capabilities.ts` | LLM test suite capabilities |

**Rule:** When adding provider-specific capabilities, put them in `provider-caps.ts`, not in
`capability-bootstrap.ts`. Keep the bootstrap file focused on system-level concerns.

---

## `makeCapability` Signature

```ts
import { makeCapability } from './capability-bootstrap.js'

makeCapability(
  {
    id: 'cap:<category>:<action>',      // REQUIRED — format is strict
    slug: '<category>_<action>',         // snake_case, no colons
    name: 'Human Readable Name',
    description: 'One sentence.',
    category: 'llm' | 'conversation' | 'agent' | 'memory' | 'system' | ...,
    inputSchema: { type: 'object', properties: { ... } },
    outputSchema: { type: 'object' },
    cliCommand: {
      name: 'verb noun',               // multi-word supported
      aliases: ['short-alias'],
      examples: ['verb noun --flag value'],
    },
    ui: {
      component: 'toggle_switch' | 'action_button' | 'text_input' | 'dropdown_selector',
      position: 'header' | 'sidebar' | 'composer',
      order: number,
    },
    mcpToolName: 'snake_case_name',
    apiEndpoint: { method: 'POST' | 'GET', path: '/api/...' },
    surfaces: ['cli', 'ui', 'api', 'mcp'],  // default: all
  },
  async (input: unknown) => {
    // handler — validate input, return output
    return { ok: true, ... }
  },
)
```

### ID Format Rules

```
cap:<category>:<action>        ← correct
cap:claude:extended_thinking   ← correct
cap:gemini:grounded_search     ← correct
cap:undefined:help             ← WRONG — single-segment slug
cap:gemini_send                ← WRONG — no second colon
```

For single-segment slugs use `cap:<slug>:<slug>` (e.g. `cap:help:help`).

---

## Registering Provider Capabilities

**Step 1:** Add to `src/engines/provider-caps.ts`:

```ts
export function registerProviderCapabilities(registry: UnifiedCapabilityRegistry): void {
  const caps: UnifiedCapability[] = [
    makeCapability({ id: 'cap:myProvider:myAction', ... }, async (input) => { ... }),
  ]
  for (const cap of caps) registry.register(cap)
}
```

**Step 2:** Wire into `src/server/index.ts` (after `registerDefaultCapabilities`):

```ts
const { registerProviderCapabilities } = await import('../engines/provider-caps.js')
registerProviderCapabilities(registry)
```

**Step 3:** Add NL patterns to `src/engines/nlcl/catalog.ts` in the `providerCapPatterns` array.

**Step 4:** Add to `getDefaultCommandPatterns()` export list:

```ts
return [
  ...existingPatterns,
  ...providerCapPatterns,  // already done — just add to this array
]
```

---

## NL Catalog Pattern Template

```ts
pattern(
  'provider.action',            // unique dot-scoped id
  'provider.action_intent',     // intent slug
  'One sentence describing what this does',
  {
    patterns: [
      {
        regex: /verb\s+noun\s*(value)?/i,
        priority: 14,            // 14 = very specific; 10 = general; 8 = broad
        keywords: ['verb', 'noun'],
        extract: (m) => ({ param: m[1] ?? 'default' }),
      },
    ],
    aliases: ['shortform'],
    examples: ['verb noun value', 'shortform'],
    inputSchema: z.object({ param: z.string() }),
    executor: 'provider',        // matches the capability surface
    category: 'llm',
    classification: 'write' | 'read',
    capabilityId: 'cap:provider:action',
    execute: async () => ({}),   // stub — real execution goes through registry
  },
),
```

### Priority Guide

| Priority | Use when |
|----------|---------|
| 15+ | Exact command match (e.g. `claude artifact export art_123 ./file.ts`) |
| 13-14 | Specific regex with named capture groups |
| 11-12 | General intent phrase with optional parameters |
| 8-10 | Broad fallback pattern |

---

## Cross-Surface Parity Checklist

Every new capability should have entries on all 4 surfaces:

| Surface | How | Check |
|---------|-----|-------|
| **CLI** | `cliCommand.name` + `aliases` in `makeCapability` | `bun run devops verify-cross-surface` |
| **API** | `apiEndpoint.method` + `path` | `curl -X POST /api/capabilities/<slug>/execute` |
| **MCP** | `mcpToolName` in `makeCapability` | Listed in `mcpServer.getTools()` |
| **UI** | `ui.component` + `ui.position` | Visible in canvas action bar or header |
| **NL** | `capabilityId` in `catalog.ts` pattern | `bun run devops runtime-test test --nl="..."` |

Run after adding any capability:
```bash
bun run devops verify-cross-surface
```

---

## Handler Best Practices

```ts
async (input: unknown) => {
  // 1. Validate with Zod at the boundary
  const parsed = MySchema.safeParse(input)
  if (!parsed.success) throw new Error(`Invalid input: ${parsed.error.message}`)
  const { param } = parsed.data

  // 2. Use governor for any CDP operations (never import BunCdpClient directly)
  // const result = await governor.execute(...)

  // 3. Return structured output matching outputSchema
  return { ok: true, result: ... }
}
```

### Governor Canon (Critical)

Only `ChromeGovernor` touches CDP. A capability handler must:
- **Call `governor.execute()`** for any browser interaction
- **Never** import `BunCdpClient` or `ChromeSlave` directly
- **Never** open a WebSocket to Chrome from inside a handler

---

## Seeding Capabilities into the DB

Provider capabilities in `provider-caps.ts` are **in-memory registry registrations** — they
don't need DB seeding. The `UnifiedCapabilityRegistry` is rebuilt from code on every boot.

DB seeding is only needed for:
- `ProviderCapabilityRow` — capability metadata stored per-provider for the UI override system
- `HarnessCommand` — versioned CDP programs
- `ProviderStreamConfig` — stream transport declarations

---

## Anti-Patterns

| ❌ Don't | ✅ Do instead |
|----------|--------------|
| Add capabilities directly to `capability-bootstrap.ts` for provider features | Use `provider-caps.ts` |
| Use `cap:undefined:<slug>` for single-word caps | Use `cap:<slug>:<slug>` |
| Skip the `execute` stub in catalog patterns | Always include `execute: async () => ({})` |
| Add a CLI command that doesn't go through `/api/interpret` | Register as a `UnifiedCapability` with surface `['cli']` |
| Hardcode surface lists | Use `surfaces: ['cli', 'ui', 'api', 'mcp']` or omit (defaults to all) |
| Re-register the same slug from two files | Check for alias collisions — registry warns and skips duplicates |
