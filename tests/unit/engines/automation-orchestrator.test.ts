import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { AutomationOrchestrator } from '../../../src/engines/automation/orchestrator.js'

function makeGovernor() {
  return {
    ensureGenericBrowser: mock(() => Promise.resolve({ slaveId: 'generic:default:abc' })),
    runHarnessPlan: mock(() =>
      Promise.resolve({ success: true, stepsCompleted: 3, capturedBody: '<html/>' }),
    ),
  } as any
}

describe('AutomationOrchestrator', () => {
  let gov: ReturnType<typeof makeGovernor>
  let orch: AutomationOrchestrator

  beforeEach(() => {
    gov = makeGovernor()
    orch = new AutomationOrchestrator(gov)
  })

  test('listRecipes returns the composite library', () => {
    const recipes = orch.listRecipes()
    expect(recipes.length).toBeGreaterThanOrEqual(40)
    expect(recipes.some((r) => r.id === 'auto:research:report')).toBe(true)
  })

  test('run composes recipe + role and returns result', async () => {
    const result = await orch.run({
      role: 'researcher',
      recipeId: 'auto:research:report',
      intent: 'auto',
      params: { queryUrl: 'https://example.com' },
      destructive: false,
    })
    expect(result.ok ?? true).toBe(true)
    expect(result.role).toBe('researcher')
    expect(result.recipeId).toBe('auto:research:report')
    expect(result.steps).toBeGreaterThan(0)
    expect(gov.ensureGenericBrowser).toHaveBeenCalled()
    expect(gov.runHarnessPlan).toHaveBeenCalled()
  })

  test('run binds {{params}} into recipe steps', async () => {
    await orch.run({
      role: 'researcher',
      recipeId: 'auto:research:report',
      intent: 'auto',
      params: { queryUrl: 'https://foo.test' },
      destructive: false,
    })
    const dag = gov.runHarnessPlan.mock.calls[0][1]
    const serialized = JSON.stringify(dag)
    expect(serialized).toContain('https://foo.test')
  })

  test('run rejects destructive goal under read-only role', async () => {
    await expect(
      orch.run({
        role: 'researcher',
        recipeId: 'auto:research:report',
        intent: 'auto',
        params: {},
        destructive: true,
      }),
    ).rejects.toThrow()
  })
})
