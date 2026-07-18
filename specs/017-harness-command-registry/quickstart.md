# Quickstart: Harness Command Registry

**Phase 1 output** — end-to-end validation scenario.

## Scenario: Self-healing WebApp JSON extraction

```typescript
import { ulid } from '@/ids.js'
import { z } from 'zod'
import { ChromeGovernor } from '@/engines/chrome-governor.js'
import { HarnessRepairEngine } from '@/engines/harness-repair-engine.js'
import { repairString, repairNumber } from '@/schema/repair-metadata.js'

// 1. Define a repair-aware schema (side-table metadata, no prototype patch)
const UserSchema = z.object({
  user: z.object({
    id: repairNumber({ aliases: ['user_id', 'uid'], default: 0 }),
    name: repairString({ aliases: ['user_name', 'username'], default: 'unknown' }),
    email: repairString({ aliases: ['mail'] }).email().optional(),
    role: z.enum(['admin', 'user', 'guest']).default('user'),
  }),
})

// 2. Build a retry-wrapped harness DAG (executed via ChromeGovernor → CDP)
const dag: HarnessDAG = {
  nodes: [
    { type: 'action', action: 'type_text', params: { text: prompt } },
    { type: 'action', action: 'submit' },
    { type: 'retry', retry: { maxAttempts: 3, backoffMs: 200 }, nodes: [
      { type: 'action', action: 'capture', params: { pattern: /\{[\s\S]*\}/ } },
    ], edges: [] },
  ],
  edges: [ { from: 0, to: 1 }, { from: 1, to: 2 } ],
}

const gov = new ChromeGovernor(/* deps via contracts */)
const plan = await gov.executeHarnessPlan(slaveId, dag, { operationId: ulid() })
// plan.capturedBody = raw WebApp response string

// 3. Repair the captured body against the schema (browser-free)
const repair = new HarnessRepairEngine(repairStore)
const block = repair.extract(plan.capturedBody).find(b => b.type === 'json')!
const result = await repair.repair(block, UserSchema)
// result.success === true; result.data.user populated via aliases + coercion
// result.repairs lists every fix applied (unwrapped_fence, alias_mapped, ...)
```

## Validation gates (run after implementation)

```powershell
bun run typecheck
bun test tests/unit/engines/harness-repair-engine.test.ts
bun test tests/unit/engines/harness-command-registry.test.ts
bun test tests/unit/engines/chrome-governor-retry.test.ts
bun run lint
bun run devops invariants check --category B
```

## Seed

```powershell
bun run db:seed   # loads seeds/harness-commands/*.json into HarnessCommand
```
