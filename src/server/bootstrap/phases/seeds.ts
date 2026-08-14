// src/server/bootstrap/phases/seeds.ts
// Boot phase: DB seeding + snapshot restore + provider registry cache.
// Writes: providerStore, registrar, providerRegistry on ctx.

import { config } from '../../../config.js'
import { getLogger } from '../../../lib/logger.js'
import { getDb } from '../../../storage/db.js'
import { runSystemSeeds, runUserSeeds } from '../../bootstrap-seeds.js'
import type { BootstrapContext } from '../context.js'

const log = getLogger('bootstrap:seeds')

export async function bootstrapSeedsPhase(ctx: BootstrapContext): Promise<void> {
  const db = getDb()
  ctx.db = db

  // ── SchemaMeta compat check (before any engine touches DB data) ──────
  try {
    const { verifySchemaCompat } = await import('../../../storage/verify-compat.js')
    const { getSystemPrisma, getUserPrisma } = await import('../../../storage/prisma.js')
    await verifySchemaCompat(getSystemPrisma(), 'system')
    await verifySchemaCompat(getUserPrisma(), 'user')
  } catch (err) {
    log.error({ err }, 'SchemaMeta compat check failed — aborting boot')
    throw err
  }

  // ── DB health telemetry (integrity check on boot) ────────────────────
  try {
    const { checkIntegrityOnBoot, getDbHealth } = await import('../../../storage/db-health.js')
    const healthy = await checkIntegrityOnBoot()
    if (!healthy) {
      log.error('DB integrity check failed — aborting boot (data may be corrupted)')
      throw new Error('DB integrity check failed on boot')
    }
    // Log health summary at INFO level
    const health = await getDbHealth()
    log.info({
      systemSize: health.system.fileSizeBytes,
      userSize: health.user.fileSizeBytes,
      systemSchema: health.system.schemaVersion,
      userSchema: health.user.schemaVersion,
    }, 'DB health check passed')
  } catch (err) {
    log.error({ err }, 'DB health check failed — aborting boot')
    throw err
  }

  // ── Data migrations (SchemaMeta-backed, complements Prisma DDL) ────────
  // The MigrationRunner handles DATA transformations (column-value reshaping,
  // bulk backfills). It is a no-op while the MIGRATIONS registry is empty.
  try {
    const { applyPendingMigrations } = await import('../../../storage/migration/index.js')
    const applied = await applyPendingMigrations()
    if (applied.length > 0) {
      log.info({ count: applied.length }, 'Applied data migrations')
    }
  } catch (err) {
    log.warn({ err }, 'Data migration pass skipped')
  }

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
      needsSeed = (await db.systemPrisma.providerDefinition.count()) === 0
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
        await runSystemSeeds(db, registrar, providerStore, log)
        await runUserSeeds(db, log)
      }
    } else {
      await runSystemSeeds(db, registrar, providerStore, log)
      await runUserSeeds(db, log)
    }
  } else {
    log.info('DB already seeded — skipping boot seeds (set FORCE_SEED=true to re-run)')
    // Still converge the taxonomy pool: the pool may have grown since this DB
    // was seeded (e.g. regenerated 3.5k-node pool vs 348-row DB). Converge is
    // insert-only + cheap (one count, one select, missing-slug inserts).
    try {
      const { ensureTaxonomySeeded } = await import('../../../../seeds/taxonomy/taxonomy-seed.js')
      const tax = await ensureTaxonomySeeded(db.systemPrisma as any, false, true)
      if (tax.upserted > 0) {
        log.info({ count: tax.upserted }, 'Converged capability-taxonomy rows on seeded DB')
      }
    } catch (err) {
      log.warn({ err }, 'Taxonomy converge skipped')
    }
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
