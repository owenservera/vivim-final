// seeds/taxonomy/taxonomy-seed.ts
// Loads the merged taxonomy pool into the database via Prisma.
// Run: bun run seed -- --file seeds/taxonomy/taxonomy-seed.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

// Reuse the live PrismaClient when called from server boot (`ensureTaxonomySeeded`
// receives `db.prisma`). Fall back to a fresh client only for the standalone CLI.
function getPrismaForSeed(external?: PrismaClient): PrismaClient {
  return external ?? new PrismaClient()
}

interface TaxonomyNode {
  id: string
  kind: string
  slug: string
  label: string
  description: string
  sourceConfidence: string
  tags: string[]
  shared: boolean
  capabilityKind?: string
  transport?: string
  family?: string
  composerHint?: string
  sendHint?: string
  parserType?: string
  fallbackSlug?: string | null
}

interface TaxonomyPool {
  version: string
  generatedAt: string
  platforms: Array<{
    slug: string
    category: string
    label: string
    url: string
    authType: string
    interactionPattern: string
    techStackSlugs: string[]
    sourceConfidence: string
  }>
  nodes: TaxonomyNode[]
  edges: Array<{
    id: string
    fromSlug: string
    fromKind: string
    toSlug: string
    toKind: string
    relation: string
    confidence: string
  }>
}

interface CapabilityHierarchy {
  id: string
  slug: string
  name: string
  category: string
  inputType?: string
  uiComponent: string
  uiLabel?: string
  uiIcon?: string
  uiPosition: string
  uiOrder: number
  uiLayerDepth: number
  uiGroup: string
  uiPriority: string
  parentCapabilityId: string | null
  interactionMode?: string
  resultComponent?: string
  resultLayout?: string
  children?: string[]
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

/**
 * Idempotent taxonomy seed used at server boot.
 *
 * Writes the capability hierarchy into `capabilityTaxonomy`. Sticky by design:
 * if the table already has rows it does nothing (unless `force` is set), so a
 * fresh clone or post-migration boot self-heals without a manual `bun run seed`.
 *
 * @param prisma   Live PrismaClient (pass `db.prisma` from boot).
 * @param force    When true, re-upsert all rows even if the table is populated.
 * @returns number of rows upserted.
 */
export async function ensureTaxonomySeeded(
  prisma: PrismaClient,
  force = false,
): Promise<{ upserted: number }> {
  const existing = await prisma.capabilityTaxonomy.count()
  if (existing > 0 && !force) {
    return { upserted: 0 }
  }

  const rootDir = join(import.meta.dir, '..', '..')
  const hierarchyData = loadJson<{ hierarchy: CapabilityHierarchy[] }>(
    join(rootDir, 'scripts', 'taxonomy-gen', 'output', 'capability-hierarchy.json'),
  )
  const hierarchy = hierarchyData.hierarchy

  console.log(
    `[seed] ${force ? 'Force-' : ''}seeding ${hierarchy.length} capability taxonomy entries ` +
      `(existing=${existing})...`,
  )

  const now = BigInt(Date.now())
  const slugToCapId = new Map<string, string>()
  for (const node of hierarchy) {
    slugToCapId.set(node.slug, node.id)
  }
  const sorted = hierarchy
    .filter((n) => n.id !== 'root')
    .sort((a, b) => a.uiLayerDepth - b.uiLayerDepth)

  let upserted = 0
  for (const node of sorted) {
    const parentSlug = node.parentCapabilityId
    const parentCapId =
      parentSlug && parentSlug !== 'root' ? (slugToCapId.get(parentSlug) ?? null) : null
    try {
      await prisma.capabilityTaxonomy.upsert({
        where: { slug: node.slug },
        create: {
          id: node.id,
          name: node.name,
          slug: node.slug,
          category: node.category,
          description: node.name,
          inputType: node.inputType ?? 'void',
          uiComponent: node.uiComponent,
          uiLabel: node.uiLabel ?? node.name,
          uiIcon: node.uiIcon ?? null,
          uiPosition: node.uiPosition,
          uiOrder: node.uiOrder,
          uiLayerDepth: node.uiLayerDepth,
          parentCapabilityId: parentCapId,
          uiGroup: node.uiGroup,
          uiPriority: node.uiPriority,
          interactionMode: node.interactionMode ?? 'single_click',
          uiStatesJson: '[]',
          uiVisibilityRule: null,
          existentialRule: null,
          uiInputSchema: '{}',
          mutationEffectsJson: '{}',
          recoveryBehavior: 'retry_manual',
          statePersistence: 'none',
          dataFlow: 'user_to_provider',
          minPlanTier: 'free',
          dependsOnJson: '[]',
          concurrencySafe: 0,
          opClassification: null,
          requiresUserConfirmation: 0,
          maxResultSize: 100000,
          resultComponent: node.resultComponent ?? 'text_block',
          resultLayout: node.resultLayout ?? 'inline',
          searchHintsJson: '[]',
          aliasesJson: '[]',
          availabilityJson: '{}',
          prefetch: 0,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          name: node.name,
          category: node.category,
          uiComponent: node.uiComponent,
          uiLabel: node.uiLabel ?? node.name,
          uiIcon: node.uiIcon ?? null,
          uiPosition: node.uiPosition,
          uiOrder: node.uiOrder,
          uiLayerDepth: node.uiLayerDepth,
          parentCapabilityId: parentCapId,
          uiGroup: node.uiGroup,
          uiPriority: node.uiPriority,
          interactionMode: node.interactionMode ?? 'single_click',
          resultComponent: node.resultComponent ?? 'text_block',
          resultLayout: node.resultLayout ?? 'inline',
          updatedAt: now,
        },
      })
      upserted++
    } catch (err) {
      console.error(`  ❌ ${node.slug}: ${err}`)
    }
  }
  return { upserted }
}

async function main() {
  const prisma = getPrismaForSeed()
  const rootDir = join(import.meta.dir, '..', '..')

  // Load pool for node/edge stats
  const pool = loadJson<TaxonomyPool>(join(rootDir, 'seeds', 'taxonomy', 'pool.taxonomy.json'))
  console.log(`[seed] Pool: ${pool.nodes.length} nodes, ${pool.edges.length} edges`)

  // Seed capability taxonomy (idempotent — force to overwrite existing rows)
  const { upserted } = await ensureTaxonomySeeded(prisma, true)

  // Summary
  const count = await prisma.capabilityTaxonomy.count()
  console.log(`\n[seed] Upserted ${upserted} rows. Total CapabilityTaxonomy rows: ${count}`)

  await prisma.$disconnect()
  console.log('[seed] Done.')
}

main().catch((e) => {
  console.error('[seed] Fatal:', e)
  process.exit(1)
})
