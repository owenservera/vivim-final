# Contract: provider-protocol-loader.ts

**File**: `src/engines/provider-protocol-loader.ts`
**Purpose**: Resolves which generated static protocol file source code imports, toggled by env.

## Public API

```ts
export type ProtocolSource = 'generated' | 'dev'

// Env: PROVIDER_PROTOCOL_SOURCE (default "generated"; "dev" selects the editable clone)
export function resolveProtocolSource(): ProtocolSource

// Dynamically imports the selected __generated__ file and returns its default export.
export async function loadProviderProtocol(): Promise<{
  source: ProtocolSource
  protocol: ProviderProtocol
}>
```

## Behavior contract

- `resolveProtocolSource()` reads `process.env.PROVIDER_PROTOCOL_SOURCE`.
  - Any value other than exactly `dev` (case-insensitive, trimmed) → `'generated'`.
- `loadProviderProtocol()`:
  - `source === 'dev'` → `import('../__generated__/provider-protocol.dev.js')`, returns `mod.default`.
  - otherwise → `import('../__generated__/provider-protocol.js')`, returns `mod.default`.
- The returned `protocol` is the `ProviderProtocol` interface (see
  `provider-protocol-generator.contract.md`).

## Callers (must consume this, never the DB, on hot path)

- `src/config/provider-registry.ts` → `ProviderRegistry.initialize()`
- `src/server/index.ts` → boot parser cache priming (`StreamParserEngine.primeFromProtocol`)
- `src/engines/stream-parser.ts` → receives pre-compiled parser modules

## Conventions

- Default (no env) = `generated`.
- The `.dev.ts` file is gitignored and intended as an editable local override.
- No synchronous FS access; import is dynamic so only one file is loaded at runtime.
