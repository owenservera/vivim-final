# Data Model: Parser Versions & Variations (020)

**Status**: no schema migration required — versioning is row-level on `provider_parser`.

## Existing `provider_parser` (prisma/schema.prisma)

```
model ProviderParser {
  id                String   @id
  providerId        String
  parserName        String
  parserVersion     Int      // ← version / variation axis
  parserLogicType   String   // 'file' | 'inline' | 'composed'
  parserFilePath    String?
  parserLogicCode   String?  // inline factory source
  parserHash        String
  isActive          Int
  fallbackParserId  String?  // self FK → fallback chain
  createdAt         DateTime
  updatedAt         DateTime
}
```

All fields needed for 020 already exist (019 added `setParserFallback` + semver helpers).

## Versioning strategy

- **One row per (provider, format variant).** `parserVersion` is an incrementing integer per
  provider; `parserName` is human-readable disambiguator.
- Selection: `ParserStore.getParserByProviderAndVersion(providerId, version)` resolves the
  highest active version ≤ requested (`@latest` ⇒ highest). Implemented in 019.
- No `@version` suffix in `providerId` is required for seeding; the registrar seeds each
  parser row with its own `version`.

## Seeded rows (harvest target)

| providerId | name | version | logic_type | fallback → |
|------------|------|---------|------------|-----------|
| claude | claude/001_streaming_sse | 1 | inline | generic/001 |
| chatgpt | chatgpt/001_openai_delta | 1 | inline | generic/001 |
| gemini | gemini/001_batchexecute | 1 | inline | generic/001 |
| generic | generic/001_format_agnostic | 1 | inline | system/001 |
| system | system/001_raw_text | 1 | inline | (terminal) |

Plus Google AI Studio as a `gemini` variation:
| gemini | gemini/002_ai_studio | 2 | inline | generic/001 |

(Shows the *variation* axis: same provider, two format parsers, both fall back to generic.)

## `logic_code` contract (inline factory)

```js
function (module, exports) {
  exports.default = {
    name: 'chatgpt/001_openai_delta',
    version: 1,
    providerId: 'chatgpt',
    parse(rawBody) { /* → ContentBlock[] */ },
    detectCompletion(rawBody) { /* → boolean */ },
    getConfidence(rawBody) { /* → number */ },
  }
}
```

## Capability program ↔ parser linkage

Snapshot-resolved capabilities run a `capability_program.configJson` = `{ schemaVersion, recipe }`.
`recipe` is either `{ action, params }` (single) or `{ steps: [{action, params}] }` (multi).
Parser rows are independent of capability programs; they are selected by `providerId` at
parse time. The capability execution path (R4) dispatches recipe steps via `browserHarness`.

## Fixture DB

`tests/fixtures/parser-harvest-test.db` — seeded from the same harvested rows via a
`seeds/parsers/harvest.seed.ts` module. Regenerate:
```
DATABASE_URL="file:./tests/fixtures/parser-harvest-test.db" bunx prisma db push --skip-generate --accept-data-loss
bun run seed:parsers --db "file:./tests/fixtures/parser-harvest-test.db"
```
