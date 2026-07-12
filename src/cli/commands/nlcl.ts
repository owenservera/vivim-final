// src/cli/commands/nlcl.ts
// CLI command for Natural Language Command Layer.
// Usage: bun run vivim nl "open my resume"
//        bun run vivim nl "go to cnn and summarize the news"
//        bun run vivim nl --list

import type { CommandRegistry, CliOutput } from '../command-registry.js'
import { z } from 'zod'
import { NLCLEngine } from '../../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../../engines/nlcl/types.js'
import { getDb } from '../../storage/db.js'

export function registerNLCLCommand(registry: CommandRegistry): void {
  registry.register({
    name: 'nl',
    description: 'Natural language command — type what you want in plain English',
    subsystem: 'backend',
    schema: z.object({
      args: z.array(z.string()).default([]),
      flags: z.object({
        list: z.string().optional(),
        json: z.string().optional(),
        provider: z.string().optional(),
        surface: z.string().optional(),
      }).default({}),
    }),
    handler: async (args): Promise<CliOutput> => {
      const input = args as { args: string[]; flags: Record<string, string> }

      const engine = new NLCLEngine({ db: getDb() })

      if (input.flags.list !== undefined) {
        const commands = engine.listCommands()
        return {
          data: commands.map((c) => ({
            intent: c.intent,
            description: c.description,
            category: c.category,
            examples: c.examples,
          })),
          format: 'table',
        }
      }

      const rawInput = input.args.join(' ').trim()
      if (!rawInput) {
        return {
          data: { error: 'No command specified. Use: vivim nl "your command here"' },
          format: 'json',
        }
      }

      const ctx: NLCContext = {
        surface: 'cli',
        providerId: input.flags.provider,
        metadata: {},
      }

      const result = await engine.interpret(rawInput, ctx)

      if (input.flags.json !== undefined) {
        return { data: result, format: 'json' }
      }

      return {
        data: {
          ok: result.ok,
          intent: result.intent,
          result: result.text ?? result.error,
          latencyMs: result.latencyMs,
        },
        format: 'pretty',
      }
    },
    examples: [
      'vivim nl "open my resume"',
      'vivim nl "go to cnn and summarize the news"',
      'vivim nl "ask chatgpt what is quantum computing"',
      'vivim nl "send email to john@example.com about the meeting"',
      'vivim nl --list',
    ],
  })
}
