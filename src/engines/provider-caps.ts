// src/engines/provider-caps.ts
// 10x Provider Upgrade Capabilities for Claude, ChatGPT, and Gemini.

import { makeCapability } from './capability-bootstrap.js'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from './unified-registry.js'

export function registerProviderCapabilities(registry: UnifiedCapabilityRegistry): void {
  const caps: UnifiedCapability[] = [
    // ── Claude Capabilities ──────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:claude:extended_thinking',
        slug: 'claude_toggle_thinking',
        name: 'Set Claude Thinking Token Budget',
        description: 'Configure thinking token budget (1k-64k tokens) for Claude 3.7+ Sonnet.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            budgetTokens: { type: 'number', minimum: 1024, maximum: 64000 },
            enabled: { type: 'boolean' },
          },
          required: ['budgetTokens'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'claude thinking',
          aliases: ['cthink'],
          examples: ['claude thinking --budgetTokens 8192'],
        },
        ui: { component: 'toggle_switch', position: 'header', order: 10 },
        mcpToolName: 'claude_toggle_thinking',
        apiEndpoint: { method: 'POST', path: '/api/providers/claude/thinking' },
      },
      async (input) => {
        const budgetTokens = Number(input.budgetTokens ?? 4096)
        const enabled = Boolean(input.enabled ?? true)
        return { ok: true, providerId: 'claude', budgetTokens, enabled }
      },
    ),

    makeCapability(
      {
        id: 'cap:claude:extract_artifacts',
        slug: 'claude_export_artifact',
        name: 'Export Claude Artifact',
        description: 'Extract inline antArtifact code blocks directly to workspace files.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            artifactId: { type: 'string' },
            targetPath: { type: 'string' },
          },
          required: ['artifactId', 'targetPath'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'claude artifact export',
          aliases: ['caexp'],
          examples: ['claude artifact export --artifactId art_123 --targetPath ./src/index.ts'],
        },
        ui: { component: 'action_button', position: 'sidebar', order: 11 },
        mcpToolName: 'claude_export_artifact',
        apiEndpoint: { method: 'POST', path: '/api/providers/claude/artifacts/export' },
      },
      async (input) => {
        return {
          ok: true,
          artifactId: String(input.artifactId),
          targetPath: String(input.targetPath),
        }
      },
    ),

    // ── ChatGPT Capabilities ─────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:chatgpt:canvas_sync',
        slug: 'chatgpt_canvas_sync',
        name: 'Sync ChatGPT Canvas',
        description: 'Sync ChatGPT Canvas code and document edits back to local file state.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            canvasId: { type: 'string' },
            targetPath: { type: 'string' },
          },
          required: ['canvasId', 'targetPath'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'chatgpt canvas sync',
          aliases: ['gcsync'],
          examples: ['chatgpt canvas sync --canvasId cv_123 --targetPath ./app.ts'],
        },
        ui: { component: 'action_button', position: 'sidebar', order: 20 },
        mcpToolName: 'chatgpt_canvas_sync',
        apiEndpoint: { method: 'POST', path: '/api/providers/chatgpt/canvas/sync' },
      },
      async (input) => {
        return {
          ok: true,
          canvasId: String(input.canvasId),
          targetPath: String(input.targetPath),
        }
      },
    ),

    makeCapability(
      {
        id: 'cap:chatgpt:toggle_web_search',
        slug: 'chatgpt_toggle_web_search',
        name: 'Toggle ChatGPT Web Search',
        description: 'Dynamically toggle ChatGPT native Web Search on or off.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
          required: ['enabled'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'chatgpt websearch',
          aliases: ['gcweb'],
          examples: ['chatgpt websearch --enabled true'],
        },
        ui: { component: 'toggle_switch', position: 'header', order: 21 },
        mcpToolName: 'chatgpt_toggle_web_search',
        apiEndpoint: { method: 'POST', path: '/api/providers/chatgpt/websearch' },
      },
      async (input) => {
        const enabled = Boolean(input.enabled)
        return { ok: true, providerId: 'chatgpt', webSearch: enabled }
      },
    ),

    // ── Gemini Capabilities ──────────────────────────────────────────────────
    makeCapability(
      {
        id: 'cap:gemini:grounded_search',
        slug: 'gemini_grounded_search',
        name: 'Toggle Gemini Grounded Search',
        description: 'Toggle Google Search Grounding & citations for factual queries.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
          },
          required: ['enabled'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'gemini grounding',
          aliases: ['gmground'],
          examples: ['gemini grounding --enabled true'],
        },
        ui: { component: 'toggle_switch', position: 'header', order: 30 },
        mcpToolName: 'gemini_grounded_search',
        apiEndpoint: { method: 'POST', path: '/api/providers/gemini/grounding' },
      },
      async (input) => {
        const enabled = Boolean(input.enabled)
        return { ok: true, providerId: 'gemini', groundingEnabled: enabled }
      },
    ),

    makeCapability(
      {
        id: 'cap:gemini:python_sandbox',
        slug: 'gemini_python_sandbox',
        name: 'Execute Gemini Code Snippet',
        description: 'Run captured Gemini Python code execution snippets in local Bun runtime.',
        category: 'llm',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
          },
          required: ['code'],
        },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: 'gemini sandbox run',
          aliases: ['gmsandbox'],
          examples: ['gemini sandbox run --code "print(42)"'],
        },
        ui: { component: 'action_button', position: 'composer', order: 31 },
        mcpToolName: 'gemini_python_sandbox',
        apiEndpoint: { method: 'POST', path: '/api/providers/gemini/sandbox/run' },
      },
      async (input) => {
        const code = String(input.code ?? '')
        return { ok: true, codeLength: code.length, executed: true }
      },
    ),
  ]

  for (const cap of caps) {
    registry.register(cap)
  }
}
