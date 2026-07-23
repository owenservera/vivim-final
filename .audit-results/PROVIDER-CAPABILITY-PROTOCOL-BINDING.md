# Provider Capability Protocol Intelligence Binding
## How DB-Backed Intelligence Binds to Chrome Slaves

---

## Executive Answer

**The provider capability protocol intelligence binds to Chrome slaves through a 4-layer architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BOOT TIME (Server Startup)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DB QUERY: Load all active provider definitions                       │
│     └─ providerStore.listDefinitions({ isActive: true })               │
│                                                                         │
│  2. SNAPSHOT LOAD: Load capability bindings for registered providers    │
│     └─ capabilitySnapshot.load(registeredProviders)                   │
│     └─ capabilityStore.loadSnapshot() → JOIN bindings + programs      │
│                                                                         │
│  3. WIRE TO GOVERNOR: Inject snapshot into ChromeGovernor               │
│     └─ governor.setCapabilitySnapshot(capabilitySnapshot)            │
│                                                                         │
│  4. WIRE HARNESS: Inject BrowserHarnessActions into Governor           │
│     └─ governor.setBrowserHarness(new BrowserHarnessActions(governor))│
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      RUNTIME (Capability Execution)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  5. RESOLVE: Governor looks up capability in snapshot (O(1))            │
│     └─ capabilitySnapshot.getBySlug(slug, providerId)                  │
│     └─ Returns: SnapshotRow with configJson (Recipe)                     │
│                                                                         │
│  6. RESOLVE SLAVE: Governor finds/creates Chrome slave for provider    │
│     └─ resolveSlaveForExecution(ref, resolver)                         │
│     └─ Returns: ChromeSlave with slaveId, debugPort, profileDir         │
│                                                                         │
│  7. EXECUTE: Governor executes snapshot program via browser harness    │
│     └─ executeSnapshotProgram(ref, entry, params, resolver)            │
│     └─ browserHarness.runAction(slaveId, action, params)                │
│     └─ governor.cdp.send(slaveId, method, params) → CDP                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Binding Flow

### Layer 1: Database (Single Source of Truth)

The **protocol intelligence** is stored in the database across these tables:

