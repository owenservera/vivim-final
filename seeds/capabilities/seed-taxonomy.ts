// seeds/capabilities/seed-taxonomy.ts
// Seeds 50 ProviderCapabilityTaxonomy entries (10 per WebApp provider).
// Run: bun run seeds/capabilities/seed-taxonomy.ts

import { PrismaClient } from '@prisma/client'
import { DISCORD_CAPABILITY_TAXONOMY } from './taxonomy-discord.js'
import { NOTION_CAPABILITY_TAXONOMY } from './taxonomy-notion.js'
import { REDDIT_CAPABILITY_TAXONOMY } from './taxonomy-reddit.js'
import { SLACK_CAPABILITY_TAXONOMY } from './taxonomy-slack.js'
import { WHATSAPP_CAPABILITY_TAXONOMY } from './taxonomy-whatsapp.js'

async function main() {
  const prisma = new PrismaClient()

  const allEntries = [
    ...DISCORD_CAPABILITY_TAXONOMY,
    ...SLACK_CAPABILITY_TAXONOMY,
    ...WHATSAPP_CAPABILITY_TAXONOMY,
    ...REDDIT_CAPABILITY_TAXONOMY,
    ...NOTION_CAPABILITY_TAXONOMY,
  ]

  let created = 0
  let skipped = 0

  for (const entry of allEntries) {
    try {
      await prisma.providerCapabilityTaxonomy.upsert({
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
      created++
    } catch (err) {
      // [audit] removed: console.error(
        `Failed to upsert ${entry.providerId}/${entry.platformCategory}/${entry.interactionPattern}:`,
        err,
      )
      skipped++
    }
  }

  // [audit] removed: console.log(`Capability taxonomy seed complete: ${created} created/updated, ${skipped} skipped`)
  await prisma.$disconnect()
}

// [audit] removed: main().catch(console.error)
