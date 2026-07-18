# Key Patterns

## ID Generation Pattern
All IDs are monotonic sortable ULIDs (see `src/ids.ts`):
```typescript
newId()                           // → ULID
deriveSlaveId(providerId, accountId)     // → slave:{provider}:{account}
deriveCapabilityId(providerId, slug)     // → cap:{provider}:{slug}
deriveBindingId(globalCapId, providerId) // → bind:{cap}:{provider}
deriveProgramId(bindingId, version)      // → prog:{bind}:v{n}
deriveSelectorId(capId, providerId, name) // → sel:{cap}:{provider}:{name}
```

## Governor Canon (Invariant)
Only `ChromeGovernor` touches CDP. Engines never import `BunCdpClient` directly.
- CDP access: via `CDPTransport` abstraction
- File: `src/executor/cdp-transport.ts`
- ChromeGovernor: `src/engines/chrome-governor.ts`

## Store Contract Pattern
Engines depend on interfaces, never implementations:
```typescript
// In engine
import type { IProviderStore } from '@/storage/contracts/provider-store.js'

// In test (mock)
const mockStore = { get: vi.fn(), set: vi.fn() } as unknown as IProviderStore

// Implementation (never imported by engines)
// src/storage/impl/provider-store-impl.ts
```

## Capability Pattern
UnifiedCapability has 21-field UI contract:
```typescript
type UnifiedCapability = {
  id: string
  slug: string
  surfaces: ['cli', 'ui', 'api', 'mcp']
  cliCommand: string
  ui: UIRenderer
  mcpToolName: string
  // ... 17 more fields
}
```

## Conversation Pipeline (8 steps)
1. RESOLVE — find capability
2. LOCK — acquire slave
3. ENSURE — verify slave running
4. SEND — submit to provider
5. CAPTURE — grab response
6. PARSE — extract blocks
7. STORE — persist to DB
8. EMIT — send to WebSocket

## NLCLEngine Pattern
Natural language commands map to capabilities via catalog:
```typescript
// src/engines/nlcl/catalog.ts
{
  pattern: /chat with (\w+)/i,
  capabilityId: 'cap:claude:chat',
  transform: (match) => ({ provider: match[1], prompt: '...' })
}
```

## One Entry Point (Invariant)
All operations are capabilities. Entry points:
- CLI: `POST /api/interpret` → `POST /api/capabilities/:id/execute`
- UI: AgentBridge → same capability execution
- MCP: tools map to capability execution