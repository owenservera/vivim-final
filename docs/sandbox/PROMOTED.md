# Capability Promotion Ledger

Sandbox-proven bespoke renderers are promoted into `web/ui/src/registry/`.
The sandbox always falls back to the generic contract-driven renderer
(`web/sandbox/src/features/generic-capability-renderer.tsx`) for any slug
without a bespoke entry.

| Slug | Status | Component Path | Best Practice Note |
|------|--------|----------------|-------------------|
| `capability.execute` | generic | `web/ui/src/registry/index.ts` (generic fallback) | All execution funnels through `ActionRegistry` (`capability.execute`); agents perform the same step via `agent:command`. Never call `fetch` directly from a button. |

## Promotion process

1. Iterate on a harness in `web/sandbox/src/features/harnesses/` (scaffold via `bun run sandbox new <slug>`).
2. Codify the best practice discovered during iteration into the note column above.
3. When a bespoke renderer is warranted, register it in `CapabilityRegistry` and add a row here.

## B8 parity

Every action a human can trigger in the sandbox is an entry in `ActionRegistry`.
The agent reaches the identical action through the `agent:command` WebSocket
message, so no human-only action exists.
