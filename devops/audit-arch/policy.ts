// devops/audit-arch/policy.ts
// The layering policy: assigns each module to an integer layer and declares
// the canonical dependency direction. This is the single source of truth for
// the `layering` pass and is intentionally EASY TO TUNE — edit LAYER_RULES to
// reflect the real intended architecture.
//
// Dependency rule (Martin-style): a module may depend on modules at its own
// layer or BELOW it (more foundational). A dependency on a HIGHER layer is an
// "upward" violation; skipping layers is a softer "skip-layer" smell.
//
// Layer numbers are ordinal only:
//   0  foundation (ids, errors, config, schema, storage contracts/db)
//   1  provider + chrome substrate (executor, kernel, provider-*, governor)
//   2  capability system (capability*, session*, *caps)
//   3  session/state + memory (conversation*, stream*, memory*, mirror, context)
//   4  orchestration / NL / autonomy (nlcl, agentic-loop, autonomous*, workflow*, plugins)
//   5  surface (canvas, router, server, cli, mcp)
// Anything not matched falls into DEFAULT_LAYER (3) and still obeys relative
// direction, so the tool is robust even before the policy is fully tuned.

export interface LayerRule {
  // module key prefix (module key === this string, or starts with "prefix/")
  prefix: string
  layer: number
}

export const LAYER_RULES: LayerRule[] = [
  // Layer 0 — foundation
  { prefix: 'ids', layer: 0 },
  { prefix: 'errors', layer: 0 },
  { prefix: 'config', layer: 0 },
  { prefix: 'schema', layer: 0 },
  { prefix: 'storage/contracts', layer: 0 },
  { prefix: 'storage/db', layer: 0 },
  { prefix: 'storage/prisma', layer: 0 },
  { prefix: 'storage/store-factory', layer: 0 },
  // Layer 1 — provider + chrome substrate
  { prefix: 'executor', layer: 1 },
  { prefix: 'engines/kernel', layer: 1 },
  { prefix: 'engines/provider', layer: 1 },
  { prefix: 'engines/chrome-governor', layer: 1 },
  { prefix: 'engines/provider-health', layer: 1 },
  { prefix: 'engines/provider-mux', layer: 1 },
  { prefix: 'engines/provider-registrar', layer: 1 },
  { prefix: 'engines/provider-selectors', layer: 1 },
  { prefix: 'engines/provider-discovery', layer: 1 },
  { prefix: 'engines/cdp', layer: 1 },
  { prefix: 'engines/registration-auditor', layer: 1 },
  // Layer 2 — capability system
  { prefix: 'engines/capability', layer: 2 },
  { prefix: 'engines/session', layer: 2 },
  { prefix: 'engines/capability-shape-registry', layer: 2 },
  { prefix: 'engines/capability-event-bus', layer: 2 },
  { prefix: 'engines/capability-resolution', layer: 2 },
  { prefix: 'engines/capability-macro', layer: 2 },
  { prefix: 'engines/send-capability', layer: 2 },
  { prefix: 'engines/cdp-capability', layer: 2 },
  { prefix: 'engines/cdp-discovery', layer: 2 },
  { prefix: 'engines/streaming', layer: 2 },
  // Layer 3 — session/state + memory
  { prefix: 'engines/conversation', layer: 3 },
  { prefix: 'engines/stream', layer: 3 },
  { prefix: 'engines/memory', layer: 3 },
  { prefix: 'engines/mirror-engine', layer: 3 },
  { prefix: 'engines/context-assembly', layer: 3 },
  { prefix: 'engines/adaptive-workspace', layer: 3 },
  // Layer 4 — orchestration / NL / autonomy
  { prefix: 'engines/nlcl', layer: 4 },
  { prefix: 'engines/agentic-loop', layer: 4 },
  { prefix: 'engines/autonomous', layer: 4 },
  { prefix: 'engines/workflow', layer: 4 },
  { prefix: 'engines/plugin', layer: 4 },
  { prefix: 'engines/mcp-client-adapter', layer: 4 },
  { prefix: 'engines/mcp-server-adapter', layer: 4 },
  { prefix: 'engines/harness', layer: 4 },
  { prefix: 'engines/tool-use-protocol', layer: 4 },
  { prefix: 'engines/knowledge', layer: 4 },
  // Layer 5 — surface
  { prefix: 'index', layer: 5 }, // public barrel re-exports the whole surface
  { prefix: 'canvas', layer: 5 },
  { prefix: 'router', layer: 5 },
  { prefix: 'server', layer: 5 },
  { prefix: 'cli', layer: 5 },
  { prefix: 'mcp', layer: 5 },
  { prefix: 'engines/airgap', layer: 5 },
  { prefix: 'engines/version-manager', layer: 5 },
  { prefix: 'engines/telemetry-aggregator', layer: 5 },
  { prefix: 'engines/telemetry-audit', layer: 5 },
]

export const DEFAULT_LAYER = 3
export const FOUNDATION_LAYER = 0

export function layerOf(moduleKey: string): number {
  // Longest prefix match wins so "engines/provider-health" beats "engines/provider".
  let best = -1
  let bestLen = -1
  for (const r of LAYER_RULES) {
    if (moduleKey === r.prefix || moduleKey.startsWith(`${r.prefix}/`)) {
      if (r.prefix.length > bestLen) {
        bestLen = r.prefix.length
        best = r.layer
      }
    }
  }
  return best >= 0 ? best : DEFAULT_LAYER
}

export interface LayerEdgeVerdict {
  from: string
  to: string
  fromLayer: number
  toLayer: number
  upward: boolean // depends on a HIGHER (less foundational) layer
  skip: boolean // skips >=1 layer downward
}

export function evaluateEdge(from: string, to: string): LayerEdgeVerdict {
  const fromLayer = layerOf(from)
  const toLayer = layerOf(to)
  const upward = toLayer > fromLayer
  const skip = !upward && fromLayer - toLayer >= 2
  return { from, to, fromLayer, toLayer, upward, skip }
}
