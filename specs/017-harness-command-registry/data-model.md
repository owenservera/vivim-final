# Data Model: Harness Command Registry

**Phase 1 output** — entities, schema, and persistence.

## New Prisma Model

```prisma
model HarnessCommand {
  id          String   @id                      // ULID
  commandId   String                           // logical id, e.g. "webapp.extract_json"
  version     String                           // semver, e.g. "1.2.10"
  kind        String                           // 'action' | 'sequence' | 'branch' | 'retry' | 'precondition'
  paramsSchemaJson String                       // JSON-serialized Zod schema shape (for registry display/validation)
  adaptorRef  String                           // module/function reference, e.g. "ChromeGovernor.executeHarnessPlan"
  description  String
  createdAt   Int      @default(0)
  updatedAt   Int      @default(0)

  @@unique([commandId, version])
  @@index([commandId, version])
}
```

Rationale: mirrors `ProviderEndpoint` shape (id + slug + version + selectorsJson). `paramsSchemaJson`
stores a serializable projection of the Zod contract (the canonical Zod instance lives in code;
the DB row is the registry index). `adaptorRef` documents which executor owns the command.

## Key In-Code Entities (TypeScript)

```typescript
// src/schema/repair-metadata.ts
export interface RepairMetadata {
  aliases?: string[]
  coerceFrom?: z.ZodType[]
  defaultValue?: unknown
  semanticValidator?: (val: unknown) => boolean
  description?: string
}
// Side-table (NOT on the Zod prototype):
const REPAIR_METADATA = new Map<z.ZodType, RepairMetadata>()
export function registerRepair(schema: z.ZodType, meta: RepairMetadata): z.ZodType
export function getRepairMetadata(schema: z.ZodType): RepairMetadata | undefined

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
export class HarnessCommandRegistry {
  register(cmd: HarnessCommand): void
  resolve(commandId: string, version?: string): HarnessCommand   // 'latest' = highest semver
  list(commandId: string): HarnessCommand[]
}

// src/engines/harness-repair-engine.ts
export interface RepairResult<T> {
  success: boolean
  data?: T
  errors: RepairError[]
  repairs: RepairRecord[]
  attempts: number
  originalContent: string
  repairedContent?: string
}
export interface RepairError { stage: 'syntax'|'coercion'|'semantic'; message: string; path?: string; received?: unknown }
export interface RepairRecord { type: 'balanced_braces'|'completed_string'|'stripped_boilerplate'|'unwrapped_fence'|'alias_mapped'|'coerced'; position: number; original: string; repaired: string }

// Extended HarnessNode (chrome-governor.ts) — adds:
//   retry?:    { maxAttempts: number; backoffMs: number; onError?: 'regenerate'|'escalate' }
//   branch?:   { condition: { outputKey: string; equals?: string; truthy?: boolean }; then: SubDag; else: SubDag }
//   sequence?: { nodes: HarnessNode[]; edges: HarnessEdge[] }
//   precondition?: { outputKey: string; truthy: boolean }
```

## Persistence Contract

```typescript
// src/storage/contracts/harness-repair-store.ts
export interface HarnessRepairStore {
  saveRepairSession(row: RepairSessionRow): Promise<void>
  getRepairSession(id: string): Promise<RepairSessionRow | null>
}
// Repair sessions record originalContent, repairedContent, errors, repairs (sota-09 FR-7 / hpe_session spirit)
```

## Seed Manifest

`seeds/harness-commands/webapp-extract.json`:
```json
{
  "commandId": "webapp.extract_json",
  "version": "1.0.0",
  "kind": "sequence",
  "adaptorRef": "ChromeGovernor.executeHarnessPlan",
  "description": "Type prompt, submit, capture, repair JSON against expectedSchema",
  "paramsSchemaJson": "{}"
}
```

Additional seeds: `webapp.send_message` (retry-wrapped type/submit/capture),
`webapp.dismiss_dialog` (branch on dialog-detected outputKey).
