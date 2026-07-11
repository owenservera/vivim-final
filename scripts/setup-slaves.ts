#!/usr/bin/env bun
// scripts/setup-slaves.ts
//
// Bootstrap "chrome slaves" with provider accounts already logged in, so the
// agent can run real end-to-end testing against them.
//
// This is the INTERIM login bootstrap. The target design moves this behind the
// frontend (choose profile root + list accounts + click "log in"), but until
// those API/UI units land, this script gets you logged into the main three.
//
// Profile root resolution (highest priority first):
//   1. --profile-base <dir>      CLI flag
//   2. CAP_STORE_PROFILE_DIR     env var
//   3. config.profileBaseDir     platform default (<dataDir>/chrome-profiles)
//
// Layout: <root>/<provider>/<account>  — the exact path ProfileAllocator uses,
// so later ChromeGovernor.spawn(provider, account) reuses the authed session.
//
// Usage:
//   bun run scripts/setup-slaves.ts
//       Spawn a VISIBLE Chrome per account at its login URL. Log in by hand
//       (credentials + 2FA). Cookies persist in the profile dir. Then the
//       script relaunches HEADLESS reusing the same profile to prove the
//       session survives.
//
//   bun run scripts/setup-slaves.ts --verify
//       Relaunch HEADLESS from existing profiles only; confirm auth persists.
//
//   bun run scripts/setup-slaves.ts --profile-base "D:\\vivim-profiles"
//       Choose where profiles are saved (this is what the frontend will drive).

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { BunCdpClient } from '../src/executor/cdp.js'
import { type LaunchResult, killChrome, launchChrome } from '../src/executor/launcher.js'
import { ProfileAllocator } from '../src/executor/profile-allocator.js'
import { config } from '../src/config.js'

interface SetupAccount {
  provider: string
  account: string
  loginUrl: string
}

const ACCOUNTS: SetupAccount[] = [
  { provider: 'chatgpt', account: 'default', loginUrl: 'https://chat.openai.com/' },
  { provider: 'claude', account: 'default', loginUrl: 'https://claude.ai/login' },
  { provider: 'gemini', account: 'default', loginUrl: 'https://gemini.google.com/' },
]

// ── Arg parsing ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const VERIFY_ONLY = argv.includes('--verify')

function readFlag(name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1]
  return undefined
}

const PROFILE_BASE = readFlag('--profile-base') ?? config.profileBaseDir
const BASE_PORT = 9222

const allocator = new ProfileAllocator(PROFILE_BASE)

interface Launched {
  account: SetupAccount
  profileDir: string
  port: number
  result: LaunchResult
}

function ask(question: string): Promise<string> {
  process.stdout.write(`${question} `)
  return Bun.readLine(Bun.stdin).then((l) => (l ?? '').toString().trim())
}

async function launchVisible(account: SetupAccount, port: number): Promise<Launched> {
  const profileDir = await allocator.allocate(account.provider, account.account)
  const result = await launchChrome({
    visible: true,
    debugPort: port,
    profileDir,
    extraArgs: [account.loginUrl],
  })
  return { account, profileDir, port, result }
}

async function launchHeadless(account: SetupAccount, port: number): Promise<Launched> {
  const profileDir = await allocator.allocate(account.provider, account.account)
  const result = await launchChrome({ visible: false, debugPort: port, profileDir })
  return { account, profileDir, port, result }
}

interface VerifyResult {
  alive: boolean
  url?: string
  cookieCount?: number
  loggedIn: boolean
}

