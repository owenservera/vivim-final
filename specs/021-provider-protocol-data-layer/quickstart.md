# Quickstart: Validate Provider Protocol Data Layer

**Feature**: 021-provider-protocol-data-layer
**Goal**: Prove the feature works end-to-end (DB → static file → harness consumes it).

## Prerequisites

- Bun installed; repo at branch `021-provider-protocol-data-layer`.
- DB present (`prisma/dev.db` or configured `DATABASE_URL`).
- PowerShell 7+ for `pwsh` scripts.

## Validation scenarios

### 1. Generator compiles and emits valid files (R2.1, Success 1)

```powershell
# From repo root
bun run gen:protocol
bun run typecheck
```

Expected: no type errors; `src/__generated__/provider-protocol.ts` and `.dev.ts` are written and
import their types with a valid (double-quoted) path.

### 2. Boot performs zero FS reads of provider manifests (R5.3/R5.4, Success 2)

```powershell
# Grep must return NO matches in the boot path
Select-String -Pattern "readdir|readFile|seeds/providers/\*\.json" src/engines/provider-registrar.ts, src/cli/provider-harness.ts
```

Expected: zero matches. Confirm both files import `PROVIDER_MANIFESTS` from
`seeds/providers/manifests.ts`.

### 3. Default (generated) source works (R4.1/R4.5, Success 3)

```powershell
bun run serve   # PROVIDER_PROTOCOL_SOURCE unset → defaults to "generated"
```

Expected: boot log `[boot] Stream parser cache primed from generated protocol`; registry builds
from `provider-protocol.ts`.

### 4. Dev clone toggle works (R4.1, Success 3)

```powershell
$env:PROVIDER_PROTOCOL_SOURCE = "dev"
bun run serve
```

Expected: registry loads `provider-protocol.dev.ts` (editable override). Edit `.dev.ts`, restart,
confirm the override is observed.

### 5. Provider harness passes for all seeded providers (R6.1, Success 5)

```powershell
bun run src/cli/provider-harness.ts
```

Expected: all 6 live providers (claude, chatgpt, gemini, deepseek, qwen, grok) + meta providers
(system, studio-ai, z-ai, facebook, slack, telegram, whatsapp) validate against `PROVIDER_MANIFESTS`.

### 6. Legacy parser files removed (R5.5, Success 6)

```powershell
Test-Path seeds/parsers/chatgpt, seeds/parsers/claude, seeds/parsers/gemini, seeds/parsers/generic, seeds/parsers/system
```

Expected: all `False`. `seeds/parsers/harvested/*.ts` and `harvest.seed.ts` remain.

### 7. Single Prisma migration (R5.8, Success 7)

```powershell
Get-ChildItem prisma/migrations -Directory | Measure-Object | Select-Object Count
```

Expected: `Count = 1`. Node-layer tables (`Node`, `NodeEdge`, `NodeVersion`, `NodeAlias`) and
`provider_definition.protocol_status` preserved.

## Full gate (before commit)

```powershell
bun test
bun run typecheck
bun run lint
bun run devops invariants check --category B
```

## Reference artifacts

- Data model: [data-model.md](../data-model.md)
- Loader contract: [contracts/provider-protocol-loader.contract.md](../contracts/provider-protocol-loader.contract.md)
- Generator contract: [contracts/provider-protocol-generator.contract.md](../contracts/provider-protocol-generator.contract.md)
