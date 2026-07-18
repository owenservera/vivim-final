# Contracts: Harness Command Registry

**Phase 1 output** — interface contracts between components.

## Contract 1 — HarnessCommandRegistry

```typescript
// src/engines/harness-command-registry.ts
export interface HarnessCommand {
  id: string
  commandId: string
  version: string
  kind: HarnessNode['type']
  paramsSchema: z.ZodType
  adaptorRef: string
  description: string
}

export interface IHarnessCommandRegistry {
  register(cmd: HarnessCommand): void
  resolve(commandId: string, version?: string): HarnessCommand
  list(commandId: string): HarnessCommand[]
}
```

- `resolve(commandId, 'latest')` → highest semver (FR-010). Throws `HarnessRepairError` if unknown.
- `register` is idempotent on `(commandId, version)`.

## Contract 2 — HarnessRepairEngine

```typescript
// src/engines/harness-repair-engine.ts
export interface IHarnessRepairEngine {
  extract(raw: string): ExtractedBlock[]
  repair<T>(block: ExtractedBlock, schema: z.ZodType<T>, opts?: RepairOptions): Promise<RepairResult<T>>
}
export interface RepairOptions {
  maxAttempts?: number          // default 3
  enableKeyMapping?: boolean    // default true (alias resolution)
  enableTypeCoercion?: boolean  // default true (Zod coerce)
  stripBoilerplate?: boolean    // default true
}
```

- No browser dependency. Input is a string (typically `CaptureResult.body`).
- `extract` returns blocks typed `text | code | json` with confidence.
- `repair` runs strategy chain: `schema_guided → json_block → structure_detect → plain_text`.

## Contract 3 — HarnessRepairStore (Store Contract)

```typescript
// src/storage/contracts/harness-repair-store.ts
export interface RepairSessionRow {
  id: string
  conversationId?: string | null
  commandId?: string | null
  originalContent: string
  repairedContent?: string | null
  strategy: string
  success: boolean
  errorsJson: string
  repairsJson: string
  createdAt: number
}
export interface HarnessRepairStore {
  saveRepairSession(row: RepairSessionRow): Promise<void>
  getRepairSession(id: string): Promise<RepairSessionRow | null>
}
```

Engine depends on this interface, never on `src/storage/impl/*` (Store Contracts, Constitution II).

## Contract 4 — ChromeGovernor (extension)

`executeHarnessPlan(slaveId, dag, opts?: { operationId?: string; conversationId?: string })`:
- implements `retry`, `branch`, `sequence`, `precondition` in addition to `action`.
- emits `harness:retry`, `harness:branch`, `harness:retry_exhausted` on `CapabilityEventBus`.
- unchanged signature-compatible for existing `action`-only callers.

## Contract 5 — HarnessFeedbackCoordinator

```typescript
// src/engines/harness-feedback-coordinator.ts
export interface IHarnessFeedbackCoordinator {
  buildRetryPrompt(originalPrompt: string, result: RepairResult<unknown>, attempt: number): string
  backoffMs(attempt: number, baseMs: number): number   // exponential
}
```

- `buildRetryPrompt` includes path-specific errors from `result.errors` (FR-012).
- `backoffMs` returns `baseMs * 2^(attempt-1)`.
