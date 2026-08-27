// src/server/bootstrap-seeds.ts
// Seed logic extracted from index.ts for reuse by snapshot auto-restore fallback.
// Split into runSystemSeeds (system.db) and runUserSeeds (user.db) for dual-DB.

import type { getLogger } from '../lib/logger.js'
import type { CapStoreDb } from '../storage/db.js'

/**
 * Run system-side seeds: providers, parsers, taxonomy, harness commands.
 * Writes to system.db via db.systemPrisma.
 */
export async function runSystemSeeds(
  db: CapStoreDb,
  registrar: any,
  providerStore: any,
  log: ReturnType<typeof getLogger>,
): Promise<void> {
  const seedResult = await registrar.seedAll()
  log.info(
    { count: seedResult.seeded.length, errors: seedResult.errors.length },
    'Seeded providers',
  )

  try {
    const { seedHarvestedParsers, seedStreamConfigs } = await import(
      '../../seeds/parsers/harvest.seed.js'
    )
    const harvested = await seedHarvestedParsers(providerStore)
    log.info({ count: harvested }, 'Harvested parser variants into DB')
    const streamConfigs = await seedStreamConfigs(providerStore)
    log.info({ count: streamConfigs }, 'Seeded provider stream configs')
  } catch (err) {
    log.warn({ err }, 'Parser harvest seed skipped')
  }

  try {
    const { ensureTaxonomySeeded } = await import('../../seeds/taxonomy/taxonomy-seed.js')
    // Converge mode: insert-only for pool slugs missing from the DB. This lets a
    // populated DB self-heal when the pool grows (no FORCE_SEED needed).
    const tax = await ensureTaxonomySeeded(db.systemPrisma as any, false, true)
    if (tax.upserted > 0) {
      log.info({ count: tax.upserted }, 'Converged capability-taxonomy rows')
    }
  } catch (err) {
    log.warn({ err }, 'Taxonomy seed skipped')
  }

  try {
    const { seedHarnessCommands } = await import('../../seeds/harness/commands.seed.js')
    const harnessCount = await seedHarnessCommands(db)
    log.info({ count: harnessCount }, 'Seeded harness commands')
  } catch (err) {
    log.warn({ err }, 'Harness command seed skipped')
  }
}

/**
 * Run user-side seeds: automation, memory intelligence.
 * Writes to user.db via db.userPrisma.
 */
export async function runUserSeeds(
  db: CapStoreDb,
  log: ReturnType<typeof getLogger>,
): Promise<void> {
  try {
    const { seedAutomation } = await import('../../seeds/automation/automation.seed.js')
    const autoCount = await seedAutomation(db)
    log.info({ count: autoCount }, 'Seeded browser-automation records')
  } catch (err) {
    log.warn({ err }, 'Automation seed skipped')
  }

  try {
    const { seedMemoryIntelligence } = await import('../../seeds/memory-intelligence.js')
    const miResult = await seedMemoryIntelligence(db)
    log.info({ result: miResult }, 'Seeded memory intelligence records')
  } catch (err) {
    log.warn({ err }, 'Memory intelligence seed skipped')
  }
}

/**
 * @deprecated Use runSystemSeeds + runUserSeeds instead.
 * Kept for backward compat with snapshot auto-restore fallback.
 */
export async function runIndividualSeeds(
  db: CapStoreDb,
  registrar: any,
  providerStore: any,
  log: ReturnType<typeof getLogger>,
): Promise<void> {
  await runSystemSeeds(db, registrar, providerStore, log)
  await runUserSeeds(db, log)
}
