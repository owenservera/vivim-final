// scripts/ensure-accounts.ts
// DEVELOPMENT-ONLY: ensures core provider accounts survive DB rebuilds during
// the dev loop. Gated behind CAP_STORE_ENSURE_ACCOUNTS=true — never runs in
// production unless explicitly opted in.
//
// To add a dev account, set the env var and populate KNOWN_ACCOUNTS below
// with the profile dir created by a prior visible Chrome login session
// (e.g. via setup-slaves.ts or the ChromeSetupWizard).
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CapStoreDb } from '../src/storage/db.js'

interface StoredAccount {
  providerId: string
  email: string
  profileDir: string
  debugPort: number
  planTier: string
}

// Add dev accounts here. profileDir must point to a Chrome user-data-dir that
// has the provider's session cookies. Use setup-slaves.ts or ChromeSetupWizard
// to create authenticated profiles first.
// Example:
//   { providerId: 'claude', email: 'you@example.com', profileDir: 'C:\\path\\to\\profile', debugPort: 9222, planTier: 'free' }
const KNOWN_ACCOUNTS: StoredAccount[] = []

export async function runEnsureAccounts(): Promise<void> {
  if (process.env.CAP_STORE_ENSURE_ACCOUNTS !== 'true') {
    console.log('[ensure-accounts] skipped — set CAP_STORE_ENSURE_ACCOUNTS=true to run')
    return
  }

  const db = new CapStoreDb()

  // Verify provider slugs exist by checking seed files
  const seedDir = join(process.cwd(), 'seeds', 'providers')
  const seedSlugs = new Set<string>()
  if (existsSync(seedDir)) {
    for (const f of readdirSync(seedDir).filter((f) => f.endsWith('.json'))) {
      try {
        const raw = JSON.parse(readFileSync(join(seedDir, f), 'utf8'))
        seedSlugs.add(raw.provider?.slug ?? f.replace('.json', ''))
      } catch { /* skip */ }
    }
  }

  for (const a of KNOWN_ACCOUNTS) {
    if (!seedSlugs.has(a.providerId)) {
      console.log(`[ensure-accounts] skipping ${a.providerId} — not in seed files`)
      continue
    }

    const id = `${a.providerId}_${a.email.replace(/[@.]/g, '_')}`.slice(0, 50)
    await db.upsertAccount({
      id,
      providerId: a.providerId,
      email: a.email,
      planTier: a.planTier,
      isDefault: 1,
      loginState: 'authenticated',
      profileDir: a.profileDir,
      debugPort: a.debugPort,
    })

    // Ensure VivimSession exists
    await db.prisma.vivimSession.upsert({
      where: { id: 'session-default' },
      create: { id: 'session-default', userId: await db.resolveUserId(), state: 'idle', contextJson: '{}', createdAt: Date.now(), updatedAt: Date.now() },
      update: {},
    })

    // Ensure ProviderSession exists
    const existing = await db.prisma.providerSession.findFirst({
      where: { providerId: a.providerId, accountId: id },
    })
    if (!existing) {
      await db.prisma.providerSession.create({
        data: {
          id: `ps_${a.providerId}`,
          vivimSessionId: 'session-default',
          providerId: a.providerId,
          accountId: id,
          state: 'idle',
          contextJson: '{}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      })
    }

    console.log(`[ensure-accounts] ${a.providerId}: account ready (${a.email})`)
  }

  console.log(`[ensure-accounts] done — ${KNOWN_ACCOUNTS.length} accounts ensured`)
}

// Direct script invocation (bun run scripts/ensure-accounts.ts)
if (import.meta.main) {
  runEnsureAccounts().catch((e) => { console.error('[ensure-accounts] failed:', e) })
}
