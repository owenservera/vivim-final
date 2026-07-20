// src/engines/automation/orchestrator.ts
// AutomationOrchestrator (B7) - composes a declarative recipe + an agent-role
// config role and runs it through the ChromeGovernor. No scenario brains: the
// role is pure config (trust, fan-out, loop, output). Destructive steps are
// gated by the role's trust policy; human_gate recipe steps are enforced here.

import { EngineError } from '../../errors.js'
import type { Recipe, RecipeStep } from '../../storage/contracts/program-store.js'
import { RECIPES, getRecipe } from '../browser-automation/recipes.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import { compileRecipe } from '../harness/recipe-compiler.js'
import { getAgentRole } from './agents.js'
import type { AgentRole, AutomationGoal, AutomationResult, TrustPolicy } from './types.js'

export class AutomationOrchestrator {
  constructor(private governor: ChromeGovernor) {}

  /** List available composite recipes (for catalog/help). */
  listRecipes(): Recipe[] {
    return RECIPES
  }

  /** Run an automation goal via a recipe + agent role. */
  async run(goal: AutomationGoal): Promise<AutomationResult> {
    const role = getAgentRole(goal.role)
    const recipe = goal.recipeId ? getRecipe(goal.recipeId) : getRecipe(role.defaultRecipe)
    if (!recipe) throw new EngineError(`Unknown recipe: ${goal.recipeId ?? role.defaultRecipe}`)

    this.assertTrust(role.trust, goal)

    const bound = this.bindParams(recipe, goal.params)
    const dag = compileRecipe(bound)
    const slave = await this.governor.ensureGenericBrowser()
    const result = await this.governor.runHarnessPlan(slave.slaveId, dag)

    if (!result.success) {
      const failed = dag.nodes[result.stepsCompleted]?.action ?? '?'
      throw new EngineError(`Automation failed at step ${failed}: ${result.error ?? 'unknown'}`)
    }

    const observations = [
      { kind: 'stepsCompleted', data: result.stepsCompleted },
      ...(result.capturedBody ? [{ kind: 'capturedBody', data: result.capturedBody }] : []),
    ]

    return {
      role: role.id,
      recipeId: recipe.id,
      steps: dag.nodes.length,
      observations,
      output: this.finalize(role, observations),
      trustLevel: role.trust.level,
      humanGated: role.trust.humanGate,
    }
  }

  /** Interpolate {{key}} placeholders in a recipe's steps from goal.params. */
  private bindParams(recipe: Recipe, params: Record<string, string>): Recipe {
    const interpolate = (v: unknown): unknown => {
      if (typeof v === 'string') {
        return v.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`)
      }
      return v
    }
    const steps: RecipeStep[] = recipe.steps.map((step) => {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(step)) out[k] = interpolate(val)
      return out as RecipeStep
    })
    return { ...recipe, steps }
  }

  private assertTrust(trust: TrustPolicy, goal: AutomationGoal): void {
    if (goal.destructive && trust.level === 'read') {
      throw new EngineError(`Role trust=${trust.level} forbids destructive goal`)
    }
    if (goal.destructive && trust.requiresConfirmation && !goal.params.__confirmed) {
      throw new EngineError(`Destructive goal requires explicit confirmation (role=${trust.level})`)
    }
  }

  private finalize(role: AgentRole, observations: Array<{ kind: string; data: unknown }>): unknown {
    switch (role.output.aggregate) {
      case 'report':
        return { kind: 'report', sections: observations.length, format: role.output.format }
      case 'collection':
        return observations.map((o) => o.data)
      case 'snapshot':
        return observations[observations.length - 1]?.data ?? null
      default:
        return observations[0]?.data ?? null
    }
  }
}
