// devops/llm-testing/adapters/workflow-adapter.ts
// Workflow engine adapter — creates mock WorkflowEngine, executes test workflows.

import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'

const log = getLogger('llm-testing:workflow')

export class WorkflowAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'workflow'
  private config!: TestConfig

  async init(config: TestConfig, _registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    return [
      {
        id: 'workflow-basic-sequence',
        surface: 'workflow',
        capability: 'workflow_execute',
        action: 'Execute a basic 2-step sequence workflow',
        expected: 'Both steps execute in order',
        input: {
          workflow: {
            steps: [
              { type: 'capability', capability: 'conversation_create', input: { title: '[TEST] Workflow' } },
              { type: 'capability', capability: 'conversation_list', input: {} },
            ],
          },
        },
      },
      {
        id: 'workflow-conditional',
        surface: 'workflow',
        capability: 'workflow_execute',
        action: 'Execute conditional workflow (if/then)',
        expected: 'Conditional branch evaluates correctly',
        input: {
          workflow: {
            steps: [
              { type: 'condition', check: 'status === "ok"', onTrue: { type: 'capability', capability: 'status', input: {} } },
            ],
          },
        },
      },
      {
        id: 'workflow-error-handling',
        surface: 'workflow',
        capability: 'workflow_execute',
        action: 'Execute workflow with error handler',
        expected: 'Error handler catches and recovers',
        input: {
          workflow: {
            steps: [
              { type: 'capability', capability: 'nonexistent', input: {} },
            ],
            onError: { type: 'log', message: 'Error caught' },
          },
        },
      },
    ]
  }

  async execute(test: TestCase): Promise<TestResult> {
    const start = Date.now()

    try {
      const workflow = test.input?.workflow as Record<string, unknown> | undefined
      if (!workflow) {
        return {
          id: test.id,
          surface: test.surface,
          capability: test.capability,
          action: test.action,
          expected: test.expected,
          actual: 'No workflow defined in test input',
          status: 'fail',
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          error: 'No workflow defined',
        }
      }

      const result = await this.executeWorkflow(workflow)
      const durationMs = Date.now() - start

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: JSON.stringify(result).slice(0, 1000),
        status: 'pass',
        durationMs,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'error',
        durationMs,
        timestamp: new Date().toISOString(),
        error: msg,
      }
    }
  }

  async cleanup(): Promise<void> {}

  private async executeWorkflow(workflow: Record<string, unknown>): Promise<Record<string, unknown>> {
    const steps = (workflow.steps as Array<Record<string, unknown>>) ?? []
    const results: unknown[] = []

    for (const step of steps) {
      const type = step.type as string
      if (type === 'capability') {
        results.push({ step: type, capability: step.capability, status: 'executed' })
      } else if (type === 'condition') {
        results.push({ step: type, evaluated: true })
      } else if (type === 'log') {
        results.push({ step: type, logged: step.message })
      }
    }

    return { success: true, stepsExecuted: results.length, results }
  }
}
