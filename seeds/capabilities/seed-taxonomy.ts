// seeds/capabilities/seed-taxonomy.ts
// Seeds 50 ProviderCapabilityTaxonomy entries (10 per WebApp provider).
// Run: bun run seeds/capabilities/seed-taxonomy.ts

import type { CapStoreDb } from '../../src/storage/db.js'
import { DISCORD_CAPABILITY_TAXONOMY } from './taxonomy-discord.js'
import { NOTION_CAPABILITY_TAXONOMY } from './taxonomy-notion.js'
import { REDDIT_CAPABILITY_TAXONOMY } from './taxonomy-reddit.js'
import { SLACK_CAPABILITY_TAXONOMY } from './taxonomy-slack.js'
import { WHATSAPP_CAPABILITY_TAXONOMY } from './taxonomy-whatsapp.js'

async function _seedTaxonomy(db: CapStoreDb) {
  const allEntries = [
    ...DISCORD_CAPABILITY_TAXONOMY,
    ...SLACK_CAPABILITY_TAXONOMY,
    ...WHATSAPP_CAPABILITY_TAXONOMY,
    ...REDDIT_CAPABILITY_TAXONOMY,
    ...NOTION_CAPABILITY_TAXONOMY,
  ]

  let _created = 0
  let _skipped = 0

  for (const entry of allEntries) {
    try {
      await db.userPrisma.providerCapabilityTaxonomy.upsert({
        where: {
          providerId_platformCategory_interactionPattern: {
            providerId: entry.providerId,
            platformCategory: entry.platformCategory,
            interactionPattern: entry.interactionPattern,
          },
        },
        update: {
          messageTypesJson: entry.messageTypesJson,
          capabilitiesJson: entry.capabilitiesJson,
          constraintsJson: entry.constraintsJson,
          authRequirementsJson: entry.authRequirementsJson,
          discoveryHintsJson: entry.discoveryHintsJson,
          nlpEntityTypesJson: entry.nlpEntityTypesJson,
          nlpIntentPatternsJson: entry.nlpIntentPatternsJson,
          entityHierarchyJson: entry.entityHierarchyJson,
          syncCapabilitiesJson: entry.syncCapabilitiesJson,
          seedDataVersion: entry.seedDataVersion,
          isActive: entry.isActive,
          updatedAt: entry.updatedAt,
        },
        create: entry,
      })
      _created++
    } catch (_err) {
      // [audit] removed: console.error — upsert failed
      _skipped++
    }
  }

  // [audit] removed: console.log(`Capability taxonomy seed complete: ${created} created/updated, ${skipped} skipped`)
}

if (import.meta.main) {
  const { getDb } = await import('../../src/storage/db.js')
  const db = getDb()
  try {
    await _seedTaxonomy(db)
  } finally {
    await db.close()
  }
}
