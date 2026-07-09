// src/schema/harness.ts
// Harness runtime types — used by HarnessRuntime and WorkflowEngine.

export interface HarnessNode {
  id: string
  moduleName: string
  input: Record<string, unknown>
  dependsOn: string[]
  retryPolicy: { maxRetries: number; backoffMs: number }
  timeoutMs: number
}

export interface HarnessDAG {
  id: string
  name: string
  nodes: HarnessNode[]
  edges: { from: string; to: string }[]
  timeoutMs: number
}

export interface HarnessModule {
  id: string
  name: string
  execute(
    input: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }>
}

export interface HarnessTelemetry {
  dagId: string
  nodeId: string
  eventType: string
  durationMs: number
  ok: boolean
  error?: string
}

export interface HarnessCheckpoint {
  id: string
  dagId: string
  executedNodes: string[]
  stateJson: string
  pageState?: { url: string; title: string }
}