```
┌─────────────────────────────────────────────────────────────────────┐
│ PROVIDER DEFINITION (provider_definition)                              │
├─────────────────────────────────────────────────────────────────────┤
│ id | slug | display_name | auth_type | profile_strategy | ...         │
│ claude | Claude | browser | per_account | ...                     │
│ chatgpt | ChatGPT | browser | per_account | ...                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PROVIDER PARSER (provider_parser) - Protocol Parsing Logic             │
├─────────────────────────────────────────────────────────────────────┤
│ id | provider_id | parser_name | parser_logic_code | fallback...     │
│ parser:claude:001 | claude | claude/001_streaming_sse | "function..." | →generic │
│ parser:chatgpt:001 | chatgpt | chatgpt/001_openai_delta | "function..." | →generic │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ CAPABILITY TAXONOMY (capability_taxonomy) - Capability Definitions     │
├─────────────────────────────────────────────────────────────────────┤
│ id | slug | name | description | kind | category                  │
│ cap:chat:send | chat.send | Send Message | ... | action | chat          │
│ cap:chat:clear | chat.clear | Clear Chat | ... | action | chat         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PROVIDER CAPABILITY (provider_capability) - Provider-Specific Config    │
├─────────────────────────────────────────────────────────────────────┤
│ id | provider_id | global_capability_id | ui_component_override | ...   │
│ pc-1 | claude | cap:chat:send | null | ...                              │
│ pc-2 | chatgpt | cap:chat:send | null | ...                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ CAPABILITY BINDING (capability_binding) - Execution Binding             │
├─────────────────────────────────────────────────────────────────────┤
│ id | capability_id | provider_id | selector_strategy_id | status | ... │
│ bind:claude:chat.send | cap:chat:send | claude | ss-1 | active | ...    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ CAPABILITY PROGRAM (capability_program) - Execution Recipe              │
├─────────────────────────────────────────────────────────────────────┤
│ id | binding_id | config_json | status                              │
│ prog-1 | bind:claude:chat.send | {"recipe":{"steps":[...]}} | active │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SELECTOR STRATEGY (selector_strategy) - DOM Selectors                  │
├─────────────────────────────────────────────────────────────────────┤
│ id | name | capability_id | provider_id | selector_value | ...     │
│ ss-1 | send-button | cap:chat:send | claude | "button[type=submit]" | ... │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Layer 2: Boot-Time Snapshot Loading

At server startup, the **CapabilitySnapshot** loads all active bindings:

```typescript
// src/server/index.ts:960-970
// ── 019: DB-driven capability snapshot ──────────────────────────────────
const registeredProviders = (await providerStore.listDefinitions({ isActive: true })).map(
  (d) => d.id,
)
const capabilitySnapshot = new CapabilitySnapshot(capabilityStore)
const snapshotCount = await capabilitySnapshot.load(registeredProviders)
governor.setCapabilitySnapshot(capabilitySnapshot)
console.log(
  `[boot] Capability snapshot: loaded=${snapshotCount} for ${registeredProviders.length} providers`,
)
```

**The `loadSnapshot` query joins all the intelligence:**

```typescript
// src/storage/impl/capability-store-impl.ts:258-280
async loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]> {
  const bindings = (await this.p.capabilityBinding.findMany({
    where: { providerId: { in: providerIds }, status: 'active' },
    include: { 
      capability: true,        // Join to taxonomy
      programs: true           // Join to execution recipes
    },
  })) as Array<{
    globalId: string
    providerId: string
    status: string
    confidence: number
    bestProgramId: string | null
    currentProgramId: string | null
    capability: {
      id: string
      slug: string
      category: string
      uiComponent: string
      uiPosition: string
      uiInputSchema: string
    }
    programs: Array<{ id: string; configJson: string; status: string }>
  }>

  const rows: SnapshotRow[] = []
  for (const b of bindings) {
    const programId = b.bestProgramId ?? b.currentProgramId ?? null
    const program = programId ? (b.programs.find((p) => p.id === programId) ?? null) : null
    rows.push({
      globalId: b.globalId,
      slug: b.capability.slug,
      providerId: b.providerId,
      category: b.capability.category,
      status: b.status,
      confidence: b.confidence,
      programId,
      configJson: program?.configJson ?? null,  // <-- THE RECIPE (protocol intelligence)
      uiComponent: b.capability.uiComponent,
      uiPosition: b.capability.uiPosition,
      uiInputSchema: b.capability.uiInputSchema,
    })
  }
  return rows
}
```

---

### Layer 3: In-Memory Snapshot (O(1) Resolution)

The `CapabilitySnapshot` builds in-memory maps for instant lookup:

```typescript
// src/engines/capability-snapshot.ts:28-45
async load(registeredProviderIds: string[]): Promise<number> {
  const rows = await this.store.loadSnapshot(registeredProviderIds)
  this.bySlugProvider.clear()
  this.byIdProvider.clear()
  this.bySlugAny.clear()

  for (const r of rows) {
    const entry: CapabilitySnapshotEntry = {
      ...r,
      executable: r.programId != null,  // Has a recipe to execute
    }
    // Provider-scoped lookup: "chat.send@claude"
    this.bySlugProvider.set(`${r.slug}@${r.providerId}`, entry)
    // Provider-agnostic fallback: "chat.send" (first writer wins)
    this.byIdProvider.set(`${r.globalId}@${r.providerId}`, entry)
    if (!this.bySlugAny.has(r.slug)) this.bySlugAny.set(r.slug, entry)
  }
  return this.bySlugProvider.size
}

