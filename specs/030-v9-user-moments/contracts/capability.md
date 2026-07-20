# UnifiedCapability Execution Contract

Every user action is a `UnifiedCapability` (Constitution III — One Entry Point).

## Resolve
```
GET /api/capabilities?surface=cli
→ [{ id, slug, name, category, cliCommand, ui, mcpToolName, apiEndpoint, surfaces }]
```

## Execute
```
POST /api/capabilities/:id/execute
Body:  <inputSchema-validated JSON>
→ { result, blockMeta?, error? }
```

## NL resolution (Moment 2 AC5)
```
POST /api/interpret  { nl: "send message to gemini" }
→ { capabilityId, args }
→ then POST /api/capabilities/:capabilityId/execute
```

## UI binding
- UI actions resolve through `CapabilityResolutionEngine`, NOT hardcoded `if (slug===...)`.
- Slot IDs namespaced (e.g. `chat.actionBar`, `chat.composer`, `chat.sidebar`).
- Add `UiComponent` tiers over hardcoded branches (Constitution Frontend).
