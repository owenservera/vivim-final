// src/engines/tool-orchestrator-facade.ts
// C3 wiring: global tool orchestrator facade that wraps the existing McpServerAdapter.callTool
// in the 4-stage IToolOrchestrator pipeline (Authorize → Approve → Execute → Audit).
//
// The 6 callTool sites across the codebase route through globalThis.__toolOrchestrator
// when it's available. When it's not (e.g., in tests), they fall back to direct callTool.
//
// This is the "callTool-level facade" from CONVERGENCE-PLAN §4 C3 [AUDIT R-4b]:
// "an IToolExecutor-backed wrapper around McpClientAdapter that the 4 engines inject
// in place of their direct this.mcpClient / this.mcp dependency."

import type { ToolCallContent, ToolDefinition } from '../ai/core/types.js'
import type { IToolOrchestrator } from '../ai/tools/orchestrator.js'
import { type IToolExecutor, ToolOrchestrator } from '../ai/tools/tool-orchestrator-impl.js'
import type { McpServerAdapter } from './mcp-server-adapter.js'

/**
 * Create a ToolOrchestrator that wraps an McpServerAdapter's callTool as the executor.
 * The orchestrator runs Authorize → Approve → Execute → Audit on every tool call.
 */
export function createMcpToolOrchestrator(mcpServer: McpServerAdapter): IToolOrchestrator {
  const executor: IToolExecutor = {
    async execute(tool: ToolDefinition, call: ToolCallContent, _signal?: AbortSignal) {
      // Delegate to the McpServerAdapter's existing callTool
      const result = await mcpServer.callTool(tool.name, call.arguments as Record<string, unknown>)
      return result
    },
  }
  return new ToolOrchestrator({ executor })
}

/**
 * Activate the global tool orchestrator at boot. Call this after McpServerAdapter is constructed.
 * Exposes as globalThis.__toolOrchestrator so callTool sites can route through it.
 */
export function activateToolOrchestrator(mcpServer: McpServerAdapter): IToolOrchestrator {
  const orchestrator = createMcpToolOrchestrator(mcpServer)
  ;(globalThis as Record<string, unknown>).__toolOrchestrator = orchestrator
  return orchestrator
}

/**
 * Global facade function that the 6 callTool sites call instead of this.mcpClient.callTool().
 * Routes through the orchestrator when available; falls back to direct callTool when not.
 *
 * Usage at call sites:
 *   const result = await callToolViaOrchestrator(this.mcpClient, serverId, toolName, input)
 *   const result = await callToolViaOrchestrator(this.mcp, toolName, input)  // 2-arg form
 */
export async function callToolViaOrchestrator(
  mcpClient: { callTool: (...args: never[]) => Promise<unknown> },
  serverIdOrToolName: string,
  toolNameOrInput?: string | Record<string, unknown>,
  input?: Record<string, unknown>,
): Promise<unknown> {
  const orchestrator = (globalThis as Record<string, unknown>).__toolOrchestrator as
    | IToolOrchestrator
    | undefined

  // Normalize the 2 calling conventions:
  //   3-arg: callTool(serverId, toolName, input)  — live-capability-registry, tool-use-protocol
  //   2-arg: callTool(toolName, input)            — workflow-engine, selector-healer, image-gen-bridge
  let actualToolName: string
  let actualInput: Record<string, unknown>
  if (typeof toolNameOrInput === 'string') {
    // 3-arg form: (serverId, toolName, input)
    actualToolName = toolNameOrInput
    actualInput = input ?? {}
  } else {
    // 2-arg form: (toolName, input)
    actualToolName = serverIdOrToolName
    actualInput = (toolNameOrInput as Record<string, unknown>) ?? {}
  }

  if (!orchestrator) {
    // Fallback: direct callTool (preserves existing behavior when orchestrator not wired)
    if (typeof toolNameOrInput === 'string') {
      return mcpClient.callTool(
        serverIdOrToolName as never,
        toolNameOrInput as never,
        (input ?? {}) as never,
      )
    }
    return mcpClient.callTool(serverIdOrToolName as never, (toolNameOrInput ?? {}) as never)
  }

  // Route through the 4-stage pipeline
  const tool: ToolDefinition = {
    name: actualToolName,
    inputSchema: { type: 'object' },
  }
  const call: ToolCallContent = {
    type: 'tool-call',
    id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as never,
    name: actualToolName,
    arguments: actualInput,
  }
  return orchestrator.handle(tool, call, { agentInitiated: false })
}