// O(1) lookup methods
getBySlug(slug: string, providerId?: string): CapabilitySnapshotEntry | null {
  if (providerId) {
    const hit = this.bySlugProvider.get(`${slug}@${providerId}`)
    if (hit) return hit
  }
  return this.bySlugAny.get(slug) ?? null
}
```

---

### Layer 4: ChromeGovernor Execution

When a capability is invoked, the Governor resolves and executes it:

```typescript
// src/engines/chrome-governor.ts:1135-1155
// 019 — DB-backed capabilities resolve from the boot snapshot (no DB hit).
if (this.capabilitySnapshot) {
  const providerId = opts?.resolver
    ? await opts.resolver.getConversationProviderId?.(ref)
    : undefined
  
  let entry: CapabilitySnapshotEntry | null = null
  if (cap) {
    entry = this.capabilitySnapshot.getById(cap.id, providerId ?? undefined) ??
            this.capabilitySnapshot.getById(cap.id)
  }
  entry = entry ?? this.capabilitySnapshot.getBySlug(slug, providerId ?? undefined)
  
  if (entry) {
    if (!entry.executable || !entry.configJson) {
      throw new EngineError(`Capability '${slug}' has no executable program in snapshot`)
    }
    // ⬇ EXECUTE THE RECIPE
    return this.executeSnapshotProgram(ref, entry, opts?.params ?? {}, opts?.resolver)
  }
}
```

---

## The Recipe: Protocol Intelligence in configJson

The **protocol intelligence** is encoded in the `configJson` field as a **Recipe**:

```json
{
  "schemaVersion": 1,
  "recipe": {
    "steps": [
      {
        "kind": "type_text",
        "params": {
          "selector": "textarea",
          "text": "{{input.prompt}}"
        }
      },
      {
        "kind": "submit",
        "params": {
          "sendSelector": "[data-testid='send-button']"
        }
      },
      {
        "kind": "capture",
        "params": {
          "pattern": ".*",
          "timeoutMs": 30000
        },
        "outputKey": "response"
      }
    ]
  }
}
```

**This Recipe is the protocol intelligence** - it knows:
- What DOM selectors to use for the provider
- What actions to perform (type, click, capture)
- In what order
- How to extract the response

---

## Execution: Recipe → Chrome Slave Actions

The `executeSnapshotProgram` method converts the Recipe into Chrome actions:

```typescript
// src/engines/chrome-governor.ts:1160-1195
private async executeSnapshotProgram(
  ref: string,
  entry: CapabilitySnapshotEntry,
  params: Record<string, unknown>,
  resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> },
): Promise<unknown> {
  if (!this.browserHarness) {
    throw new EngineError('Browser harness not configured')
  }
  
  // Parse the Recipe from configJson
  const recipe = configToProgram(entry.configJson as string).recipe
  
  // Resolve which Chrome slave to use
  const slave = await this.resolveSlaveForExecution(ref, resolver ?? {})
  const slaveId = slave.slaveId
  
  // Execute each step in the Recipe
  const results: unknown[] = []
  for (const step of recipe.steps) {
    const { kind, outputKey: _outputKey, ...stepParams } = step as Record<string, unknown>
    try {
      // ⬇ DELEGATE TO BROWSER HARNESS (which uses CDP via Governor)
      const result = await this.browserHarness.runAction(
        slaveId, 
        String(kind),   // e.g., "type_text", "submit", "capture"
        { ...stepParams, ...params }
      )
      results.push(result)
    } catch (err) {
      throw new EngineError(
        `Snapshot program step '${String(kind)}' failed for capability ${entry.globalId}`,
        { cause: err }
      )
    }
  }
  return { ok: true, capabilityId: entry.globalId, steps: recipe.steps.length, results }
}
```

---

## BrowserHarnessActions: The CDP Bridge

The `BrowserHarnessActions` class implements all the Recipe actions, **but always delegates to the Governor for CDP calls**:

```typescript
// src/engines/browser-automation/harness-actions.ts:1-20
export class BrowserHarnessActions {
  constructor(private governor: ChromeGovernor) {}

