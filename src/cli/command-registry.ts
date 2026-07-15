// src/cli/command-registry.ts
// CLI command registry — stores and retrieves commands

import type { ZodSchema } from 'zod'

export interface CliCommand {
  name: string
  description: string
  subsystem: 'cap-store' | 'backend' | 'extension'
  schema: ZodSchema
  handler: (args: unknown) => Promise<CliOutput>
  examples: string[]
}

export interface CliOutput {
  data: unknown
  format?: 'json' | 'pretty' | 'table'
}

export class CommandRegistry {
  private commands = new Map<string, CliCommand>()

  register(command: CliCommand): void {
    this.commands.set(command.name, command)
  }

  find(name: string): CliCommand | undefined {
    return this.commands.get(name)
  }

  list(subsystem?: string): CliCommand[] {
    const all = Array.from(this.commands.values())
    if (subsystem) return all.filter((c) => c.subsystem === subsystem)
    return all
  }

  /**
   * Resolve a command from a list of argv tokens by matching the longest
   * registered name that is a space-joined prefix of `tokens`. Capability
   * CLI names can be multi-word (e.g. "kernel oracle query").
   * Returns the command and how many tokens it consumed.
   */
  resolve(tokens: string[]): { command: CliCommand | undefined; consumed: number } {
    for (let i = Math.min(tokens.length, 4); i >= 1; i--) {
      const cmd = this.commands.get(tokens.slice(0, i).join(' '))
      if (cmd) return { command: cmd, consumed: i }
    }
    return { command: undefined, consumed: 0 }
  }
}
