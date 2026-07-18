// prisma/seed.ts
// Unified seed orchestrator for vivim-final.
// Called by `bunx prisma db seed` (via prisma.seed in package.json)
// and by the admin:seed capability handler at runtime.
//
// Execution order:
//   1. Conceptual model (ProviderType + Primitive + UiComponent)
//   2. Provider definitions, endpoints, parsers, capabilities, configs, models
//
// All upserts are idempotent — safe to run multiple times.

import { getDb, type CapStoreDb } from '../src/storage/db.js'
import { CapabilityEventBus } from '../src/engines/capability-event-bus.js'

export interface SeedResult {
  conceptual: {
    families: number
    primitives: number
    components: number
  }
  providers: {
    seeded: Array<{
      providerId: string
      slug: string
      status: string
      tablesAffected: string[]
      rowsAdded: number
      rowsModified: number
    }>
    skipped: string[]
    errors: Array<{ file: string; error: string }>
  }
  durationMs: number
}

/**
 * Seed all providers and the conceptual model into the database.
 * Pass an optional db instance to reuse an existing connection.
 */
export async function seedAllProviders(db?: CapStoreDb): Promise<SeedResult> {
  const start = Date.now()
  const database = db ?? getDb()
  const eventBus = CapabilityEventBus.getInstance()
  const errors: string[] = []

  // ── Phase 1: Conceptual model ──────────────────────────────────────────
  const { seedConceptualModel } = await import('../seeds/conceptual-model/seed.js')
  const cmResult = await seedConceptualModel(database)

  // ── Phase 2: Provider manifests ─────────────────────────────────────────
  const { ProviderStoreImpl } = await import('../src/storage/impl/provider-store-impl.js')
  const { ProviderRegistrar } = await import('../src/engines/provider-registrar.js')
  const { ProviderTypeStoreImpl } = await import('../src/storage/impl/provider-type-store-impl.js')

  const providerStore = new ProviderStoreImpl(database)
  const providerTypeStore = new ProviderTypeStoreImpl(database)
  const registrar = new ProviderRegistrar(
    providerStore,
    undefined,
    eventBus,
    providerTypeStore,
  )

  const seedResult = await registrar.seedAll()

  return {
    conceptual: cmResult,
    providers: seedResult,
    durationMs: Date.now() - start,
  }
}

/**
 * Seed a single provider by slug. Used by the admin:seed capability handler
 * when --providers flag filters to a subset.
 */
export async function seedSingleProvider(
  db: CapStoreDb,
  slug: string,
): Promise<{
  slug: string
  ok: boolean
  error?: string
}> {
  const eventBus = CapabilityEventBus.getInstance()
  try {
    const { readFile } = await import('node:fs/promises')
    const { join } = await import('node:path')

    const { ProviderStoreImpl } = await import('../src/storage/impl/provider-store-impl.js')
    const { ProviderRegistrar } = await import('../src/engines/provider-registrar.js')
    const { ProviderTypeStoreImpl } = await import('../src/storage/impl/provider-type-store-impl.js')
    const { ProviderManifestSchema } = await import('../src/schema/provider-manifest.js')

    const providerStore = new ProviderStoreImpl(db)
    const providerTypeStore = new ProviderTypeStoreImpl(db)
    const registrar = new ProviderRegistrar(
      providerStore,
      undefined,
      eventBus,
      providerTypeStore,
    )

    const filePath = join(import.meta.dir, '..', 'seeds', 'providers', `${slug}.json`)
    const raw = await readFile(filePath, 'utf-8')
    const manifest = ProviderManifestSchema.parse(JSON.parse(raw))
    const result = await registrar.register(manifest)

    return { slug, ok: true }
  } catch (err: unknown) {
    return {
      slug,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Standalone entry: bun run prisma/seed.ts ──────────────────────────────
if (import.meta.main) {
  const result = await seedAllProviders()
  console.log(JSON.stringify(result, null, 2))
  if (result.providers.errors.length > 0) {
    console.error('Seed errors:', result.providers.errors)
    process.exit(1)
  }
}
