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
}