async function verifySlave(port: number): Promise<VerifyResult> {
  const client = new BunCdpClient(`ws://127.0.0.1:${port}/devtools/browser`)
  try {
    await client.connect()
    const version = (await client.send('Browser.getVersion')) as { product?: string } | undefined
    const targets = (await client.send('Target.getTargets')) as
      | { targetInfos?: Array<{ type: string; url: string; targetId: string }> }
      | undefined
    const pages = (targets?.targetInfos ?? []).filter((t) => t.type === 'page')
    const url = pages[0]?.url

    let cookieCount: number | undefined
    const pageTarget = pages[0]
    if (pageTarget) {
      try {
        const attached = (await client.send('Target.attachToTarget', {
          targetId: pageTarget.targetId,
          flatten: true,
        })) as { sessionId?: string } | undefined
        const sid = attached?.sessionId
        if (sid) {
          const cookies = (await client.send('Network.getCookies', {}, { sessionId: sid })) as
            | { cookies?: unknown[] }
            | undefined
          cookieCount = cookies?.cookies?.length ?? 0
          await client
            .send('Target.detachFromTarget', { sessionId: sid }, { sessionId: sid })
            .catch(() => {})
        }
      } catch {
        // best-effort: cookie API can be flaky across Chrome builds
      }
    }

    await client.disconnect()

    const notLogin = !!url && !/login|auth|signin|sign-in|account\/login/i.test(url)
    return {
      alive: !!version,
      url,
      cookieCount,
      loggedIn: notLogin || (cookieCount ?? 0) > 0,
    }
  } catch (err) {
    await client.disconnect().catch(() => {})
    return { alive: false, loggedIn: false, url: String(err) }
  }
}

async function run(): Promise<void> {
  console.log('\n=== Chrome Slave Setup ===')
  await mkdir(PROFILE_BASE, { recursive: true })
  console.log(`Profile root: ${PROFILE_BASE}`)
  console.log(
    VERIFY_ONLY
      ? 'Mode: --verify (relaunch headless from existing profiles)\n'
      : 'Mode: interactive (log in manually, then headless reuse is verified)\n',
  )

  const launched: Launched[] = []

  if (!VERIFY_ONLY) {
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const account = ACCOUNTS[i]
      const port = BASE_PORT + i
      console.log(
        `[${i + 1}/${ACCOUNTS.length}] Launching VISIBLE Chrome for ${account.provider}/${account.account} → ${account.loginUrl}`,
      )
      const l = await launchVisible(account, port)
      launched.push(l)
      console.log(`  profile: ${l.profileDir}\n  debugPort: ${port}  pid: ${l.result.pid}`)
      await ask('  >> Log in to the provider in the opened window, then press ENTER:')
    }
  }

  if (VERIFY_ONLY) {
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const account = ACCOUNTS[i]
      const port = BASE_PORT + i
      launched.push(await launchHeadless(account, port))
    }
  }

  // Verify headless reuse: relaunch headless on the same profile dir to prove
  // the authenticated session survives.
  console.log('\n--- Verifying headless reuse (persisted auth) ---')
  let pass = 0
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i]
    const port = BASE_PORT + i
    if (!VERIFY_ONLY) {
      const vis = launched[i]
      await killChrome(vis.result.pid)
      await Bun.sleep(800)
      launched[i] = await launchHeadless(account, port)
    }
    const v = await verifySlave(port)
    const status = v.alive && v.loggedIn ? 'PASS' : 'FAIL'
    if (status === 'PASS') pass++
    console.log(
      `  [${status}] ${account.provider}/${account.account}  alive=${v.alive} cookies=${v.cookieCount ?? '?'} url=${v.url ?? '-'}`,
    )
  }

  console.log(`\n=== Done: ${pass}/${ACCOUNTS.length} slaves verified ===\n`)
  if (pass < ACCOUNTS.length) {
    console.log('Some slaves did not verify. Re-run and log in again, or use --verify once')
    console.log(`profiles exist under ${join(PROFILE_BASE, '<provider>', '<account>')}.\n`)
    process.exitCode = 1
  } else {
    console.log('Profiles are authenticated and persist for headless test runs.')
    console.log('Later: ChromeGovernor.spawn(provider, account) reuses these sessions.\n')
  }
}

run().catch((err) => {
  console.error('Setup failed:', err)
  process.exit(1)
})
