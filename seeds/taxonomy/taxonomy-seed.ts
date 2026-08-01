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

interface PoolNode {
  id: string
  kind: string
  slug: string
  label: string
  description: string
  sourceConfidence: string
  tags: string[]
  shared: boolean
  capabilityKind?: string
  ui_component?: string
  ui_label?: string
  ui_icon?: string
  ui_position?: string
  ui_order?: number
  ui_group?: string
  ui_layer_depth?: number
  ui_priority?: string
  interaction_mode?: string
  ui_states_json?: string
  ui_visibility_rule?: string | null
  ui_input_schema?: string
  result_component?: string
  result_layout?: string
  parent_slug?: string | null
}

interface TaxonomyPool {
  version: string
  generatedAt: string
  nodes: PoolNode[]
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
  const pool = loadJson<TaxonomyPool>(join(rootDir, 'seeds', 'taxonomy', 'pool.taxonomy.json'))

  // Filter to capability nodes only
  const capabilityNodes = pool.nodes.filter((n) => n.kind === 'capability')

  console.log(
    `[seed] ${force ? 'Force-' : ''}seeding ${capabilityNodes.length} capability taxonomy entries ` +
      `(existing=${existing}, pool=${pool.nodes.length} total nodes)...`,
  )

  const now = BigInt(Date.now())
  const slugToId = new Map<string, string>()
  for (const node of capabilityNodes) {
    slugToId.set(node.slug, node.id)
  }

  let upserted = 0
  for (const node of capabilityNodes) {
    const parentSlug = node.parent_slug
    const parentCapId = parentSlug ? (slugToId.get(parentSlug) ?? null) : null

    try {
      await prisma.capabilityTaxonomy.upsert({
        where: { slug: node.slug },
        create: {
          id: node.id,
          name: node.label,
          slug: node.slug,
          category: node.capabilityKind ?? 'action',
          description: node.description,
          inputType: 'void',
          uiComponent: node.ui_component ?? 'action_button',
          uiLabel: node.ui_label ?? node.label,
          uiIcon: node.ui_icon ?? null,
          uiPosition: node.ui_position ?? 'composer',
          uiOrder: node.ui_order ?? 0,
          uiLayerDepth: node.ui_layer_depth ?? 0,
          parentCapabilityId: parentCapId,
          uiGroup: node.ui_group ?? 'default',
          uiPriority: node.ui_priority ?? 'secondary',
          interactionMode: node.interaction_mode ?? 'single_click',
          uiStatesJson: node.ui_states_json ?? '[]',
          uiVisibilityRule: node.ui_visibility_rule ?? null,
          existentialRule: null,
          uiInputSchema: node.ui_input_schema ?? '{}',
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
          resultComponent: node.result_component ?? 'text_block',
          resultLayout: node.result_layout ?? 'inline',
          searchHintsJson: '[]',
          aliasesJson: '[]',
          availabilityJson: '{}',
          prefetch: 0,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          name: node.label,
          category: node.capabilityKind ?? 'action',
          description: node.description,
          uiComponent: node.ui_component ?? 'action_button',
          uiLabel: node.ui_label ?? node.label,
          uiIcon: node.ui_icon ?? null,
          uiPosition: node.ui_position ?? 'composer',
          uiOrder: node.ui_order ?? 0,
          uiLayerDepth: node.ui_layer_depth ?? 0,
          parentCapabilityId: parentCapId,
          uiGroup: node.ui_group ?? 'default',
          uiPriority: node.ui_priority ?? 'secondary',
          interactionMode: node.interaction_mode ?? 'single_click',
          uiStatesJson: node.ui_states_json ?? '[]',
          uiVisibilityRule: node.ui_visibility_rule ?? null,
          uiInputSchema: node.ui_input_schema ?? '{}',
          resultComponent: node.result_component ?? 'text_block',
          resultLayout: node.result_layout ?? 'inline',
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
  const capabilityCount = pool.nodes.filter((n) => n.kind === 'capability').length
  console.log(
    `[seed] Pool: ${pool.nodes.length} nodes (${capabilityCount} capabilities), ${pool.edges.length} edges`,
  )

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
