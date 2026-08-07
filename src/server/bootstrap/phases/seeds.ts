// src/server/bootstrap/phases/seeds.ts
// Boot phase: DB seeding + snapshot restore + provider registry cache.
// Writes: providerStore, registrar, providerRegistry on ctx.

import { config } from '../../../config.js'
import { getLogger } from '../../../lib/logger.js'
import { getDb } from '../../../storage/db.js'
import { runIndividualSeeds } from '../../bootstrap-seeds.js'
import type { BootstrapContext } from '../context.js'

const log = getLogger('bootstrap:seeds')

export async function bootstrapSeedsPhase(ctx: BootstrapContext): Promise<void> {
  const db = getDb()
  ctx.db = db

  // ── Boot seeds (skip if already seeded; FORCE_SEED env to re-run) ────
  const { ProviderStoreImpl } = await import('../../../storage/impl/provider-store-impl.js')
  const { ProviderRegistrar } = await import('../../../engines/provider-registrar.js')
  const providerStore = new ProviderStoreImpl(db)
  const registrar = new ProviderRegistrar(providerStore, undefined, ctx.eventBus)

  let needsSeed: boolean
  if (process.env.FORCE_SEED) {
    needsSeed = true
  } else {
    try {
      needsSeed = (await db.prisma.providerDefinition.count()) === 0
    } catch (err: unknown) {
      // P2021 = "no such table" — DB exists but schema wasn't applied
      const code = (err as { code?: string })?.code
      if (code === 'P2021') {
        log.warn('DB schema not applied (P2021) — will attempt snapshot restore')
        needsSeed = true
      } else {
        throw err
      }
    }
  }

  if (needsSeed) {
    // ── Snapshot auto-restore: if snapshot exists and FORCE_SEED is not set,
    //    copy snapshot → dbPath instead of running individual seeds ──────────
    const forceSeed = !!process.env.FORCE_SEED
    if (!forceSeed) {
      const { existsSync, copyFileSync, mkdirSync } = await import('node:fs')
      const { join, dirname } = await import('node:path')
      const snapshotPath = join(process.cwd(), 'seeds', 'seed-snapshot.db')
      const dbTarget = config.dbPath
      if (existsSync(snapshotPath)) {
        const { closePrisma } = await import('../../../storage/prisma.js')
        log.info('Restoring from seed snapshot — closing DB...')
        await closePrisma()
        // Ensure target directory exists
        mkdirSync(dirname(dbTarget), { recursive: true })
        copyFileSync(snapshotPath, dbTarget)
        log.info('Snapshot copied — reopening DB...')
        // Reopen DB: clear singleton and re-get
        const { setDb } = await import('../../../storage/db.js')
        setDb(null as never)
        const freshDb = getDb()
        // Re-initialize provider store with fresh DB connection
        const freshProviderStore = new ProviderStoreImpl(freshDb)
        const freshRegistrar = new ProviderRegistrar(freshProviderStore, undefined, ctx.eventBus)
        // Update local references for downstream use
        Object.assign(providerStore, freshProviderStore)
        Object.assign(registrar, freshRegistrar)
        // Update the db variable's prisma reference (readonly property override)
        Object.defineProperty(db, 'prisma', { value: freshDb.prisma, writable: false })
        log.info('DB restored from seed snapshot')
        // Skip individual seeds — snapshot is fully seeded
      } else {
        log.warn(`Snapshot not found at ${snapshotPath} — running individual seeds`)
        await runIndividualSeeds(db, registrar, providerStore, log)
      }
    } else {
      await runIndividualSeeds(db, registrar, providerStore, log)
    }
  } else {
    log.info('DB already seeded — skipping boot seeds (set FORCE_SEED=true to re-run)')
  }

  // Initialize provider registry cache (loads all provider data from DB)
  const { createProviderRegistry } = await import('../../../config/provider-registry.js')
  const providerRegistry = createProviderRegistry(db)
  await providerRegistry.initialize()
  log.info({ count: providerRegistry.getProviderList().length }, 'Provider registry initialized')

  ctx.providerStore = providerStore
  ctx.registrar = registrar
  ctx.providerRegistry = providerRegistry
}
