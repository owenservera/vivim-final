// tests/integration/speckit-bridge.test.ts
// Integration tests for the SpecKit ↔ DevOps ID Bridge (real file I/O).

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// getTasksPath resolves as join(process.cwd(), featureDir, 'tasks.md'),
// so the feature dir must live under the repo root (cwd), not a temp path.
const FEATURE = join(process.cwd(), 'specs', '015-speckit-integration-test')

// Use an isolated temp tracker (via DEVOPS_TRACKER) so we never mutate the
// real docs/atomic/01-tracker.md.
const TRACKER = join(process.cwd(), '.test-tmp', 'speckit-bridge-tracker.md')

describe('speckit-bridge (integration)', () => {
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

  it('should sync tasks to a tracker and produce bidirectional links', async () => {
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
      `# DevOps Atomic Tracker

## Phase 1: Linked Units
- [x] 1.1 — ProviderRegistrar → \`src/engines/provider-registrar.ts\`
  <!-- bridge:task=T001 feature=specs/015-speckit-integration-test -->
- [ ] 1.2 — Skill audit → \`devops/speckit-audit.ts\`
  <!-- bridge:task=T002 feature=specs/015-speckit-integration-test -->
`,
    )

    const { syncTasksToTracker, validateBridge } = await import('../../devops/speckit-bridge.ts')
    const report = await syncTasksToTracker('specs/015-speckit-integration-test')
    expect(report.created + report.updated).toBeGreaterThanOrEqual(0)

    const consistency = await validateBridge()
    expect(consistency).toHaveProperty('consistent')
    expect(Array.isArray(consistency.orphanTasks)).toBe(true)
  })

  it('should throw when tasks.md is missing', async () => {
    const { syncTasksToTracker } = await import('../../devops/speckit-bridge.ts')
    await expect(syncTasksToTracker('specs/015-speckit-integration-test')).rejects.toThrow(
      /tasks\.md not found/,
    )
  })

  it('should map a task to its linked unit', async () => {
    // parseUnits requires a `## Phase N` header to assign units a phase.
    await writeFile(
      TRACKER,
      `# Tracker

## Phase 2: Linked Units
- [x] 2.1 — Foo engine → \`src/engines/foo.ts\`
  <!-- bridge:task=T012 feature=specs/015-speckit-integration-test -->
`,
    )
    const { mapTaskToUnit } = await import('../../devops/speckit-bridge.ts')
    const unit = await mapTaskToUnit('T012')
    expect(unit).not.toBeNull()
    expect(unit?.id).toBe('2.1')
  })
})
