# 04 — Capability Registration & Injection

How a *capability* is defined, registered into the system, and made available.

## vivim-final: one code object, five surfaces

### The capability is a code object

`UnifiedCapability` (`unified-registry.ts`):

```ts
interface UnifiedCapability {
  id: string
  slug: string
  name: string
  description: string
  category: string
  surfaces: CapabilitySurface[]            // 'cli'|'ui'|'workflow'|'mcp'|'api'
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  handler: (input, ctx) => Promise<unknown>
  cliCommand?: { name; aliases; examples }
  ui?: { component; position; group?; order; icon?; shortcut?; requiresConfirmation? }
  uiAction?: { component; position; order }
  workflowNodeType?: string
  mcpToolName?: string
  apiEndpoint?: { method; path }
  isAsync: boolean
  requiresConfirmation: boolean
  tags: string[]
}
```

### Registration is validation + index

`UnifiedCapabilityRegistry.register(cap)`:

1. `validateCapability` — throws unless id/slug/name/handler present, and enforces
   **surface parity**: a capability exposed to `cli` *must* carry `cliCommand`; to
   `mcp` → `mcpToolName`; to `api` → `apiEndpoint`; to `ui` → `ui` or `uiAction`.
2. Indexes by `id` and by `slug`.

This is **static, fail-fast injection**: a misconfigured capability cannot register.

### One definition → auto-export to all surfaces

The registry emits surface-specific views from the same object:

- `exportForCli()` → CLI command specs
- `exportForMcp()` → MCP tool specs
- `exportForUi()` → UI component slots

So a capability is *injected once* and *surfaced everywhere*. This is the "One Entry
Point" invariant made concrete: every operation is a `UnifiedCapability`, and
CLI/UI/workflow/MCP/API are thin projections of it.

### NLCL catalog binds NL → capability

`catalog.ts` defines deterministic regex command patterns; each binds to a
`capabilityId`. The NLCL engine resolves a phrase to a command, then to a capability,
then executes it. NL is a *first-class injection channel* into the same registry.

### Kernel sees capabilities as graph nodes

`bootstrapKernel` registers each NLCL command as a `CapabilityDescriptor` in
`KernelRegistry` with `dependencies: ['nlcl-engine']`. Capabilities are visible to
the kernel graph and the oracle.

## cap-store (OG): data rows resolved at execute time

### The capability is persisted data

There is **no capability code object**. Instead a three-layer data model:

```
taxonomy (global / verb)
   └─ ProviderBinding { provider_id, best_program_id, status, confidence_inputs }
         └─ ActionProgram { steps: [click|type|wait|navigate|arm] }
```

- `router/resolve`: `verb` → `taxonomyId(slug)` → `getTaxonomy` → `listBindings` →
  `resolveTargets` (`*` / `all-stable` / `all-ready` / explicit providers).
- `executor/executeBinding`: loads `binding` → `provider` → `program(best_program_id)`
  → converts program to `Recipe` → runs it.

### Registration = writing rows

A capability is "registered" by **inserting taxonomy/binding/program rows** (via
`db` mutations and seed scripts), not by calling a registry. There is no validation
that a binding is well-formed before execution — failure surfaces at `executeBinding`
(`NotFoundError` if binding/program missing).

### Surface exposure is fixed

Only two surfaces exist: REST (`createServer`/`handle`) and WebSocket
(`publish`/`publishStreamBlock`), plus an SDK client that wraps HTTP. There is no
cli/ui/mcp/workflow projection because the capability is data, not a typed object
with surface blocks.

### Confidence gates the binding, not the call

`shouldEscalate` (from `confidence.ts`) decides, per binding, whether the dispatch
should be `escalated`. This is computed when resolving, not at registration.

## Contrast

| | vivim-final | cap-store (OG) |
|---|---|---|
| Unit | typed code object w/ handler | DB rows (taxonomy/binding/program) |
| Registration | `registry.register()` + validation | insert rows / seed scripts |
| When validated | at register (fail-fast) | at execute (throw if missing) |
| Surfaces | 5, auto-exported from one def | 2 (REST/WS) + SDK |
| NL channel | first-class (catalog → capabilityId) | none (verb routing only) |
| Visibility to meta-layer | graph node in KernelRegistry | not visible (data in DB) |

## Takeaway

vivim-final's capability injection is **typed, validated, multi-surface, and
kernel-visible**. cap-store's is **data-driven, late-bound, two-surface, and
invisible to any meta-layer**. The strongest idea to borrow from vivim-final is
**surface-parity validation at registration**; the strongest idea to borrow from
cap-store is **late-bound program data that changes behaviour without redeploys**.
