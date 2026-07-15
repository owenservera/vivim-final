// seeds/taxonomy/taxonomy-seed.ts
// Loads the merged taxonomy pool into the database via Prisma.
// Run: bun run seed -- --file seeds/taxonomy/taxonomy-seed.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function seedCapabilityTaxonomy(hierarchy: CapabilityHierarchy[]) {
  console.log(`\n[seed] Loading ${hierarchy.length} capability taxonomy entries...`)

  const now = BigInt(Date.now())

  // Build slug → id mapping for parent references
  const slugToCapId = new Map<string, string>()
  for (const node of hierarchy) {
    slugToCapId.set(node.slug, node.id)
  }

  // Sort by uiLayerDepth to insert parents before children (topological order)
  const sorted = hierarchy
    .filter((n) => n.id !== 'root')
    .sort((a, b) => a.uiLayerDepth - b.uiLayerDepth)

  for (const node of sorted) {
    const parentSlug = node.parentCapabilityId
    // Root is virtual (not in DB) — treat references to it as null
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
      console.log(`  ✅ ${node.slug} (${node.uiComponent})`)
    } catch (err) {
      console.error(`  ❌ ${node.slug}: ${err}`)
    }
  }
}

async function main() {
  const rootDir = join(import.meta.dir, '..', '..')

  // Load hierarchy
  const hierarchyData = loadJson<{ hierarchy: CapabilityHierarchy[] }>(
    join(rootDir, 'scripts', 'taxonomy-gen', 'output', 'capability-hierarchy.json'),
  )
  console.log(`[seed] Taxonomy version: ${hierarchyData.hierarchy.length} nodes`)

  // Load pool for platform/node stats
  const pool = loadJson<TaxonomyPool>(join(rootDir, 'seeds', 'taxonomy', 'pool.taxonomy.json'))
  console.log(
    `[seed] Pool: ${pool.platforms.length} platforms, ${pool.nodes.length} nodes, ${pool.edges.length} edges`,
  )

  // Seed capability taxonomy
  await seedCapabilityTaxonomy(hierarchyData.hierarchy)

  // Summary
  const count = await prisma.capabilityTaxonomy.count()
  console.log(`\n[seed] Total CapabilityTaxonomy rows: ${count}`)

  await prisma.$disconnect()
  console.log('[seed] Done.')
}

main().catch((e) => {
  console.error('[seed] Fatal:', e)
  process.exit(1)
})
