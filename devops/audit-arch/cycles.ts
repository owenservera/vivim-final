// devops/audit-arch/cycles.ts
// Strongly-connected-component (cycle) detection over the module graph using
// an iterative Tarjan algorithm (avoids call-stack overflow on large graphs).

import type { ModuleGraph } from './graph.ts'

export interface CycleGroup {
  modules: string[]
  selfLoop: boolean
}

export function detectCycles(graph: ModuleGraph): CycleGroup[] {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  let counter = 0
  const sccs: string[][] = []

  // Iterative Tarjan.
  for (const start of graph.modules) {
    if (index.has(start)) continue
    const callStack: { node: string; i: number }[] = [{ node: start, i: 0 }]
    index.set(start, counter)
    low.set(start, counter)
    counter += 1
    stack.push(start)
    onStack.add(start)

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1] as { node: string; i: number }
      const neighbors = [...(graph.moduleDeps.get(frame.node) ?? [])]
      if (frame.i < neighbors.length) {
        const w = neighbors[frame.i] as string
        frame.i += 1
        if (!index.has(w)) {
          index.set(w, counter)
          low.set(w, counter)
          counter += 1
          stack.push(w)
          onStack.add(w)
          callStack.push({ node: w, i: 0 })
        } else if (onStack.has(w)) {
          low.set(frame.node, Math.min(low.get(frame.node) as number, index.get(w) as number))
        }
      } else {
        if (low.get(frame.node) === index.get(frame.node)) {
          const comp: string[] = []
          let w: string
          do {
            w = stack.pop() as string
            onStack.delete(w)
            comp.push(w)
          } while (w !== frame.node)
          sccs.push(comp)
        }
        callStack.pop()
        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1] as { node: string }
          low.set(parent.node, Math.min(low.get(parent.node) as number, low.get(frame.node) as number))
        }
      }
    }
  }

  const groups: CycleGroup[] = []
  for (const comp of sccs) {
    // Only multi-module SCCs are real cycles. Intra-module file imports are
    // normal coupling and must not be reported as self-cycles.
    if (comp.length > 1) {
      groups.push({ modules: comp, selfLoop: false })
    }
  }
  return groups
}
