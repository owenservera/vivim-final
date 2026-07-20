# Contract: provider-protocol-generator.ts

**File**: `src/engines/provider-protocol-generator.ts`
**Purpose**: Reads the DB and compiles a single static TS file (+ dev clone) consumed by harness code.

## Public API (outward-facing)

```ts
// Rendered protocol projection (root shape)
interface ProviderProtocol {
  schemaVersion: 1
  generatedAt: number
  providerCount: number
  providers: ProviderProtocolEntry[]
}

// Entry point invoked by `bun run gen:protocol`
class ProviderProtocolGenerator {
  async run(): Promise<void>      // query DB (protocol_status='Active') → write both files
  render(protocol: ProviderProtocol): string
}

// Invoked via: bun run src/engines/provider-protocol-generator.ts
```

## Output contract

- Writes `src/__generated__/provider-protocol.ts` (prod) and `src/__generated__/provider-protocol.dev.ts`
  (dev clone — identical content, editable, gitignored).
- Output MUST be valid, compilable TypeScript that imports types from
  `'../engines/provider-protocol-generator.js'` **with a correctly-quoted path** (R2.1 bug:
  the import line previously used a stray `\'` inside a single-quoted string; must use double
  quotes, e.g. `"../engines/provider-protocol-generator.js"`).
- Only providers where `protocol_status = 'Active'` are included.
- Type `ProviderProtocol` (and entry types) is `export`ed so the generated file's
  `import type { ... } from '../engines/provider-protocol-generator.js'` resolves.

## Data sources (DB-only)

- `provider_definition` (filtered `protocol_status='Active'`)
- `provider_endpoint.selectors_json` (canonical selectors)
- `provider_parser.parser_logic_code` (inline, `parser_file_path` always null)
- `provider_capability`, `provider_config`, `provider_model`

## Batch-read requirement (R2.2)

All reads happen in batched DB queries (no per-provider round trips, no FS access).

## Failure modes

- Missing `provider-protocol.ts` at boot → `StreamParserEngine.primeFromProtocol` is wrapped in
  try/catch; DB resolver chain remains the runtime safety net (R4.4).
