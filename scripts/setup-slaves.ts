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
//   3. <cwd>/data/chrome-profiles/by-provider-then-account
//      (relative to the current working directory; the default for this repo)
//
// Account naming: you are prompted for the email you will use to log in, and
// the profile folder is named <provider>_<emaillocalpart>, e.g. for
// chatgpt logging in as owservera@x.com the folder is chatgpt_owservera.
//
// Layout: <root>/<provider>/<provider>_<emaillocalpart>
//   — the exact path ProfileAllocator uses, so later
//     ChromeGovernor.spawn(provider, account) reuses the authed session.
//
// Usage:
//   bun run scripts/setup-slaves.ts
//       For each provider, prompt for your login email, then spawn a VISIBLE
//       Chrome at its login URL. Log in by hand (credentials + 2FA). Cookies
//       persist in the named profile dir. Then the script relaunches HEADLESS
//       reusing the same profile to prove the session survives.
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

interface SetupProvider {
  provider: string
  loginUrl: string
}

const PROVIDERS: SetupProvider[] = [
  { provider: 'chatgpt', loginUrl: 'https://chat.openai.com/' },
  { provider: 'claude', loginUrl: 'https://claude.ai/login' },
  { provider: 'gemini', loginUrl: 'https://gemini.google.com/' },
]

// Derive the profile folder name from the login email, e.g.
//   "owservera@gmail.com" + provider "chatgpt" -> "chatgpt_owservera"
function accountFromEmail(provider: string, email: string): string {
  const local = email
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9]+/g, '')
  return `${provider}_${local || 'default'}`
}

// ── Arg parsing ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const VERIFY_ONLY = argv.includes('--verify')

function readFlag(name: string): string | undefined {
  const i = argv.indexOf(name)
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1]
  return undefined
}

const PROFILE_BASE =
  readFlag('--profile-base') ??
  process.env.CAP_STORE_PROFILE_DIR ??
  join(process.cwd(), 'data', 'chrome-profiles', 'by-provider-then-account')

const BASE_PORT = 9222

const allocator = new ProfileAllocator(PROFILE_BASE)

interface Session {
  provider: string
  account: string
  port: number
  profileDir: string
  visiblePid?: number
}

function ask(question: string): Promise<string> {
  process.stdout.write(`${question} `)
  return Bun.readLine(Bun.stdin).then((l) => (l ?? '').toString().trim())
}

async function launchVisible(
  provider: string,
  account: string,
  loginUrl: string,
  port: number,
): Promise<Session> {
  const profileDir = await allocator.allocate(provider, account)
  const result = await launchChrome({
    visible: true,
    debugPort: port,
    profileDir,
    extraArgs: [loginUrl],
  })
  return { provider, account, port, profileDir, visiblePid: result.pid }
}

async function launchHeadless(provider: string, account: string, port: number): Promise<Session> {
  const profileDir = await allocator.allocate(provider, account)
  await launchChrome({ visible: false, debugPort: port, profileDir })
  return { provider, account, port, profileDir }
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
      : 'Mode: interactive (enter login email, log in manually, then headless reuse is verified)\n',
  )

  const sessions: Session[] = []

  if (!VERIFY_ONLY) {
    for (let i = 0; i < PROVIDERS.length; i++) {
      const p = PROVIDERS[i]
      const port = BASE_PORT + i
      const email = await ask(`Email you will use to log in to ${p.provider} (e.g. you@domain.com):`)
      const account = accountFromEmail(p.provider, email)
      console.log(
        `[${i + 1}/${PROVIDERS.length}] Launching VISIBLE Chrome for ${p.provider}/${account} → ${p.loginUrl}`,
      )
      const s = await launchVisible(p.provider, account, p.loginUrl, port)
      sessions.push(s)
      console.log(`  profile: ${s.profileDir}\n  debugPort: ${port}  pid: ${s.visiblePid}`)
      await ask('  >> Log in to the provider in the opened window, then press ENTER:')
    }
  }

  if (VERIFY_ONLY) {
    const existing = await allocator.list()
    if (existing.length === 0) {
      console.log('No existing profiles found under the profile root. Run without --verify first.')
      process.exitCode = 1
      return
    }
    for (let i = 0; i < existing.length; i++) {
      const e = existing[i]
      const port = BASE_PORT + i
      sessions.push(await launchHeadless(e.providerSlug, e.accountId, port))
    }
  }

  // Verify headless reuse: relaunch headless on the same profile dir to prove
  // the authenticated session survives.
  console.log('\n--- Verifying headless reuse (persisted auth) ---')
  let pass = 0
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    if (!VERIFY_ONLY && s.visiblePid !== undefined) {
      await killChrome(s.visiblePid)
      await Bun.sleep(800)
      sessions[i] = await launchHeadless(s.provider, s.account, s.port)
    }
    const v = await verifySlave(s.port)
    const status = v.alive && v.loggedIn ? 'PASS' : 'FAIL'
    if (status === 'PASS') pass++
    console.log(
      `  [${status}] ${s.provider}/${s.account}  alive=${v.alive} cookies=${v.cookieCount ?? '?'} url=${v.url ?? '-'}`,
    )
  }

  console.log(`\n=== Done: ${pass}/${sessions.length} slaves verified ===\n`)
  if (pass < sessions.length) {
    console.log('Some slaves did not verify. Re-run and log in again, or use --verify once')
    console.log(`profiles exist under ${join(PROFILE_BASE, '<provider>', '<provider>_<email>')}.\n`)
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
