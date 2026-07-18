// tests/integration/speckit-sync.test.ts
// Integration tests for the tracker ↔ SpecKit bidirectional sync.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const FEATURE = join(process.cwd(), 'specs', '015-speckit-integration-test')
// Isolate the tracker so we never mutate the real docs/atomic/01-tracker.md.
const TRACKER = join(process.cwd(), '.test-tmp', 'speckit-sync-tracker.md')

describe('tracker-speckit-sync (integration)', () => {
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

  it('should sync a feature to the tracker', async () => {
    await writeFile(
      join(FEATURE, 'tasks.md'),
      `# Tasks

## Phase 1

- [ ] T001 [P] [US1] First
- [ ] T002 [P] [US2] Second
`,
    )
    // Create the isolated temp tracker so syncFeatureToTracker has a target.
    await writeFile(TRACKER, '# DevOps Atomic Tracker\n')
    const { syncFeatureToTracker, validateConsistency } = await import(
      '../../devops/tracker-speckit-sync.ts'
    )
    const report = await syncFeatureToTracker('specs/015-speckit-integration-test')
    expect(report).toHaveProperty('created')
    expect(report).toHaveProperty('updated')
    expect(report).toHaveProperty('skipped')

    const consistency = await validateConsistency()
    expect(consistency).toHaveProperty('consistent')
  })

  it('should report consistency for an empty tracker', async () => {
    await writeFile(TRACKER, '# Tracker\n')
    const { validateConsistency } = await import('../../devops/tracker-speckit-sync.ts')
    const report = await validateConsistency()
    expect(report.consistent).toBe(true)
    expect(report.orphanTasks).toEqual([])
  })
})
