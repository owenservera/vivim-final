# OpenClaw Capability-Ownership → vivim Translation

**Harvest Step:** C (capability-ownership model translation)
**Status:** ✅ DONE (2026-07-19) | **Confidence:** High | **Source:** `openclaw-sota-2026.md` §Plugin/Capability Model

This code-path documents how OpenClaw's `PluginRegistry` capability-ownership
model maps onto vivim's existing engine contracts. It is a **structural
translation guide** — no code is lifted from OpenClaw (supply-chain risk; see
`openclaw-harvest-path.md` Known Gotchas). The intent is to validate that
vivim's contracts already implement the same ownership-boundary philosophy and
to record the precise correspondences for future engine work.

## Core Equivalence

| OpenClaw concept | vivim target | Notes |
|------------------|--------------|-------|
| `PluginRegistry` (lifecycle owner) | `UnifiedCapabilityRegistry` (`src/engines/unified-registry.ts`) | Single registry; every capability defined once, auto-exported to all surfaces |
| plugin = ownership boundary for a *company*/*feature* | `cap:category:action` slug namespace + `providerId` binding | vivim binds capabilities to providers via `CapabilityBinding` rows, not free-floating |
| `api.registerProvider` (vendor multi-capability) | `ProviderRegistrar` 2-pass wiring (`src/engines/provider-registrar.ts`) | vendor owns many capabilities; registrar wires them per provider |
| `api.registerTool(name, def)` | `registerDefaultCapabilities` → `makeCapability` (`src/engines/capability-bootstrap.ts`) | one `UnifiedCapability` node per tool/feature |
| manifest-first control plane | `capability-bootstrap.ts` boot snapshot | manifest/seed is source of truth; runtime is data-plane |
| "consume shared capability instead of re-implementing vendor behavior" | `CapabilityResolutionEngine` (`src/engines/capability-resolution.ts`) | resolves shared capability UI contracts per provider; overrides global→tier→provider |
| slot-kind `memory`/`context-engine` = at-most-one plugin per slot | `surfaces` parity contract + `CapabilityBinding` active-set | vivim enforces one active binding per (provider, capability); resolution returns single `ResolvedCapability` |
| safety gates **before** runtime execution (reject unsafe candidates) | `ProviderRegistrar` 2-pass + DB-only parser logic + store contracts | gates run before CDP execution; never executes untrusted code |

## Ownership-Boundary Patterns (verified 1:1)

### 1. Vendor multi-capability (e.g. `openai` owns text+speech+realtime+image)
OpenClaw: one plugin registers many capability types.
vivim: `ProviderRegistrar.registerProvider(providerId)` wires N capabilities;
each becomes a `cap:<cat>:<action>` node bound to that `providerId` via
`CapabilityBinding`. The provider *is* the ownership boundary.

### 2. Vendor single-capability (e.g. `elevenlabs` = speech)
OpenClaw: narrow plugin, one capability type.
vivim: a provider seed (`seeds/providers/<slug>.json`) declares only the
capabilities it owns (e.g. `deepseek` → `send_message` only, no parser yet).

### 3. Feature plugin consumes shared capability (e.g. `voice-call` owns transport,
consumes shared speech)
OpenClaw: feature plugin does NOT import vendor plugins directly; it consumes
the shared `speech` capability.
vivim: `CapabilityResolutionEngine.resolve()` returns the **single active
binding** for a capability on a provider — callers never re-implement vendor
behavior, they resolve the shared contract. This is the exact same "consume
shared, don't re-implement" rule.

## Slot-Kind → vivim Contract Mapping

OpenClaw slot-kinds (`memory`, `context-engine`) enforce **at-most-one** plugin
per slot. vivim achieves the same with:

- `CapabilityBinding` has an `active`/`status` field; resolution returns the one
  active binding per (provider, capability) — `capability-resolution.ts`
  `ResolvedCapabilities` is a single object per slot, not a list of competing
  implementations.
- `surfaces: ['cli','ui','api','mcp','workflow']` parity (AGENTS.md invariant:
  "One Entry Point") replaces OpenClaw's per-plugin surface registration.

## Boot / Load Pipeline Parity

| OpenClaw startup | vivim startup |
|------------------|--------------|
| discover candidate roots | `ProfileAllocator` resolves `chrome-profiles/<provider>/<account>` |
| reject unsafe (path escape, world-writable, ownership mismatch) | DB-only parser logic + store-contract boundary (no file logic) |
| normalize config | `ConfigManager` |
| call `register(api)` | `registerDefaultCapabilities(registry, services)` + `capability-bootstrap-generated.ts` |
| expose registry | `UnifiedCapabilityRegistry` ready for CLI/UI/API/MCP dispatch |

## What Was Already Done (Steps A/B)

- **Step A:** `taxonomy.yaml` parsed → `seeds/taxonomy/openclaw-harvest.json`
  (3,695 nodes). OpenClaw areas/categories/features/coverageIds became vivim
  `taxonomy_term` + `capability` nodes.
- **Step B:** merged into master pool → 3,921 nodes; `verify-cross-surface`
  3548/3548 pass. The harvested capabilities now flow through the SAME
  `UnifiedCapabilityRegistry` + `CapabilityResolutionEngine` contracts described
  above, proving the ownership model transfers cleanly.

## Recommendations (non-blocking, for future engine work)

1. **Provider-owned capability namespaces:** the harvested `oc_*` slugs already
   namespace by OpenClaw area; if any OpenClaw vendor (e.g. `qwen`) maps to a
   vivim provider, bind via `ProviderRegistrar` exactly like native caps.
2. **At-most-one enforcement:** if a future capability needs OpenClaw's
   slot-kind exclusivity, reuse `CapabilityBinding.active` + resolution
   single-result (already implemented) rather than adding a new gate.
3. **Consume-shared rule:** keep `CapabilityResolutionEngine` as the ONLY path to
   vendor behavior; do not let feature caps import provider internals (mirrors
   OpenClaw's `voice-call` pattern).

## Verification

- Structural: every OpenClaw ownership concept has a vivim contract (table above).
- Empirical: 3,352 OpenClaw-derived capabilities pass `verify-cross-surface`
  (3548/3548, exit 0) through the exact registry/resolution pipeline.
- No OpenClaw executable code imported; only structure + taxonomy corpus.
