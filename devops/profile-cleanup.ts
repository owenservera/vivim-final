// devops/profile-cleanup.ts
// `devops profiles cleanup` operator command.
//
// Enforces the invariant from specs/033-profile-cleanup: for every
// (providerSlug, accountId) exactly one authenticated Chrome profile directory
// exists under chrome-profiles/<provider>/<account>, and any duplicate or
// stray profile dirs are removed.
//
// The profile directory (cookie files) — not the DB loginState row — is the
// source of truth for "logged in" (AGENTS.md:131). This command is a devops
// operator tool, NOT a UnifiedCapability (One Entry Point invariant).
//
// Safety model:
//   - Default mode is dry-run: prints the plan, never mutates disk or DB.
//   - --force applies removals (protecting live slaves via debugPort pings
//     and SingletonLock).
//   - --reconcile-db writes back the canonical profileDir + loginState to the
//     DB and enforces a single isDefault per provider; it is a mutation and
//     therefore only runs together with --force.

import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  type CleanupPlan,
  type CleanupResult,
  ProfileAllocator,
} from '../src/executor/profile-allocator.js'
import type { CapStoreDb } from '../src/storage/db.js'

interface CleanupArgs {
  sub: string
  dryRun: boolean
  force: boolean
  provider?: string
  account?: string
  reconcileDb: boolean
  json: boolean
}

function parseArgs(argv: string[]): CleanupArgs {
  const sub = argv[0] ?? 'cleanup'
  const flag = (name: string) =>
    argv.includes(`--${name}`) || argv.some((a) => a.startsWith(`--${name}=`))
  const val = (name: string): string | undefined => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`))
    if (eq) return eq.split('=')[1]
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
  }
  const force = flag('force')
  return {
    sub,
    force,
    dryRun: !force,
    provider: val('provider'),
    account: val('account'),
    reconcileDb: flag('reconcile-db'),
    json: flag('json'),
  }
}

/**
 * A running Chrome holds a CDP endpoint on its debugPort. Any profileDir bound
 * to a reachable debugPort is a live slave and must be protected from removal.
 */
async function collectLiveSlavePaths(db: CapStoreDb): Promise<Set<string>> {
  const set = new Set<string>()
  const accounts = await db.prisma.providerAccount.findMany({
    where: { debugPort: { not: null } },
    select: { profileDir: true, debugPort: true },
  })
  await Promise.all(
    accounts.map(async (a) => {
      if (!a.profileDir || a.debugPort == null) return
      try {
        const resp = await fetch(`http://127.0.0.1:${a.debugPort}/json/version`, {
          signal: AbortSignal.timeout(1500),
        })
        if (resp.ok) set.add(resolve(a.profileDir))
      } catch {
  // [audit] log the error with context here
        // debugPort stale / browser gone — not a live slave
      }
    }),
  )
  return set
}

/**
 * Write the canonical profileDir + loginState for each keep-candidate and
 * enforce exactly one isDefault per provider. Only the keeper's row is
 * touched; removed duplicates keep their (now stale) rows until a future
 * reconcile, which is acceptable.
 */
async function reconcileDb(db: CapStoreDb, plan: CleanupPlan) {
  const providers = await db.prisma.providerDefinition.findMany({
    select: { id: true, slug: true },
  })
  const slugToId = new Map(providers.map((p) => [p.slug, p.id] as const))

  const warnings: string[] = []
  const errors: string[] = []

  for (const g of plan.groups) {
    const keeper = g.keepCandidate
    const providerId = slugToId.get(g.providerSlug)
    if (!providerId || !keeper) continue

    const loginState = keeper.hasCookies ? 'logged_in' : 'logged_out'
    const now = BigInt(Date.now())

    try {
      // Match priority:
      // 1. Exact profileDir match (canonical path is stable)
      // 2. Exact email match (may be sanitized vs full email mismatch)
      // 3. Null profileDir for this provider (adopt canonical for that provider)
      let existing = await db.prisma.providerAccount.findFirst({
        where: { profileDir: keeper.path },
      })
      if (!existing) {
        existing = await db.prisma.providerAccount.findFirst({
          where: { providerId, email: g.accountId },
        })
      }
      if (!existing) {
        existing = await db.prisma.providerAccount.findFirst({
          where: { providerId, profileDir: null },
        })
      }

      if (existing) {
        await db.prisma.providerAccount.update({
          where: { id: existing.id },
          data: { profileDir: keeper.path, loginState, updatedAt: now },
        })
      } else {
        const otherDefault = await db.prisma.providerAccount.findFirst({
          where: { providerId, isDefault: 1 },
        })
        await db.prisma.providerAccount.create({
          data: {
            id: `cleanup_${providerId}_${g.accountId}_${Date.now()}`,
            providerId,
            email: g.accountId,
            planTier: 'free',
            isDefault: otherDefault ? 0 : 1,
            isKind: 0,
            loginState,
            profileDir: keeper.path,
            createdAt: now,
            updatedAt: now,
          },
        })
      }

      // Enforce single isDefault per provider: demote every other account.
      await db.prisma.providerAccount.updateMany({
        where: { providerId, isDefault: 1, NOT: { email: g.accountId } },
        data: { isDefault: 0 },
      })
    } catch (e) {
      errors.push(`reconcile ${g.groupKey} failed: ${(e as Error).message}`)
    }
  }

  return { warnings, errors }
}

