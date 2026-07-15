# 08 — Resolution & Routing Protocol

How an inbound request is *resolved* to the thing that gets injected/executed.

## vivim-final: NLCL interpret → capability resolve → execute

Entry flow (the "One Entry Point" invariant):

```
NL phrase
   │  catalog.ts (deterministic regex/keyword)
   ▼
CommandPattern { intent, executor, capabilityId }
   │  NLCLEngine.resolve
   ▼
UnifiedCapability (by id/slug)
   │  POST /api/interpret
   ▼
registry.execute(id, input, ctx)
   │  handler
   ▼
engine work (e.g. CapabilityEngine.execute → governor.cdp)
```

Resolution is **layered** (`nlcl/layered-resolver.ts`, `intent-resolver`,
`semantic-resolver`, `llm-slave-resolver`): deterministic first, AI fallback. The
resolved target is a **code capability** in the registry. Parameter extraction
(`parameter-extraction.ts`) fills the `inputSchema`.

Key property: **resolution returns a registered code object**, then its `handler`
runs. The kernel already *knows* the capability (it was injected at bootstrap).

## cap-store (OG): verb → taxonomy → bindings fan-out

Entry flow (router):

```
verb
   │  slugify → taxonomyId
   ▼
getTaxonomy(tid)
   │  listBindings({ global_id: tid })
   ▼
resolveTargets(filter)   // '*' | 'all-stable' | 'all-ready' | [providers]
   │  per binding: getProgram(best_program_id) + shouldEscalate
   ▼
ResolvedDispatch { bindings[], programs[] }
   │  dispatch → plan (or executeBinding → CDP)
   ▼
outcome recorded + WS delta published
```

Resolution is **data lookup + fan-out**: one verb may resolve to *many* provider
bindings, each executed (or planned). `dispatch` returns a plan; real execution is
performed by the host that owns the CDP/recipe executor (`executeBinding`).

Key property: **resolution returns DB rows discovered at call time**, possibly many
targets. There is no NL layer — the caller supplies the `verb` (often the SDK/frontend
does).

## Contrast

| | vivim-final | cap-store (OG) |
|---|---|---|
| Trigger | NL phrase (or API) | `verb` string |
| Resolver | layered (deterministic → AI) | taxonomy lookup + target filter |
| Target | one registered code capability | 0..N provider bindings (fan-out) |
| Where defined | catalog + registry (bootstrap) | taxonomy/binding rows (DB) |
| Fan-out | single capability | many bindings per verb |
| AI use | resolver fallback (intent) | none in routing |

## Takeaway

vivim-final resolves **intent → one capability** through a smart, NL-first resolver.
cap-store resolves **verb → many bindings** through a flat data fan-out. The fan-out
model is valuable for *provider coverage* (one action, all providers); the NL resolver
is valuable for *human entry*. Synthesis: keep cap-store's fan-out as the execution
fan-out behind a vivim-final capability's `handler`, and keep the NLCL as the human
front door.
