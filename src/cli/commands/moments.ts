#!/usr/bin/env bun
// src/cli/commands/moments.ts
// CLI command for user journey moments.
// Uses the SAME API endpoints as the frontend wizard.
// Source: 'cli' — tracked in backend audit logs.

import type { Source } from '../../../shared/api-types.js'
import { createSetupClient } from '../../api/setup-client.js'
import { config } from '../../config.js'

const client = createSetupClient({
  source: 'cli' as Source,
  baseUrl: config.vivimApiUrl ?? undefined,
})

const SUBCOMMANDS = {
  async list() {
    const profiles = await client.getProfiles()
    if (profiles.profiles.length === 0) {
      // [audit] removed: console.log('  (none)')
    }
    for (const p of profiles.profiles) {
      const icon = p.providerId === 'chatgpt' ? '🤖' : p.providerId === 'claude' ? '🪨' : '💎'
      console.log(`  ${icon} ${p.providerId}/${p.accountSlug}`)
    }
  },

  async launch(providerId: string, accountSlug: string) {
    const workspace = config.vivimWorkspace ?? 'C:\\.config\\vivim'
    console.log(`\nLaunching Chrome for ${providerId}...`)
    const result = await client.launchVisible({
      providerId,
      accountSlug,
      workspace,
    })
    console.log(`  Port: ${result.debugPort}`)
    console.log(`  Profile: ${result.profileDir}`)
    console.log(`  Login URL: ${result.loginUrl}`)
    console.log('\nLog in in the Chrome window, then run:')
    console.log(`  bun run devops moments verify ${result.debugPort} ${providerId}`)
  },

  async verify(port: number, providerId: string) {
    const result = await client.verify({ port, providerId })
    if (result.loggedIn) {
      console.log(`  ✓ Logged in (method: ${result.method})`)
    } else {
      console.log(`  URL: ${result.url}`)
    }
    return result.loggedIn
  },

  async complete(providerId: string, accountSlug: string, profileDir: string, debugPort: number) {
    const workspace = config.vivimWorkspace ?? 'C:\\.config\\vivim'
    console.log(`\nCompleting setup for ${providerId}/${accountSlug}...`)
    const result = await client.complete({
      providerId,
      accountSlug,
      workspace,
      profileDir,
      debugPort,
    })
    console.log(`  ✓ Account saved: ${result.accountId}`)
  },

  async health() {
    const result = await client.health()
    console.log(`\n  Status: ${result.status}`)
    console.log(`  Version: ${result.version}`)
  },

  async setup(providerId: string, accountSlug: string) {
    // Full setup flow: launch → wait → verify → complete
    console.log(`\n=== Setting up ${providerId}/${accountSlug} ===\n`)

    const workspace = config.vivimWorkspace ?? 'C:\\.config\\vivim'

    // 1. Launch
    console.log('[1/3] Launching Chrome...')
    const launch = await client.launchVisible({ providerId, accountSlug, workspace })
    console.log(`  PID: ${launch.pid}, Port: ${launch.debugPort}`)

    // 2. Wait for user to log in
    console.log('  (Log in the Chrome window, then press Enter here)')
    await new Promise((resolve) => {
      process.stdin.resume()
      process.stdin.on('data', () => resolve(undefined))
    })
    // 3. Verify
    const verifyResult = await client.verify({ port: launch.debugPort, providerId })
    if (!verifyResult.loggedIn) {
      console.log('  ✗ Login not detected. Try again with: bun run devops moments verify')
      return
    }
    console.log(`  ✓ Detected (method: ${verifyResult.method})`)
    // 4. Complete
    await client.complete({
      providerId,
      workspace,
      accountSlug,
      profileDir: launch.profileDir,
      debugPort: launch.debugPort,
    })
    console.log('\n✓ Setup complete!\n')
  },
}

export async function runMoments(args: string[]): Promise<void> {
  const sub = args[0] ?? 'list'

  try {
    switch (sub) {
      case 'list':
        await SUBCOMMANDS.list()
        break
      case 'launch':
        if (!args[1] || !args[2]) {
          console.error('Usage: moments launch <providerId> <accountSlug>')
          process.exit(1)
        }
        await SUBCOMMANDS.launch(args[1], args[2])
        break
      case 'verify':
        if (!args[1] || !args[2]) {
          console.error('Usage: moments verify <port> <providerId>')
          process.exit(1)
        }
        await SUBCOMMANDS.verify(Number.parseInt(args[1]), args[2])
        break
      case 'complete':
        if (!args[1] || !args[2] || !args[3] || !args[4]) {
          console.error(
            'Usage: moments complete <providerId> <accountSlug> <profileDir> <debugPort>',
          )
          process.exit(1)
        }
        await SUBCOMMANDS.complete(args[1], args[2], args[3], Number.parseInt(args[4]))
        break
      case 'health':
        await SUBCOMMANDS.health()
        break
      case 'setup':
        if (!args[1] || !args[2]) {
          console.error('Usage: moments setup <providerId> <accountSlug>')
          process.exit(1)
        }
        await SUBCOMMANDS.setup(args[1], args[2])
        break
      default:
        console.log(`
User Journey Moments — CLI

Commands:
  list                          List all provider accounts
  launch <provider> <slug>      Launch Chrome for login
  verify <port> <provider>      Verify login state
  complete <provider> <slug> <dir> <port>  Save account
  health                        Check server health
  setup <provider> <slug>       Full setup flow (interactive)

All commands call the same API endpoints as the frontend wizard.
The X-Source header tracks which surface initiated each request.
`)
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  runMoments(process.argv.slice(2)).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
