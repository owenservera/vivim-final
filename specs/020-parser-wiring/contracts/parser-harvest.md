# Contracts: Parser Harvest & Multi-Step Execution (020)

## Contract 1 — `ParserStore` (existing, used as-is)
- `getParserByProviderAndVersion(providerId, version): Promise<ProviderParserRow | null>`
- `getParserById(id): Promise<ProviderParserRow | null>`
- `setParserFallback(parserId, fallbackParserId): Promise<void>` (added in 019)
- `upsertParser(row)`, `deleteProviderParsers(providerId)` (registrar)
- No change required.

## Contract 2 — `ParserModule` (inline factory result)
```ts
interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}
```
Harvested `logic_code` MUST satisfy this exactly.

## Contract 3 — `ProviderManifest.parsers[]` (seed input)
Already supports `fallback: string` (parser name) and `logic_type`/`logic_code` (019).
020 requires seed manifests to **declare `fallback`** so the registrar builds real chains.

## Contract 4 — `Recipe` (capability program)
From `src/engines/harness/recipe-types.ts`. 020 supports:
```ts
type Recipe = SingleActionRecipe | MultiActionRecipe
interface SingleActionRecipe { action: string; params?: Record<string, unknown> }
interface MultiActionRecipe { steps: RecipeStep[] }
interface RecipeStep { action: string; params?: Record<string, unknown> }
```
`configToProgram` already parses `recipe`. `executeSnapshotProgram` (chrome-governor.ts)
must handle both shapes.

## Contract 5 — `BrowserHarnessActions.runAction(slaveId, action, params)`
Already implemented (harness-actions.ts). Used by the multi-step dispatcher.

## Invariants preserved
- Governor Canon: harvested `logic_code` never imports `BunCdpClient`.
- Store Contracts: `StreamParserEngine` reads only via `ParserStore`.
- DB-only logic: `logic_type` is always `inline`; server runs with `allowFileLogic:false`.
