# Capability-Driven UI Patterns Brief

**Source:** ai-capabilities + agentui + Capstan research + web findings
**Confidence:** High | **Sources:** 5 | **Date:** 2026-07-12

## TL;DR

Capability-driven UI exposes application actions as typed, discoverable units with UI contracts. Three main patterns identified: (1) **Unified capability layer** (Capstan) — same contract for UI and agent actions, (2) **Typed event protocol** (agentui) — agent emits UI events to registry, (3) **Canonical manifest** (ai-capabilities) — extract actions from code into auditable definitions. vivim-final uses canonical manifest approach with 21-field UI contract per capability.

## Key Decisions

1. **Canonical capability manifest** — vivim-final uses `capability_taxonomy` table with 21 UI fields; frontend renders what API provides
2. **No hardcoded behavior** — All capabilities are rows in database; providers add capabilities via JSON manifests
3. **3-layer override chain** — Global defaults → plan tier overrides → provider overrides for UI contract
4. **Single discovery endpoint** — `GET /api/conversations/:id/capabilities` returns executable UI
5. **Typed event flow** — CapabilityEventBus emits typed events; frontend subscribes to relevant events

## Evidence Summary

- **ai-capabilities (2026):** Extract hidden actions from source code, convert to canonical manifest with schemas + policy, expose as MCP tools (source: Egorfing/ai-capabilities)
- **Capstan:** `defineAPI()` creates both HTTP endpoint AND MCP tool; same auth + policies for humans and agents (source: barry3406/Capstan)
- **agentui:** Agent emits `{ name, props }` via typed UI events; component registry renders whitelisted components (source: kibadist/agentui)
- **GenUI-LoomAgent:** AI generates component instructions via AG-UI protocol; dynamic rendering of DataList, DataTable, Graph, etc. (source: qingkongzhiqian/GenUI-LoomAgent)
- **Hsafa:** Agent-to-user interface via AG-UI protocol; tool calls rendered as custom events (source: Hsafa)

## Implementation Patterns

### Pattern 1: Canonical Manifest (vivim-final)
```json
{
  "id": "claude.send",
  "slug": "send",
  "provider_id": "claude",
  "ui": {
    "component": "button",
    "label": "Send Message",
    "icon": "send",
    "position": "composer-right",
    "states": ["ready", "executing", "error"],
    "input_schema": { "type": "object", "properties": { "text": { "type": "string" } } },
    "result_component": "message",
    "result_layout": "thread"
  }
}
```

### Pattern 2: Typed Event Protocol (agentui)
```typescript
// Agent emits:
{
  type: 'CUSTOM',
  name: 'genui:components',
  props: [{ name: 'DataTable', props: { columns: [...], data: [...] } }]
}

// Frontend renders registered component
const registry = createRegistry({ DataTable, DataList, Graph });
```

### Pattern 3: Unified Contract (Capstan)
```typescript
// One definition → HTTP endpoint + MCP tool
export const sendMessage = defineAPI({
  method: 'POST',
  path: '/api/send',
  handler: async ({ text }) => { /* ... */ },
  // Automatically becomes MCP tool
});
```

## Key Differences

| Framework | Contract Scope | Agent Surface | Verification |
|-----------|---------------|---------------|--------------|
| vivim-final | DB rows with UI fields | Governor-mediated CDP | EventBus typed events |
| ai-capabilities | Code-extracted + scaffolded | MCP tools | Manifest auditable |
| Capstan | Single `defineAPI()` | HTTP + MCP automatic | 8-step verifier |
| agentui | `{ name, props }` events | Typed event stream | Registry whitelist |
| GenUI-LoomAgent | AG-UI protocol | SSE events | Component validation |

## Used In

- `capability_taxonomy` table (21 UI contract fields)
- `CapabilityResolutionEngine` — 3-layer override chain
- `CapabilityEventBus` — typed pub/sub for events
- `ProviderRegistrar` — seed manifests to DB
- Harness modules — map to capability slugs
- Frontend UI — renders capability buttons from API