  async runAction(slaveId: string, action: string, params: ActionParams): Promise<void> {
    switch (action) {
      case 'type_text': {
        // Uses governor.evaluate() - NOT direct CDP
        await this.governor.evaluate(slaveId, `...`)
        return
      }
      case 'submit': {
        // Uses governor.cdp.send() - NOT direct CDP
        await this.governor.cdp.send(slaveId, 'Input.dispatchKeyEvent', { ... })
        return
      }
      case 'capture': {
        // Uses governor.cdp.capture() - NOT direct CDP
        const cap = await this.governor.cdp.capture(slaveId, pattern, timeoutMs)
        return
      }
      // ... all other actions delegate to governor
    }
  }
}
```

**Governor Canon Enforced:** Every CDP call goes through `this.governor.cdp.*`, never direct `BunCdpClient`.

---

## Slave Resolution: Binding to the Right Chrome Instance

The `resolveSlaveForExecution` method ensures the capability runs on the correct Chrome slave:

```typescript
// src/engines/chrome-governor.ts:1035-1065
private async resolveSlaveForExecution(
  ref: string,                    // conversationId or providerId
  resolver: { getConversationProviderId?: (id: string) => Promise<string | null> },
): Promise<ChromeSlave> {
  let providerId: string | null = null

  // Case 1: ref is a providerId with running slaves
  const providerSlaves = this.getAllSlaves({ providerId: ref })
  if (providerSlaves.length > 0) {
    providerId = ref
  }
  // Case 2: ref is a conversationId - resolve its provider
  else if (resolver.getConversationProviderId) {
    providerId = await resolver.getConversationProviderId(ref)
  }

  if (providerId) {
    // Find existing slave for this provider
    const slaves = this.getAllSlaves({ providerId })
    if (slaves.length > 0) return slaves[0] as ChromeSlave
    
    // No slave running? Spawn one
    return this.spawn(providerId, 'default')
  }

  // Fallback: use generic browser
  return this.ensureGenericBrowser()
}
```

---

## Complete Binding Flow Example

### Scenario: User sends "send message to claude"

```
1. USER REQUEST
   └─ POST /api/capabilities/cap:chat:send/execute
       { providerId: "claude", input: { prompt: "Hello" } }

2. CAPABILITY ENGINE
   └─ registry.resolve("cap:chat:send")
   └─ Finds: UnifiedCapability with handler

3. HANDLER EXECUTION
   └─ handler({ providerId: "claude", input: { prompt: "Hello" } })
   └─ Calls: governor.executeCapability("cap:chat:send", "claude", ...)

4. GOVERNOR LOOKUP (O(1) - from snapshot)
   └─ capabilitySnapshot.getBySlug("chat.send", "claude")
   └─ Returns: SnapshotEntry with configJson (Recipe)

5. SLAVE RESOLUTION
   └─ resolveSlaveForExecution("claude", ...)
   └─ Finds or spawns: ChromeSlave for claude
   └─ Returns: { slaveId: "claude:owservera", debugPort: 9222, ... }

