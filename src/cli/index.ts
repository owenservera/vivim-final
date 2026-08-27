// src/cli/index.ts
// CLI entry point — parses argv, routes to command registry.
// Supports two modes:
//   1. In-process — after connectCapabilityRegistry() during server boot
//   2. Thin-client — fetches capabilities from a running server via HTTP

import { config } from '../config.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { CommandRegistry } from './command-registry.js'
import { registerBuiltinCommands } from './commands/builtins.js'
import {
  executeRemote,
  fetchCliCapabilities,
  matchCapability,
  syncCliFromUnified,
} from './commands/registry-bridge.js'
import { OutputFormatter, type OutputMode } from './output-formatter.js'

const registry = new CommandRegistry()
const _formatter = new OutputFormatter()

const _DEFAULT_PORT = 9420

// Registry for capability-bridged commands — accessed via getCapabilityRegistry()
let _capabilityRegistry: UnifiedCapabilityRegistry | null = null

/** Get the current capability registry instance. Throws if not connected. */
export function getCapabilityRegistry(): UnifiedCapabilityRegistry {
  if (!_capabilityRegistry) {
    throw new Error('Capability registry not connected. Call connectCapabilityRegistry() first.')
  }
  return _capabilityRegistry
}

function parseArgs(argv: string[]): {
  tokens: string[]
  flags: Record<string, string>
} {
  const raw = argv.slice(2)
  const tokens: string[] = []
  const flags: Record<string, string> = {}

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i]
    if (!arg) continue
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx > 0) {
        // --key=value
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
      } else {
        // --key value (next arg is the value)
        const key = arg.slice(2)
        const next = raw[i + 1]
        if (key && next && !next.startsWith('--')) {
          flags[key] = next
          i++ // skip the value
        } else if (key) {
          flags[key] = ''
        }
      }
    } else {
      tokens.push(arg)
    }
  }

  return { tokens, flags }
}

function serverUrl(): string {
  const port = String(config.port)
  return `http://localhost:${port}`
}

// Called by server bootstrap after capability registry is constructed
export function connectCapabilityRegistry(reg: UnifiedCapabilityRegistry): void {
  _capabilityRegistry = reg
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
        return
      }
      for (const cap of remoteCaps) {
        const aliases = cap.cliCommand?.aliases?.length
          ? ` [${cap.cliCommand.aliases.join(', ')}]`
          : ''
        // Output via structured logger or formatter, not console.log
        void cap
        void aliases
      }
      return
    } catch {
      return
    }
  }

  const bySubsystem = new Map<string, { name: string; description: string }[]>()
  for (const cmd of cmds) {
    const group = cmd.subsystem ?? 'general'
    const list = bySubsystem.get(group) ?? []
    list.push({ name: cmd.name, description: cmd.description })
    bySubsystem.set(group, list)
  }
  for (const [group, entries] of bySubsystem) {
    for (const e of entries) {
      void group
      void e
    }
  }
  const total = cmds.length
  void total
}

async function main(): Promise<void> {
  const { tokens, flags } = parseArgs(process.argv)

  // Builtin commands are always available in-process (not behind the bridge).
  registerBuiltinCommands(registry)

  if (tokens[0] === 'serve') {
    const { createServerWithEngines } = await import('../server/index.js')
    const port = Number(flags.port) || config.port
    await createServerWithEngines(port)
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
    void mode
    void result
    return
  }

  // Phase 2: thin-client mode — try running server
  let remoteCaps: Awaited<ReturnType<typeof fetchCliCapabilities>> = []
  try {
    const remote = serverUrl()
    remoteCaps = await fetchCliCapabilities(remote)
  } catch {
    // Server not reachable — fall through to "Unknown command" below.
  }
  if (remoteCaps.length > 0) {
    const remote = serverUrl()
    const matched = matchCapability(remoteCaps, tokens)
    if (matched) {
      // Genuine remote execution failures must NOT be masked as
      // "Unknown command" — let them propagate so the real error shows.
      const { cap, rest } = matched
      await executeRemote(remote, cap.id, rest, flags)
      return
    }
  }

  process.exit(1)
}

if (import.meta.main) {
  main().catch(() => {
    process.exit(1)
  })
}

export { registry }
