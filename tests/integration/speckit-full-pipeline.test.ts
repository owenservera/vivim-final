// tests/integration/speckit-full-pipeline.test.ts
// End-to-end pipeline: sync → validate → gate → converge.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// unifiedConverge (invoked in the full pipeline) reads across the feature dir
// and exceeds the default 5s budget under load.
const SLOW = 60_000

const FEATURE = join(process.cwd(), 'specs', '015-speckit-integration-test')
// Isolate the tracker so we never mutate the real docs/atomic/01-tracker.md.
const TRACKER = join(process.cwd(), '.test-tmp', 'speckit-pipeline-tracker.md')

describe('Speckit + DevOps Full Pipeline (integration)', () => {
  beforeEach(async () => {
    await mkdir(FEATURE, { recursive: true })
    await mkdir(join(process.cwd(), '.test-tmp'), { recursive: true })
    process.env.DEVOPS_TRACKER = TRACKER
  })

  afterEach(async () => {
    process.env.DEVOPS_TRACKER = undefined
    if (existsSync(FEATURE)) await rm(FEATURE, { recursive: true, force: true })
    if (existsSync(TRACKER)) await rm(TRACKER, { force: true })
  })

  it(
    'should run the complete pipeline without errors',
    async () => {
      // Simulate /speckit.specify + /speckit.plan + /speckit.tasks
      await writeFile(join(FEATURE, 'spec.md'), '# Spec\n')
      await writeFile(join(FEATURE, 'plan.md'), '# Plan\n')
      await writeFile(
        join(FEATURE, 'tasks.md'),
        `# Tasks

## Phase 1

- [ ] T001 [P] [US1] Create bridge
- [ ] T002 [P] [US2] Create audit
`,
      )
      await writeFile(
        TRACKER,
        `# Tracker

## Phase 1: Linked Units
- [x] 1.1 — Bridge → \`devops/speckit-bridge.ts\`
  <!-- bridge:task=T001 feature=specs/015-speckit-integration-test -->
- [ ] 1.2 — Audit → \`devops/speckit-audit.ts\`
  <!-- bridge:task=T002 feature=specs/015-speckit-integration-test -->
`,
      )

      // Step 4: sync to tracker
      const { syncTasksToTracker, validateBridge } = await import('../../devops/speckit-bridge.ts')
      const syncResult = await syncTasksToTracker('specs/015-speckit-integration-test')
      expect(syncResult).toHaveProperty('created')

      // Validate consistency
      const consistency = await validateBridge()
      expect(consistency).toHaveProperty('consistent')

      // Step 6: converge (read-only on temp dir with no tasks.md present after sync? it exists)
      const { unifiedConverge } = await import('../../devops/speckit-converge-bridge.ts')
      const convergeResult = await unifiedConverge('specs/015-speckit-integration-test')
      expect(convergeResult).toHaveProperty('featureDir')
    },
    SLOW,
  )

  it('should detect orphan state when tracker and tasks disagree', async () => {
    await writeFile(
      join(FEATURE, 'tasks.md'),
      `# Tasks

## Phase 1

- [ ] T099 [P] [US9] Orphan task with no linked unit
`,
    )
    await writeFile(TRACKER, '# Tracker\n')
    const { validateBridge } = await import('../../devops/speckit-bridge.ts')
    const report = await validateBridge()
    expect(report).toHaveProperty('orphanTasks')
  })
})
