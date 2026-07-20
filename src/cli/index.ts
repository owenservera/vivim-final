// src/cli/index.ts
// CLI entry point — parses argv, routes to command registry.
// Supports two modes:
//   1. In-process — after connectCapabilityRegistry() during server boot
//   2. Thin-client — fetches capabilities from a running server via HTTP

import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { CommandRegistry } from './command-registry.js'
import { registerBuiltinCommands } from './commands/builtins.js'
import { syncCliFromUnified } from './commands/registry-bridge.js'
import { executeRemote, fetchCliCapabilities, matchCapability } from './commands/registry-bridge.js'
import { OutputFormatter, type OutputMode } from './output-formatter.js'

const registry = new CommandRegistry()
const formatter = new OutputFormatter()

const DEFAULT_PORT = 9420

// Registry for capability-bridged commands
export let capabilityRegistry: UnifiedCapabilityRegistry | null = null

function parseArgs(argv: string[]): {
  tokens: string[]
  flags: Record<string, string>
} {
  const raw = argv.slice(2)
  const tokens: string[] = []
  const flags: Record<string, string> = {}

  for (const arg of raw) {
    if (!arg) continue
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=')
      if (key) {
        flags[key] = rest.length > 0 ? rest.join('=') : ''
      }
    } else {
      tokens.push(arg)
    }
  }

  return { tokens, flags }
}

function serverUrl(): string {
  const port = process.env.PORT ?? process.env.CAP_STORE_PORT ?? String(DEFAULT_PORT)
  return `http://localhost:${port}`
}

// Called by server bootstrap after capability registry is constructed
export function connectCapabilityRegistry(reg: UnifiedCapabilityRegistry): void {
  capabilityRegistry = reg
  syncCliFromUnified(reg, registry)
  registerBuiltinCommands(registry)
}

async function showHelp(): Promise<void> {
  const cmds = registry.list()

  if (cmds.length === 0) {
    // Try thin-client: fetch from running server
    try {
      const remote = serverUrl()
      const remoteCaps = await fetchCliCapabilities(remote)
      if (remoteCaps.length === 0) {
        console.log('No commands registered. Start the server first: bun run serve')
        return
      }
      console.log(`Available commands (from ${remote}):\n`)
      for (const cap of remoteCaps) {
        const aliases = cap.cliCommand?.aliases?.length
          ? ` [${cap.cliCommand.aliases.join(', ')}]`
          : ''
        console.log(`  ${cap.cliCommand?.name ?? cap.slug}${aliases} — ${cap.description}`)
      }
      console.log(`\n  Total: ${remoteCaps.length} commands`)
      return
    } catch {
      console.log('No commands registered. Start the server first: bun run serve')
      return
    }
  }

  console.log('Available commands:')
  const bySubsystem = new Map<string, { name: string; description: string }[]>()
  for (const cmd of cmds) {
    const group = cmd.subsystem ?? 'general'
    const list = bySubsystem.get(group) ?? []
    list.push({ name: cmd.name, description: cmd.description })
    bySubsystem.set(group, list)
  }
  for (const [group, entries] of bySubsystem) {
    console.log(`\n  [${group}]`)
    for (const e of entries) {
      console.log(`    ${e.name.padEnd(28)} ${e.description}`)
    }
  }
  const total = cmds.length
  console.log(`\n  Total: ${total} commands`)
}

async function main(): Promise<void> {
  const { tokens, flags } = parseArgs(process.argv)

  // Builtin commands are always available in-process (not behind the bridge).
  registerBuiltinCommands(registry)

  if (tokens[0] === 'serve') {
    const { createServerWithEngines } = await import('../server/index.js')
    const port = Number(process.env.PORT ?? process.env.CAP_STORE_PORT ?? DEFAULT_PORT)
    const ctx = await createServerWithEngines(port)
    console.log(`vivim server listening on :${ctx.port}`)
    return
  }

  if (tokens[0] === 'help' || tokens.length === 0) {
    await showHelp()
    return
  }

  // Phase 1: try in-process registry
  const { command, consumed } = registry.resolve(tokens)
  if (command) {
    const args = tokens.slice(consumed)
    const mode: OutputMode = (flags.json as OutputMode) ?? 'pretty'
    const result = await command.handler({ args, flags })
    console.log(formatter.format(result.data, mode))
    return
  }

  // Phase 2: thin-client mode — try running server
  try {
    const remote = serverUrl()
    const remoteCaps = await fetchCliCapabilities(remote)
    const matched = matchCapability(remoteCaps as Parameters<typeof matchCapability>[0], tokens)
    if (matched) {
      const { cap, rest } = matched
      const result = await executeRemote(remote, cap.id, rest, flags)
      const mode: OutputMode = (flags.json as OutputMode) ?? 'pretty'
      console.log(formatter.format(result, mode))
      return
    }
  } catch {
    // Server not reachable — fall through to error
  }

  console.error(`Unknown command: ${tokens.join(' ')}`)
  console.error('Start the server with: bun run serve')
  process.exit(1)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

export { registry }
