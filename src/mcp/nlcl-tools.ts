// src/mcp/nlcl-tools.ts
// NLCL MCP tools — expose the Natural Language Command Layer as MCP tools.
// Allows AI agents (Claude, GPT, etc.) to interpret + execute NL commands.

import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'

/** F2: Structural interface so both DiscoveryMcpServer and McpServerAdapter satisfy it. */
export interface NLCLToolHost {
  tool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<{ content: unknown; isError?: boolean }>,
  ): void
}

export function registerNLCLTools(server: NLCLToolHost, engine: NLCLEngine): void {
  server.tool(
    'nl_command',
    'Execute a natural language command. Type what you want in plain English — the system deterministically parses and executes it. No AI required for 95% of commands.',
    {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description:
            'Natural language command (e.g. "open my resume", "go to cnn and summarize the news")',
        },
        surface: {
          type: 'string',
          description: 'Originating surface (cli, ui, api, mcp)',
          default: 'mcp',
        },
        providerId: {
          type: 'string',
          description: 'Preferred provider for LLM operations',
        },
        conversationId: {
          type: 'string',
          description: 'Active conversation ID',
        },
      },
      required: ['input'],
    },
    async (args) => {
      const rawInput = (args.input as string)?.trim()
      if (!rawInput) {
        return {
          content: [{ type: 'text', text: 'Error: No input provided' }],
          isError: true,
        }
      }

      const ctx: NLCContext = {
        surface: ((args.surface as string) ?? 'mcp') as NLCContext['surface'],
        providerId: args.providerId as string | undefined,
        conversationId: args.conversationId as string | undefined,
        metadata: {},
      }

      const result = await engine.interpret(rawInput, ctx)

      const response = [
        `Intent: ${result.intent}`,
        `Status: ${result.ok ? 'success' : 'failed'}`,
        result.text ? `Result: ${result.text}` : '',
        result.error ? `Error: ${result.error}` : '',
        result.followUp ? `Note: ${result.followUp}` : '',
        `Latency: ${result.latencyMs}ms`,
      ]
        .filter(Boolean)
        .join('\n')

      return {
        content: [{ type: 'text', text: response }],
        isError: !result.ok,
      }
    },
  )

  server.tool(
    'nl_list_commands',
    'List all available natural language commands with their patterns and examples.',
    {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (file, browser, email, app, conversation, llm, system)',
        },
      },
    },
    async (args) => {
      const commands = engine.listCommands({
        category: args.category as string | undefined,
      })

      const lines = commands.map(
        (c) => `- ${c.intent}: ${c.description}\n  Examples: ${c.examples.slice(0, 3).join(' | ')}`,
      )

      return {
        content: [
          {
            type: 'text',
            text: `Available commands (${commands.length}):\n\n${lines.join('\n\n')}`,
          },
        ],
      }
    },
  )

  server.tool(
    'nl_help',
    'Get help on available natural language commands, organized by category.',
    { type: 'object', properties: {} },
    async () => {
      const help = engine.getHelp()
      const lines: string[] = [`Total commands: ${help.totalCommands}`, '']
      for (const [category, cmds] of Object.entries(help.categories)) {
        lines.push(`## ${category.toUpperCase()}`)
        for (const cmd of cmds) {
          lines.push(`  ${cmd}`)
        }
        lines.push('')
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )
}