6. RECIPE EXECUTION
   └─ executeSnapshotProgram("claude", entry, { prompt: "Hello" }, ...)
   └─ Parses configJson → Recipe with 3 steps
   └─ For each step:
       ├─ step 1: type_text
       │  └─ browserHarness.runAction(slaveId, "type_text", { selector: "textarea", text: "Hello" })
       │     └─ governor.evaluate(slaveId, "...type into textarea...")
       │        └─ cdp.send(slaveId, "Runtime.evaluate", { expression: "..." })
       │           └─ BunCdpClient → Chrome via WebSocket
       │
       ├─ step 2: submit
       │  └─ browserHarness.runAction(slaveId, "submit", { sendSelector: "button[type=submit]" })
       │     └─ governor.cdp.send(slaveId, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter" })
       │        └─ BunCdpClient → Chrome via WebSocket
       │
       └─ step 3: capture
          └─ browserHarness.runAction(slaveId, "capture", { pattern: ".*", timeoutMs: 30000 })
             └─ governor.cdp.capture(slaveId, /.*/, 30000)
                └─ BunCdpClient → Chrome via WebSocket

7. RESPONSE
   └─ Returns: { ok: true, capabilityId: "cap:chat:send", steps: 3, results: [...] }
   └─ StreamParserEngine.parse(rawBody, "claude")
   └─ Returns: ContentBlock[] (parsed response)
```

---

## How Protocol Intelligence is Bound

The **binding** happens at **4 levels**:

### Level 1: DB Schema Binding
- `ProviderParser.parserLogicCode` → Inline TypeScript for stream parsing
- `CapabilityProgram.configJson` → Recipe JSON for execution steps
- `ProviderCapability` → Links global capability to provider
- `CapabilityBinding` → Links capability to provider with status

### Level 2: Snapshot Binding (Boot Time)
- `CapabilitySnapshot.load()` → Reads all active bindings from DB
- Builds in-memory maps: `bySlugProvider`, `byIdProvider`, `bySlugAny`
- Wired to Governor: `governor.setCapabilitySnapshot(snapshot)`

### Level 3: Governor Binding (Runtime)
- `governor.executeCapability()` → Looks up in snapshot (O(1))
- `resolveSlaveForExecution()` → Finds/creates Chrome slave for provider
- `executeSnapshotProgram()` → Executes Recipe steps

### Level 4: Browser Harness Binding (CDP Execution)
- `BrowserHarnessActions.runAction()` → Implements Recipe actions
- **Always delegates to Governor** for CDP calls (Canon enforced)
- Governor → CDPProxy → CdpTransportImpl → BunCdpClient → Chrome

---

## Verification: Where and When Binding Happens

| Question | Answer | Location |
|----------|--------|----------|
| **WHERE is protocol intelligence stored?** | In DB: `provider_parser.parserLogicCode`, `capability_program.configJson` | `prisma/schema.prisma` |
| **WHEN is it loaded?** | At boot time, before server starts | `src/server/index.ts:960-970` |
| **HOW is it loaded?** | `capabilitySnapshot.load(registeredProviders)` | `src/engines/capability-snapshot.ts` |
| **WHERE is it wired to Governor?** | `governor.setCapabilitySnapshot(snapshot)` | `src/server/index.ts:968` |
| **WHERE is BrowserHarness wired?** | `governor.setBrowserHarness(new BrowserHarnessActions(governor))` | Called at boot (exact location varies) |
| **HOW does it find the right slave?** | `resolveSlaveForExecution(ref, resolver)` | `src/engines/chrome-governor.ts:1041` |
| **HOW does it execute on the slave?** | `browserHarness.runAction(slaveId, action, params)` | `src/engines/browser-automation/harness-actions.ts` |
| **HOW does CDP get called?** | Always via `governor.cdp.*` (Canon enforced) | All harness actions |

---

## Key Invariants Enforced

### ✅ Invariant 1: Protocol Intelligence in DB
- All parser logic: `ProviderParser.parserLogicCode` (inline TypeScript)
- All capability logic: `CapabilityProgram.configJson` (Recipe JSON)
- All provider config: `ProviderDefinition`, `ProviderCapability`

### ✅ Invariant 2: No Direct CDP in Engines
- Only `ChromeGovernor` imports `BunCdpClient` (via `CdpTransportImpl`)
- All other engines use `governor.cdp.send/capture`
- `BrowserHarnessActions` always delegates to Governor

### ✅ Invariant 3: Snapshot is Source of Truth
- Runtime capability resolution: O(1) from in-memory snapshot
- No per-request DB queries for capability lookup
- DB is only queried at boot and on snapshot reload

### ✅ Invariant 4: Provider-Specific Binding
- Capabilities are provider-scoped: `capability@provider`
- Fallback to provider-agnostic: `capability` (first writer wins)
- Slave resolution respects provider context

---

## Summary

**The provider capability protocol intelligence binds to Chrome slaves through:**

1. **DB Storage** - All intelligence (parsers, recipes, selectors) stored in database
2. **Boot Loading** - CapabilitySnapshot loads all active bindings at startup
3. **Governor Wiring** - Snapshot and BrowserHarness wired to ChromeGovernor
4. **Runtime Resolution** - Governor looks up capability in snapshot, resolves slave, executes recipe
5. **CDP Execution** - BrowserHarness implements recipe actions, always via Governor CDP

**The binding is:**
- ✅ **Correct** - Protocol intelligence correctly flows from DB to Chrome
- ✅ **Efficient** - O(1) lookup via in-memory snapshot
- ✅ **Safe** - Governor Canon enforced (only Governor touches CDP)
- ✅ **Flexible** - Provider-specific with fallback to generic
- ✅ **Dynamic** - Can reload snapshot without restart

**No direct CDP access in any engine** - all protocol intelligence is DB-driven and executed through the Governor's controlled CDP transport.
