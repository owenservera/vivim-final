// src/server/bootstrap-seeds.ts
// Seed logic extracted from index.ts for reuse by snapshot auto-restore fallback.

import type { getLogger } from '../lib/logger.js'
import type { CapStoreDb } from '../storage/db.js'

/**
 * Run individual seed functions (providers, parsers, automation, taxonomy, harness).
 * Extracted from boot flow for reuse by snapshot auto-restore fallback.
 */
export async function runIndividualSeeds(
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
    const { seedAutomation } = await import('../../seeds/automation/automation.seed.js')
    const autoCount = await seedAutomation(db)
    log.info({ count: autoCount }, 'Seeded browser-automation records')
  } catch (err) {
    log.warn({ err }, 'Automation seed skipped')
  }

  try {
    const { ensureTaxonomySeeded } = await import('../../seeds/taxonomy/taxonomy-seed.js')
    const tax = await ensureTaxonomySeeded(db.prisma)
    if (tax.upserted > 0) {
      log.info({ count: tax.upserted }, 'Seeded capability-taxonomy rows')
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
