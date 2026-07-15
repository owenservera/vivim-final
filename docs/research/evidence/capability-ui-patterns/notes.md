# Capability-Driven UI Patterns — Evidence Notes

## Three Main Patterns

### 1. Canonical Manifest (ai-capabilities)
- Extract actions from source code (OpenAPI, React hooks, routes)
- Convert to canonical manifest with schemas + policy
- Expose as MCP tools automatically
- Single `defineCapability()` for net-new actions

### 2. Unified Contract (Capstan)
- `defineAPI()` creates both HTTP endpoint AND MCP tool
- Same auth, policies for humans and agents
- No glue code needed

### 3. Typed Event Protocol (agentui)
- Agent emits UI events via `{ name, props }` shape
- Component registry whitelists available components
- Frontend renders dynamically

## vivim-final Approach

- `capability_taxonomy` table with 21 UI fields
- 3-layer override chain:
  - Global defaults
  - Plan tier overrides  
  - Provider overrides
- Frontend calls `GET /api/conversations/:id/capabilities`
- No conditional rendering logic in frontend

## Key Implementations

| Framework | Contract Scope | Agent Surface | Verification |
|-----------|---------------|---------------|--------------|
| vivim-final | DB rows with UI fields | Governor-mediated CDP | EventBus typed events |
| ai-capabilities | Code-extracted + scaffolded | MCP tools | Manifest auditable |
| Capstan | Single defineAPI() | HTTP + MCP automatic | 8-step verifier |
| agentui | { name, props } events | Typed event stream | Registry whitelist |
| GenUI-LoomAgent | AG-UI protocol | SSE events | Component validation |

## Sources
1. ai-capabilities — Extract hidden actions, MCP tool generation
2. Capstan — Unified web + agent framework
3. agentui — Typed event protocol for agent-driven UI
4. GenUI-LoomAgent — AG-UI protocol, GenUI components
5. Hsafa — Agent-user interaction protocol