function renderPlan(plan: CleanupPlan): string {
  const lines: string[] = []
  lines.push(`mode: ${plan.mode}`)
  lines.push(`canonical base: ${plan.canonicalBase}`)
  const s = plan.summary
  lines.push(
    `providers: ${s.providers}  groups: ${s.groups}  keep: ${s.keepCandidates}  ` +
      `removable: ${s.removable}  protected: ${s.protected}  stray: ${s.stray}`,
  )
  for (const g of plan.groups) {
    lines.push('')
    lines.push(`  [${g.groupKey}]`)
    if (g.keepCandidate) {
      const k = g.keepCandidate
      lines.push(`    keep: ${k.path}  (auth=${k.hasCookies} live=${k.liveSlave})`)
    } else {
      lines.push('    keep: <none>')
    }
    for (const r of g.removable) {
      lines.push(`    remove: ${r.path}  (auth=${r.hasCookies})`)
    }
    for (const w of g.warnings) lines.push(`    ! ${w}`)
  }
  for (const st of plan.strayRoots) {
    lines.push('')
    lines.push(
      `  stray ${st.disposition}: ${st.path}${st.providerHint ? ` (hint=${st.providerHint})` : ''}`,
    )
  }
  return lines.join('\n')
}

function renderResult(result: CleanupResult): string {
  const lines: string[] = []
  lines.push(`removed: ${result.removedPaths.length}`)
  for (const p of result.removedPaths) lines.push(`  - ${p}`)
  lines.push(`protected: ${result.protectedPaths.length}`)
  for (const p of result.protectedPaths) lines.push(`  # ${p}`)
  if (result.warnings.length) {
    lines.push('warnings:')
    for (const w of result.warnings) lines.push(`  ! ${w}`)
  }
  if (result.errors.length) {
    lines.push('errors:')
    for (const e of result.errors) lines.push(`  x ${e}`)
  }
  return lines.join('\n')
}

async function writeSnapshot(payload: unknown): Promise<string> {
  const dir = resolve('.runtime', 'profile-cleanup')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${Date.now()}.json`)
  await Bun.write(file, JSON.stringify(payload, null, 2))
  return file
}

export async function runProfileCleanup(argv: string[]): Promise<number> {
  const args = parseArgs(argv)

  if (args.sub !== 'cleanup') {
    // [audit] removed: console.error(
      'usage: devops profiles cleanup [--force] [--provider=<slug>] [--account=<email>] [--reconcile-db] [--json]',
    )
    return 1
  }

  const { CapStoreDb } = await import('../src/storage/db.js')
  const db = new CapStoreDb()
  const allocator = new ProfileAllocator()

  const liveSlavePaths = await collectLiveSlavePaths(db)
  const plan = await allocator.plan({
    provider: args.provider,
    account: args.account,
    liveSlavePaths,
  })
  plan.mode = args.dryRun ? 'dry-run' : 'enforce'

  if (args.json) {
    // [audit] removed: console.log(JSON.stringify({ plan }, null, 2))
  } else {
    // [audit] removed: console.log(renderPlan(plan))
  }

  if (args.dryRun) {
    if (!args.json) {
      // [audit] removed: console.log('\ndry-run: no changes made. Pass --force to apply.')
      if (args.reconcileDb) {
        // [audit] removed: console.log('--reconcile-db is a mutation and will only run with --force.')
      }
    }
    return 0
  }

  // Enforce removals.
  const result = await allocator.enforce(plan)
  const snapshot: Record<string, unknown> = { plan, result }

  // Reconcile DB (mutation) only when explicitly requested with --force.
  if (args.reconcileDb) {
    const rec = await reconcileDb(db, plan)
    snapshot.reconcile = rec
    if (args.json) {
      // already printed plan; print reconcile summary separately
    } else if (rec.warnings.length || rec.errors.length) {
      // [audit] removed: console.log('\nreconcile:')
      // [audit] removed: for (const w of rec.warnings) console.log(`  ! ${w}`)
      // [audit] removed: for (const e of rec.errors) console.log(`  x ${e}`)
    }
  }

  const file = await writeSnapshot(snapshot)
  // [audit] removed: console.log(`\nsnapshot: ${file}`)

  if (args.json) {
    // [audit] removed: console.log(JSON.stringify({ result, reconcile: snapshot.reconcile ?? null }, null, 2))
  } else {
    // [audit] removed: console.log(renderResult(result))
  }

  return result.errors.length > 0 ? 1 : 0
}
