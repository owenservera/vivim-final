// devops/audit-arch/passes/layering.ts
// `layering` pass: enforce the dependency direction declared in policy.ts.

import { buildFinding, type Finding } from '../findings.ts'
import { evaluateEdge, layerOf } from '../policy.ts'
import { modulePathLabel, type ModuleGraph } from '../graph.ts'
import { scopeRank, type Scope } from '../priority.ts'

export async function checkLayering(graph: ModuleGraph, scope: Scope = 'standard'): Promise<Finding[]> {
  const out: Finding[] = []
  const skipEnabled = scopeRank(scope) >= scopeRank('deep')
  for (const [from, deps] of graph.moduleDeps) {
    for (const to of deps) {
      if (from === to) continue
      const v = evaluateEdge(from, to)
      if (v.upward) {
        out.push(
          buildFinding({
            priority: 'P1',
            dimension: 'layering',
            title: `Upward dependency: ${from} -> ${to}`,
            description: `Layer ${v.fromLayer} module \`${from}\` imports layer ${v.toLayer} module \`${to}\`. Dependencies should flow toward the foundation, not upward.`,
            file: modulePathLabel(from),
            line: 0,
            evidence: `edge ${from} -> ${to} (layers ${v.fromLayer} -> ${v.toLayer})`,
            impact: 'Upward dependencies invert the intended layering and couple foundation modules to surface concerns.',
            fixSummary: `Move the shared responsibility into a lower layer, or depend on a contract exposed by \`${to}\` rather than \`${to}\` itself.`,
            fixSteps: ['Identify the symbols imported from the higher layer.', 'Decide whether they belong in a shared lower-layer contract.', 'Re-point the import; otherwise accept the edge as an explicit policy exception.'],
            effort: 'M',
            autoFixable: false,
          }),
        )
      } else if (v.skip) {
        // Skipping DOWN into a foundation module (layer 0) is normal and
        // expected — foundations are imported broadly. Skip-layer findings are
        // advisory only and are emitted in the `deep`/`full` scope.
        if (!skipEnabled || v.toLayer <= 0) continue
        out.push(
          buildFinding({
            priority: 'P2',
            dimension: 'layering',
            title: `Skip-layer dependency: ${from} -> ${to}`,
            description: `Layer ${v.fromLayer} module \`${from}\` imports layer ${v.toLayer} module \`${to}\`, skipping the layer between. Prefer depending on the adjacent layer.`,
            file: modulePathLabel(from),
            line: 0,
            evidence: `edge ${from} -> ${to} (layers ${v.fromLayer} -> ${v.toLayer}, gap ${v.fromLayer - v.toLayer})`,
            impact: 'Skip-layer dependencies bypass intermediate abstractions and make the layer boundary leaky.',
            fixSummary: 'Route the dependency through the intermediate layer, or reclassify the layers in policy.ts if the skip is intentional.',
            fixSteps: ['Confirm the intermediate layer owns the needed capability.', 'Add the dependency at the correct layer.', 'If intentional, add a comment + update policy.ts.'],
            effort: 'M',
            autoFixable: false,
          }),
        )
      }
    }
  }
  return out
}
