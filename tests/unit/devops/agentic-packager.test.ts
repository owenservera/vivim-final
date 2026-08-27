// tests/unit/devops/agentic-packager.test.ts
// Tests for ContextPackager — handoff artifacts and resume prompts

import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { AgenticTask } from '../../../devops/agentic/decomposer.js'
import {
  advanceHandoff,
  createAgentHandoff,
  generateResumePrompt,
  readAgentHandoff,
  readHandoff,
  type TaskHandoff,
  writeAgentHandoff,
  writeHandoff,
} from '../../../devops/agentic/packager.js'
import type { StateSnapshot } from '../../../devops/agentic/probe.js'

const TASKS: AgenticTask[] = [
  {
    id: '0.state',
    objective: 'assess state',
    description: 'Check current state',
    requiredFiles: ['src/engines/'],
    producesFiles: ['.runtime/state-snapshot.json'],
    dependsOn: [],
    verification: 'echo ok',
    estimatedTokens: 1000,
    parallelizable: false,
  },
  {
    id: '1.compose',
    objective: 'wire composer',
    description: 'Wire up the composer typing',
    requiredFiles: ['src/engines/composer-typing.ts'],
    producesFiles: ['src/engines/composer-typing.ts'],
    dependsOn: ['0.state'],
    verification: 'bun test tests/unit/engines/composer-typing.test.ts',
    estimatedTokens: 5000,
    parallelizable: false,
  },
  {
    id: '2.gate',
    objective: 'run quality gate',
    description: 'Verify everything passes',
    requiredFiles: [],
    producesFiles: [],
    dependsOn: ['0.state', '1.compose'],
    verification: 'bun run devops gate',
    estimatedTokens: 500,
    parallelizable: false,
  },
]

const MOCK_SNAPSHOT: StateSnapshot = {
  generatedAt: Date.now(),
  estimatedTokens: 1000,
  providers: { total: 3, active: 3, list: [] },
  capabilities: { total: 50, byCategory: {}, withBindings: 10, withSelectors: 5 },
  components: { total: 8, byScope: {}, byStatus: {}, families: [] },
  schema: { tables: 54, migrations: 14, walEnabled: true, ftsEnabled: true, dbSizeBytes: 1024 },
  selectors: {
    total: 3,
    providers: ['chatgpt', 'claude', 'gemini'],
    hardcodedInCode: ['chatgpt', 'claude', 'gemini'],
    dbBacked: [],
  },
  tests: { unitFiles: 10, integrationFiles: 3, e2eFiles: 2, totalTestFiles: 15 },
  criticalGaps: ['no DeepSeek selectors'],
}

const PHASES = [[0], [1], [2]]

describe('ContextPackager', () => {
  afterAll(() => {
    const d = join(process.cwd(), '.runtime', 'agentic')
    if (existsSync(d)) rmSync(d, { recursive: true, force: true })
  })

  it('writes and reads a task handoff', () => {
    const hf: TaskHandoff = {
      taskId: '0.state',
      objective: 'assess state',
      status: 'done',
      summary: 'State assessed — 3 providers active, 2 lack selectors',
      filesChanged: ['.runtime/state-snapshot.json'],
      testsPassed: 0,
      testsFailed: 0,
      typecheckPassed: true,
      lintPassed: true,
      blockers: [],
      completedAt: Date.now(),
    }
    writeHandoff(hf)
    const read = readHandoff('0.state')
    expect(read).not.toBeNull()
    expect(read?.taskId).toBe('0.state')
    expect(read?.status).toBe('done')
  })

  it('writes and reads an agent handoff', () => {
    const handoff = createAgentHandoff('wire chatgpt', TASKS, PHASES, MOCK_SNAPSHOT)
    writeAgentHandoff(handoff)

    const read = readAgentHandoff()
    expect(read).not.toBeNull()
    expect(read?.objective).toBe('wire chatgpt')
    expect(read?.phase).toBe(0)
    expect(read?.completedTasks.length).toBe(0)
    expect(read?.nextTask).not.toBeNull()
    expect(read?.nextTask?.id).toBe('0.state')
  })

  it('advances handoff after completing a task', () => {
    const handoff = createAgentHandoff('wire chatgpt', TASKS, PHASES, MOCK_SNAPSHOT)
    const taskHf: TaskHandoff = {
      taskId: '0.state',
      objective: 'assess state',
      status: 'done',
      summary: 'Done',
      filesChanged: [],
      testsPassed: 0,
      testsFailed: 0,
      typecheckPassed: true,
      lintPassed: true,
      blockers: [],
      completedAt: Date.now(),
    }

    const advanced = advanceHandoff(handoff, taskHf, TASKS, PHASES)
    expect(advanced.completedTasks.length).toBe(1)
    expect(advanced.nextTask?.id).toBe('1.compose')
    expect(advanced.phase).toBe(1)
  })

  it('generates a resume prompt with next task details', () => {
    const handoff = createAgentHandoff('wire chatgpt', TASKS, PHASES, MOCK_SNAPSHOT)
    const prompt = generateResumePrompt(handoff)
    expect(prompt).toContain('wire chatgpt')
    expect(prompt).toContain('0.state')
    expect(prompt).toContain('Required files')
    expect(prompt).toContain('Verification')
    expect(prompt).toContain('Phase')
  })

  it('generates resume prompt that is under 3000 tokens', () => {
    const handoff = createAgentHandoff(
      'a very long objective that describes exactly what needs to be built',
      TASKS,
      PHASES,
      MOCK_SNAPSHOT,
    )
    const prompt = generateResumePrompt(handoff)
    // ~4 chars per token rough estimate
    const estimatedTokens = Math.ceil(prompt.length / 4)
    expect(estimatedTokens).toBeLessThan(3000)
  })
})
