# Provider Upgrade Checklist

> **Scope:** Step-by-step checklist for safely upgrading a vivim provider: parser, stream config,
> capabilities, and NL patterns.  
> **Source:** 10x Provider Upgrade session (2026-08-01). Apply this any time a provider needs
> an upgrade, onboarding, or deep repair.

---

## Pre-Flight (5 minutes)

Before touching any code, gather current state:

```bash
# Health check
bun run devops runtime-test health

# Provider-specific status
bun run devops runtime-test status --provider=<slug>

# Run the 8-phase onboarding to see what passes/fails
bun run devops runtime-test onboard --provider=<slug>
```

Then read these files to understand what currently exists:

- [ ] `seeds/providers/<slug>.json` — provider manifest
- [ ] `seeds/parsers/harvested/<slug>-*.ts` — current parser(s)
- [ ] Grep `provider-protocol.ts` for `slug: '<slug>'` — capabilities and stream configs
- [ ] `src/engines/provider-selectors.ts` — composer/send-button selectors
- [ ] `src/engines/composer-typing.ts` — DOM injection strategy

---

## Audit Dimensions

For each dimension, note current state and target state:

### 1. Parser Audit

| Check | Current | Target |
|-------|---------|--------|
| Wire format handled? | e.g. SSE partial | All frames |
| Multi-block output correct? | returns `blocks[0]` | returns `blocks` |
| Thinking/reasoning captured? | No | `reasoning` blocks |
| Tool calls captured? | No | `tool-call` blocks |
| Files/images captured? | No | `file` blocks |
| Completion detection correct? | — | — |
| Confidence scoring calibrated? | — | Returns 1 for canonical |
| Parser version current? | v1 | v2 after change |

### 2. Stream Config Audit

```ts
// In provider-protocol.ts, find:
streamConfigs: []  ← PROBLEM — empty means generic detection only

// Should be:
streamConfigs: [{ id: 'psc-<slug>-<format>', stream_transport: '...', ... }]
```

- [ ] `streamConfigs` is non-empty for this provider
- [ ] `stream_transport` matches actual wire format (`sse` / `batchexecute` / `websocket`)
- [ ] `sse_format` is set for SSE providers (`openai` / `anthropic`)
- [ ] `completion_detectors_json` lists all terminal signals
- [ ] Entry exists in `STREAM_CONFIGS` array in `harvest.seed.ts`

### 3. Capability Audit

```bash
# List registered capabilities for provider
bun run devops runtime-test status --provider=<slug>
```

Expected minimum capability set per provider:

| Provider | Must Have | Nice to Have |
|----------|-----------|--------------|
| Claude | `send_message`, `select_model` | `extended_thinking`, `extract_artifacts` |
| ChatGPT | `send_message`, `select_model` | `canvas_sync`, `toggle_web_search` |
| Gemini | `send_message`, `select_model` | `grounded_search`, `python_sandbox` |

- [ ] All required capabilities registered
- [ ] Each has `surfaces: ['cli', 'ui', 'api', 'mcp']`
- [ ] Each has `cliCommand`, `ui`, `mcpToolName`, `apiEndpoint`
- [ ] NL patterns added to `catalog.ts`

### 4. Selector Audit

Check each selector in the browser against a live session:

```bash
bun run devops runtime-test onboard test-selectors --provider=<slug>
```

- [ ] Composer selector resolves to the correct element
- [ ] Send button selector resolves
- [ ] Correct `composerType`: `textarea` | `contenteditable` | `quill` | `codemirror`

**Provider-specific gotchas:**
- **Gemini:** Quill editor — must use `quill.insertText()` not `insertText` execCommand
- **Claude:** ProseMirror — use `Input.insertText` CDP method
- **ChatGPT:** `textarea` — standard value + React synthetic event

---

## Implementation Steps

### Step 1: Fix Parser Bugs

Edit `seeds/parsers/harvested/<slug>-<format>.ts`:

```ts
// Template for a correct multi-block parse function:
function parse(rawBody) {
  const blocks = [];
  // ... parsing logic ...
  if (blocks.length === 0 && rawBody.length > 0) {
    blocks.push({ type: 'text', text: rawBody }); // always return something
  }
  return blocks;
}
```

**Bump version in `module.exports.default` every time you change logic.**

### Step 2: Add/Update Stream Config

In `seeds/parsers/harvest.seed.ts`, add to `STREAM_CONFIGS`:

```ts
{
  id: 'psc-<slug>-<transport>',
  provider_id: '<slug>',
  stream_transport: 'sse' | 'batchexecute',
  stream_terminal_json: JSON.stringify(['[DONE]']),  // or terminal frames
  sse_format: 'openai' | 'anthropic' | null,
  delta_path_json: JSON.stringify([...]),             // path to text delta
  completion_detectors_json: JSON.stringify([...]),   // terminal signal strings
  harness_js: null,
  is_active: 1,
  version: 1,
  superseded_by: null,
  created_at: Date.now(),
  updated_at: Date.now(),
}
```

