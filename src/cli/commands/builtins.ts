// src/cli/commands/builtins.ts
// Registers hand-written CLI commands (automate, moments) into the
// CommandRegistry so they appear in `help` and resolve through the
// multi-word dispatcher — same as bridged capability commands.

import { z } from 'zod'
import type { CliCommand, CommandRegistry } from '../command-registry.js'
import { runAutomate } from './automate.js'
import { runMoments } from './moments.js'
import { runSeed } from './seed.js'
import { runMigrate } from './migrate.js'

/**
 * Register the hand-written builtin commands. Called from src/cli/index.ts
 * main() after the capability bridge runs. These commands bypass the
 * UnifiedCapabilityRegistry and talk to the API directly (legacy pattern),
 * but are now first-class members of the CLI command tree.
 */
export function registerBuiltinCommands(registry: CommandRegistry): void {
  const automate: CliCommand = {
    name: 'automate',
    description: 'Agent-driven frontend automation (navigate, click, type, screenshot, ...)',
    subsystem: 'extension',
    schema: z.object({ args: z.array(z.string()).optional() }).passthrough(),
    examples: [
      'automate navigate http://localhost:5173',
      'automate click "button[data-testid=\'send\']"',
      'automate screenshot',
    ],
    handler: async (args: unknown) => {
      const a = (args ?? {}) as { args?: string[] }
      await runAutomate(a.args ?? [])
      return { data: null }
    },
  }

  const moments: CliCommand = {
    name: 'moments',
    description:
      'User-journey moments — provider account setup (list, launch, verify, complete, health, setup)',
    subsystem: 'backend',
    schema: z.object({ args: z.array(z.string()).optional() }).passthrough(),
    examples: ['moments list', 'moments launch chatgpt my-account', 'moments health'],
    handler: async (args: unknown) => {
      const a = (args ?? {}) as { args?: string[] }
      await runMoments(a.args ?? [])
      return { data: null }
    },
  }

  const seed: CliCommand = {
    name: 'seed',
    description: 'Seed the database with initial data',
    subsystem: 'backend',
    schema: z.object({ args: z.array(z.string()).optional() }).passthrough(),
    examples: ['seed all'],
    handler: async (args: unknown) => {
      const a = (args ?? {}) as { args?: string[] }
      await runSeed(a.args ?? [])
      return { data: null }
    },
  }

  const migrate: CliCommand = {
    name: 'migrate',
    description: 'Run database migrations',
    subsystem: 'backend',
    schema: z.object({ args: z.array(z.string()).optional() }).passthrough(),
    examples: ['migrate all'],
    handler: async (args: unknown) => {
      const a = (args ?? {}) as { args?: string[] }
      await runMigrate(a.args ?? [])
      return { data: null }
    },
  }

  registry.register(automate)
  registry.register(moments)
  registry.register(seed)
  registry.register(migrate)
}
