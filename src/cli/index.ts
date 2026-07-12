// src/cli/index.ts
// CLI entry point — parses argv, routes to command registry

import { CommandRegistry } from './command-registry.js'
import { OutputFormatter, type OutputMode } from './output-formatter.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { syncCliFromUnified } from './commands/registry-bridge.js'

const registry = new CommandRegistry()
const formatter = new OutputFormatter()

// Registry for capability-bridged commands
export let capabilityRegistry: UnifiedCapabilityRegistry | null = null

function parseArgs(argv: string[]): {
  command: string
  args: string[]
  flags: Record<string, string>
} {
  const raw = argv.slice(2)
  const command = raw[0] ?? 'help'
  const args: string[] = []
  const flags: Record<string, string> = {}

  for (let i = 1; i < raw.length; i++) {
    const arg = raw[i]
    if (!arg) continue
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=')
      if (key) flags[key] = (rest.join('=') || raw[i + 1]) ?? ''
      if (!rest.length) i++
    } else {
      args.push(arg)
    }
  }

  return { command, args, flags }
}

// Register built-in non-capability commands
import { registerVersionCommands } from './commands/version.js'
import { registerHealthCommands } from './commands/health.js'
import { registerSystemCommands } from './commands/system.js'
import { registerFleetCommands } from './commands/fleet.js'
import { registerProvidersCommands } from './commands/providers.js'
import { registerConfigCommands } from './commands/config.js'
import { registerKernelCommands } from './commands/kernel.js'
import { registerDiscoveryCommands } from './commands/discovery.js'

// Initialize registry with built-in commands
function initializeRegistry(): void {
  registerVersionCommands(registry, { baseUrl: process.env.CAPSTORE_URL ?? 'http://localhost:9420' })
  registerHealthCommands(registry, { baseUrl: process.env.CAPSTORE_URL ?? 'http://localhost:9420' })
  registerSystemCommands(registry)
  registerFleetCommands(registry)
  registerProvidersCommands(registry)
  // Discovery commands run locally against a logged-in profile (no server needed)
  registerDiscoveryCommands(registry)
  // Config commands use HTTP bridge (for remote config API)
  registerConfigCommands(registry, { baseUrl: process.env.CAPSTORE_URL ?? 'http://localhost:9420' })
  // Kernel commands use universal config surface (local-only, no HTTP needed)
  registerKernelCommands(registry, { kernel: null as any, configSurface: null as any })
}

initializeRegistry()

// Called by server bootstrap after capability registry is constructed
export function connectCapabilityRegistry(reg: UnifiedCapabilityRegistry): void {
  capabilityRegistry = reg
  syncCliFromUnified(reg, registry)
}

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv)

  if (command === 'help') {
    const cmds = registry.list()
    console.log('Available commands:')
    for (const cmd of cmds) {
      console.log(`  ${cmd.name} — ${cmd.description}`)
    }
    return
  }

  const cmd = registry.find(command)
  if (!cmd) {
    console.error(`Unknown command: ${command}`)
    process.exit(1)
  }

  const mode: OutputMode = (flags.json as OutputMode) ?? 'pretty'
  const result = await cmd.handler({ args, flags })
  console.log(formatter.format(result.data, mode))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

export { registry, connectCapabilityRegistry }