Confirm `seedStreamConfigs` is called in `src/server/index.ts` boot sequence:

```ts
const { seedHarvestedParsers, seedStreamConfigs } = await import('../../seeds/parsers/harvest.seed.js')
const harvested = await seedHarvestedParsers(providerStore)
const streamConfigs = await seedStreamConfigs(providerStore)
```

### Step 3: Add New Capabilities

In `src/engines/provider-caps.ts`:

```ts
makeCapability(
  {
    id: 'cap:<slug>:<action>',
    slug: '<slug>_<action>',
    name: 'Human Name',
    description: 'One sentence.',
    category: 'llm',
    inputSchema: { ... },
    outputSchema: { type: 'object' },
    cliCommand: { name: 'verb noun', aliases: [], examples: [] },
    ui: { component: 'toggle_switch', position: 'header', order: N },
    mcpToolName: '<slug>_<action>',
    apiEndpoint: { method: 'POST', path: '/api/providers/<slug>/<action>' },
  },
  async (input) => { return { ok: true } },
)
```

### Step 4: Add NL Patterns

In `src/engines/nlcl/catalog.ts`, add to `providerCapPatterns`:

```ts
pattern(
  '<slug>.<action>',
  '<slug>.<action>_intent',
  'Description',
  {
    patterns: [{ regex: /.../, priority: 13, keywords: [...], extract: (m) => ({...}) }],
    aliases: [],
    examples: [],
    inputSchema: z.object({ ... }),
    executor: 'provider',
    category: 'llm',
    classification: 'write',
    capabilityId: 'cap:<slug>:<action>',
    execute: async () => ({}),
  },
),
```

### Step 5: Regenerate Protocol (if needed)

```bash
bun run gen:protocol
```

Only needed if you changed provider manifests, capabilities, or parsers in ways that should
be reflected in the static `provider-protocol.ts` file.

---

## Verification Gates

Run after each implementation step:

```bash
# After parser changes
bun run devops runtime-test onboard test-parse --provider=<slug>

# After stream config changes (restart server first)
bun run dev  # check logs for "Seeded provider stream configs: 3"

# After capability changes
bun run devops verify-cross-surface

# After NL pattern changes
bun run devops runtime-test test --nl="<phrase from examples>"

# Full onboarding pipeline
bun run devops runtime-test onboard --provider=<slug>

# Invariant compliance
bun run devops invariants check
```

---

## Provider-Specific Upgrade Notes

### Claude

| Feature | Where |
|---------|-------|
| Thinking blocks | `content_block_start.type === 'thinking'` → `reasoning` block |
| Thinking text delta | `content_block_delta.delta.type === 'thinking_delta'` |
| Signature delta | `delta.type === 'signature_delta'` → attach to reasoning block as `.signature` |
| Artifact extraction | On `content_block_stop`, regex-scan text for `<antArtifact>` tags |
| Extended thinking toggle | Cap `cap:claude:extended_thinking` with `budgetTokens` param |

### ChatGPT

| Feature | Where |
|---------|-------|
| Patch frames | `data.o === 'patch'` → collect `/message/content/parts/N` appends |
| Add frames | `data.o === 'add'` → full content snapshot, use `fromParts()` |
| DALL-E output | Part with `asset_pointer` field → `file` block |
| Code Interpreter output | `data.type === 'tool_output'` or `data.name === 'code_interpreter'` |
| Canvas sync | Cap `cap:chatgpt:canvas_sync` → CDP scrape canvas content |
| Web search toggle | Cap `cap:chatgpt:toggle_web_search` → click toggle in composer area |

### Gemini

| Feature | Where |
|---------|-------|
| XSSI prefix | Strip `)]}\'\n` before JSON parsing |
| Frame detection | `child[0] === 'wrb.fr'` in each line array |
| Payload decode | `child[2]` is double-encoded JSON — `safeJsonParse(child[2])` |
| Text delta path | `payload[4][0][1]` → `payload[3][0][0]` fallback |
| Grounding links | Non-text payload sections with `[url, title]` pairs |
| Terminal frame | `child[0] === 'e'` — skip text extraction |
| Stream transport | `batchexecute` (NOT `sse`) |
| Composer | Quill editor — `quill.insertText()` not `insertText` execCommand |

---

## Done Definition

A provider upgrade is complete when:

- [ ] All `bun run devops runtime-test onboard --provider=<slug>` phases pass
- [ ] `streamConfigs` is non-empty in the generated protocol
- [ ] Parser `getConfidence(realWireFixture)` returns `1`
- [ ] Multi-block responses return all blocks (not just first)
- [ ] All new capabilities appear in `bun run devops verify-cross-surface`
- [ ] NL phrases resolve to the correct capability ID
- [ ] `bun run devops invariants check` passes
- [ ] No new TypeScript errors in the engine files you touched
