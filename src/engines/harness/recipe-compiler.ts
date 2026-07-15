// src/engines/harness/recipe-compiler.ts
// Unit 21.4 - Recipe compiler: Recipe -> ChromeGovernor HarnessDAG.
// The governor's executeHarnessPlan walks a topological DAG of HarnessNodes.
// We flatten a Recipe (linear steps + optional branches) into that shape,
// keeping the Governor Canon intact: this file NEVER touches CDP itself.

import type { HarnessDAG, HarnessEdge, HarnessNode } from '../chrome-governor.js'
import type { Recipe, RecipeStep } from './recipe-types.js'

function stepToNode(step: RecipeStep, index: number): HarnessNode {
  switch (step.kind) {
    case 'type_text':
      return {
        type: 'action',
        action: 'type_text',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
        params: { text: step.text, composerType: step.composerType ?? 'textarea' },
      }
    case 'submit':
      return {
        type: 'action',
        action: 'submit',
        outputKey: step.outputKey ?? `s${index}`,
        params: { sendSelector: step.sendSelector },
      }
    case 'click':
      return {
        type: 'action',
        action: 'click',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
      }
    case 'wait':
      return {
        type: 'action',
        action: 'wait',
        outputKey: step.outputKey ?? `s${index}`,
        params: { timeoutMs: step.timeoutMs },
      }
    case 'navigate':
      return {
        type: 'action',
        action: 'navigate',
        outputKey: step.outputKey ?? `s${index}`,
        params: { url: step.url },
      }
    case 'capture':
      return {
        type: 'action',
        action: 'capture',
        outputKey: step.outputKey ?? `s${index}`,
        params: { pattern: step.pattern, timeoutMs: step.timeoutMs },
      }
    case 'evaluate':
      return {
        type: 'action',
        action: 'evaluate',
        outputKey: step.outputKey ?? `s${index}`,
        params: { expression: step.expression },
      }
  }
}

/** Compile a Recipe into a HarnessDAG the governor can execute. */
export function compileRecipe(recipe: Recipe): HarnessDAG {
  const nodes: HarnessNode[] = []
  const edges: HarnessEdge[] = []

  // Linear steps first.
  recipe.steps.forEach((step, i) => {
    nodes.push(stepToNode(step, i))
    if (i > 0) edges.push({ from: i - 1, to: i })
  })

  let lastLinear = recipe.steps.length - 1

  // Branches follow linear steps, each gated by its `when` condition.
  if (recipe.branches && recipe.branches.length > 0) {
    for (const branch of recipe.branches) {
      const base = nodes.length
      for (let i = 0; i < branch.steps.length; i++) {
        const step = branch.steps[i]!
        const node = stepToNode(step, base + i)
        node.condition = {
          outputKey: branch.when.outputKey,
          equals: branch.when.equals,
          truthy: branch.when.truthy,
        }
        nodes.push(node)
        if (i > 0) edges.push({ from: base + i - 1, to: base + i })
      }
      // Branch entry depends on last linear step (or previous branch tail).
      if (nodes.length > base) edges.push({ from: Math.max(0, lastLinear), to: base })
      lastLinear = nodes.length - 1
    }
  }

  return { nodes, edges }
}
