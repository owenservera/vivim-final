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
    case 'scroll':
      return {
        type: 'action',
        action: 'scroll',
        outputKey: step.outputKey ?? `s${index}`,
        params: { x: step.x, y: step.y, selector: step.selector },
      }
    case 'hover':
      return {
        type: 'action',
        action: 'hover',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
      }
    case 'select':
      return {
        type: 'action',
        action: 'select',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
        params: { value: step.value, label: step.label },
      }
    case 'press':
      return {
        type: 'action',
        action: 'press',
        outputKey: step.outputKey ?? `s${index}`,
        params: { key: step.key },
      }
    case 'tab_open':
      return {
        type: 'action',
        action: 'tab_open',
        outputKey: step.outputKey ?? `s${index}`,
        params: { url: step.url },
      }
    case 'tab_close':
      return {
        type: 'action',
        action: 'tab_close',
        outputKey: step.outputKey ?? `s${index}`,
        params: { targetId: step.targetId },
      }
    case 'tab_switch':
      return {
        type: 'action',
        action: 'tab_switch',
        outputKey: step.outputKey ?? `s${index}`,
        params: { targetId: step.targetId },
      }
    case 'observe':
      return {
        type: 'action',
        action: 'observe',
        outputKey: step.outputKey ?? `s${index}`,
        params: { what: step.what },
      }
    case 'upload':
      return {
        type: 'action',
        action: 'upload',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
        params: { files: step.files },
      }
    case 'extract_markdown':
      return {
        type: 'action',
        action: 'extract_markdown',
        outputKey: step.outputKey ?? `s${index}`,
      }
    case 'wait_selector':
      return {
        type: 'action',
        action: 'wait_selector',
        outputKey: step.outputKey ?? `s${index}`,
        selector: step.selector,
        params: { timeoutMs: step.timeoutMs },
      }
    case 'wait_text':
      return {
        type: 'action',
        action: 'wait_text',
        outputKey: step.outputKey ?? `s${index}`,
        params: { text: step.text, timeoutMs: step.timeoutMs },
      }
    case 'screenshot':
      return {
        type: 'action',
        action: 'screenshot',
        outputKey: step.outputKey ?? `s${index}`,
        params: { region: step.region },
      }
    case 'assert':
      return {
        type: 'action',
        action: 'assert',
        outputKey: step.outputKey ?? `s${index}`,
        params: { condition: step.condition },
      }
    case 'mock_request':
      return {
        type: 'action',
        action: 'mock_request',
        outputKey: step.outputKey ?? `s${index}`,
        params: { urlPattern: step.urlPattern, body: step.body, status: step.status },
      }
    case 'cookie_set':
      return {
        type: 'action',
        action: 'cookie_set',
        outputKey: step.outputKey ?? `s${index}`,
        params: { name: step.name, value: step.value, path: step.path },
      }
    case 'branch_if':
      return {
        type: 'branch',
        action: 'branch_if',
        outputKey: step.outputKey ?? `s${index}`,
        condition: { outputKey: step.condition, truthy: true },
        params: { steps: step.then },
      }
    case 'loop_while':
      return {
        type: 'action',
        action: 'loop_while',
        outputKey: step.outputKey ?? `s${index}`,
        condition: { outputKey: step.condition, truthy: true },
        params: { steps: step.body, max: step.max },
      }
    case 'parallel':
      return {
        type: 'parallel',
        action: 'parallel',
        outputKey: step.outputKey ?? `s${index}`,
        params: { branches: step.branches },
      }
    case 'human_gate':
      return {
        type: 'action',
        action: 'human_gate',
        outputKey: step.outputKey ?? `s${index}`,
        params: { prompt: step.prompt },
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
        const step = branch.steps[i]
        if (!step) continue
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
