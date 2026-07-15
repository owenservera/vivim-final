# 07 — Surface Exposure Protocol

How a registered capability becomes *reachable* from outside the process.

## vivim-final: one definition, five auto-projected surfaces

A `UnifiedCapability` declares `surfaces: CapabilitySurface[]` and the matching export
block. The registry then emits surface-specific specs:

- **cli** — `exportForCli()` → `{ name, aliases, description, schema }` (built from
  `cliCommand`).
- **ui** — `exportForUi()` → `{ id, slug, name, ui, inputSchema, apiEndpoint,
  requiresConfirmation }` (drives component slots).
- **mcp** — `exportForMcp()` → `{ name, description, inputSchema }` (built from
  `mcpToolName`).
- **api** — `apiEndpoint: { method, path }` (e.g. `POST /api/capabilities/:id/execute`).
- **workflow** — `workflowNodeType` for the workflow compiler.

The **"One Entry Point" invariant** makes this mandatory: every operation is a
`UnifiedCapability`; CLI/UI/frontend/MCP/API are *thin NL shells* projecting it. NL
phrases hit `POST /api/interpret` → resolve → `POST /api/capabilities/:id/execute`.

Surface **parity is enforced at registration** (`validateCapability` throws if a
surface is claimed without its block). This guarantees no surface is accidentally
unimplemented.

## cap-store (OG): two fixed surfaces + SDK

cap-store exposes capabilities through:

- **REST** — `createServer` / `handle` (e.g. `executeBinding` over HTTP).
- **WebSocket** — `publish` / `publishStreamBlock` / `publishStreamDone` stream
  execution blocks and deltas to subscribers.
- **SDK** — `sdk/src/client.ts` wraps the HTTP surface for external consumers
  (the "frontend" is a separate `frontend/` Vite app talking to the WS/REST API).

There is no cli/mcp/workflow projection because the capability is **data**, not a
typed object carrying surface blocks. Each surface is wired by the server module, not
derived from a capability definition.

## Contrast

| | vivim-final | cap-store (OG) |
|---|---|---|
| Surface count | 5 (cli/ui/workflow/mcp/api) | 2 (REST/WS) + SDK |
| Derived from | capability definition (auto) | server module (manual) |
| Parity check | enforced at register | not applicable |
| NL entry | first-class (interpret) | none |
| Frontend | slot projection (`ui` block) | separate Vite app over WS/REST |

## Takeaway

vivim-final's surface protocol is **declarative and parity-checked** — the capability
*cannot* exist on one surface without being properly defined for it. cap-store's is
**operational and fixed** — you stand up the surfaces you code. For a consumer-facing
product, vivim-final's model prevents surface drift; cap-store's is faster to stand
up for a single delivery channel. Borrow: *derive surface specs from one definition
and validate parity at registration.*
