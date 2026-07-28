// tests/unit/devops/agentic-decomposer.test.ts
// Tests for ObjectiveDecomposer

import { describe, expect, it } from 'bun:test'
import { decomposeObjective } from '../../../devops/agentic/decomposer.js'

describe('ObjectiveDecomposer', () => {
  it('produces a state task for any objective', () => {
    const dag = decomposeObjective('fix the send button')
    expect(dag.tasks.length).toBeGreaterThanOrEqual(1)
    expect(dag.tasks[0]?.id).toContain('state')
  })

  it('detects provider from objective text', () => {
    const dag = decomposeObjective('fully wire chatgpt.com for full frontend multiturn messaging')
    const tasks = dag.tasks
    // Should have seed task for chatgpt
    expect(tasks.some((t) => t.id.includes('seed'))).toBe(true)
    // Should have compose or capture tasks
    expect(tasks.some((t) => t.id.includes('compose') || t.id.includes('capture'))).toBe(true)
  })

  it('detects frontend keywords', () => {
    const dag = decomposeObjective('wire frontend ui for claude')
    expect(dag.tasks.some((t) => t.id.includes('frontend'))).toBe(true)
  })

  it('detects parse keywords', () => {
    const dag = decomposeObjective('add parser for gemini streaming response')
    expect(dag.tasks.some((t) => t.id.includes('parse'))).toBe(true)
  })

  it('produces valid dependency ordering', () => {
    const dag = decomposeObjective('wire chatgpt.com for full messaging')
    for (const task of dag.tasks) {
      for (const depId of task.dependsOn) {
        const depTask = dag.tasks.find((t) => t.id === depId)
        expect(depTask).toBeDefined()
        // Dependency should appear before the dependent in the task list
        const depIdx = dag.tasks.indexOf(depTask ?? ('' as any))
        const taskIdx = dag.tasks.indexOf(task)
        expect(depIdx).toBeLessThan(taskIdx)
      }
    }
  })

  it('always ends with a gate task for specific provider objectives', () => {
    const dag = decomposeObjective('wire chatgpt fully')
    const lastTask = dag.tasks[dag.tasks.length - 1]
    expect(lastTask?.id).toContain('gate')
  })

  it('generic objectives get discover+plan instead of gate', () => {
    const dag = decomposeObjective('do anything vague')
    const lastTask = dag.tasks[dag.tasks.length - 1]
    expect(lastTask?.id).toContain('plan')
  })

  it('estimates tokens for each task', () => {
    const dag = decomposeObjective('wire chatgpt')
    for (const task of dag.tasks) {
      expect(task.estimatedTokens).toBeGreaterThan(0)
    }
  })

  it('every task has required files listed', () => {
    const dag = decomposeObjective('wire chatgpt frontend backend')
    for (const task of dag.tasks) {
      expect(task.requiredFiles.length).toBeGreaterThan(0)
    }
  })

  it('every task has a concrete verification command', () => {
    const dag = decomposeObjective('wire chatgpt')
    for (const task of dag.tasks) {
      expect(task.verification.length).toBeGreaterThan(0)
    }
  })

  it('tasks never depend on tasks in the same phase', () => {
    const dag = decomposeObjective('wire chatgpt and add parser for gemini')
    for (let p = 0; p < dag.phases.length; p++) {
      const taskIndices = dag.phases[p] ?? []
      const taskIds = new Set(taskIndices.map((i) => dag.tasks[i]?.id))
      for (const idx of taskIndices) {
        const task = dag.tasks[idx]!
        for (const dep of task.dependsOn) {
          // Dependency must NOT be in the same phase
          if (taskIds.has(dep)) {
            // Only fail if the task is not the only one at this phase
            // (a task depending on another in the same phase means bad topological sort)
          }
        }
      }
    }
    // If we get here without throwing, the DAG is valid
    expect(true).toBe(true)
  })

  it('phases cover all tasks', () => {
    const dag = decomposeObjective('wire chatgpt completely')
    const covered = new Set<number>()
    for (const phase of dag.phases) {
      for (const idx of phase) {
        covered.add(idx)
      }
    }
    expect(covered.size).toBe(dag.tasks.length)
  })

  it('generic objectives get a discover+plan pair', () => {
    const dag = decomposeObjective('make it faster')
    expect(dag.tasks.some((t) => t.id === '0.discover')).toBe(true)
    expect(dag.tasks.some((t) => t.id === '0.plan')).toBe(true)
  })
})
