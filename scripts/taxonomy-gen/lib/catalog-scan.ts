// scripts/taxonomy-gen/lib/catalog-scan.ts
// Scans the existing library (schema, seeds, contracts, resolver) to give the
// agent full awareness of current state before generation.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..', '..')

export interface LibraryState {
  prismaTables: string[]
  seedFiles: string[]
  hasProviderTaxonomyTable: boolean
  hasPlatformCatalogTable: boolean
  taxonomyStoreContract: boolean
  resolverExists: boolean
  existingProviderSeeds: string[]
  catalogState: { total: number; skeleton: number; drilling: number; complete: number }
}

export function scanLibrary(): LibraryState {
  const schemaPath = join(ROOT, 'prisma', 'schema.prisma')
  let prismaTables: string[] = []
  let hasProviderTaxonomyTable = false
  let hasPlatformCatalogTable = false

  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8')
    const models = schema.match(/model\s+(\w+)/g) ?? []
    prismaTables = models.map((m) => m.replace('model ', '').trim())
    hasProviderTaxonomyTable = prismaTables.includes('ProviderCapabilityTaxonomy')
    hasPlatformCatalogTable = prismaTables.includes('PlatformCatalog')
  }

  const seedsDir = join(ROOT, 'seeds')
  let seedFiles: string[] = []
  let existingProviderSeeds: string[] = []
  if (existsSync(seedsDir)) {
    const walk = (dir: string): string[] => {
      const out: string[] = []
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...walk(full))
        else if (entry.endsWith('.ts') || entry.endsWith('.json')) out.push(full.replace(ROOT, ''))
      }
      return out
    }
    seedFiles = walk(seedsDir)
    existingProviderSeeds = seedFiles.filter((f) => /provider/i.test(f))
  }

  const contractPath = join(ROOT, 'src', 'storage', 'contracts', 'provider-taxonomy-store.ts')
  const resolverPath = join(ROOT, 'src', 'engines', 'provider-taxonomy', 'provider-taxonomy-resolver.ts')

  const stateFile = join(ROOT, 'scripts', 'taxonomy-gen', 'output', 'state.json')
  let catalogState = { total: 0, skeleton: 0, drilling: 0, complete: 0 }
  if (existsSync(stateFile)) {
    try {
      const st = JSON.parse(readFileSync(stateFile, 'utf-8'))
      const platforms = st.platforms ?? []
      catalogState = {
        total: platforms.length,
        skeleton: platforms.filter((p: any) => p.status === 'skeleton').length,
        drilling: platforms.filter((p: any) => p.status === 'drilling').length,
        complete: platforms.filter((p: any) => p.status === 'complete').length,
      }
    } catch {
  // [audit] log the error with context here
      /* ignore */
    }
  }

  return {
    prismaTables,
    seedFiles,
    hasProviderTaxonomyTable,
    hasPlatformCatalogTable,
    taxonomyStoreContract: existsSync(contractPath),
    resolverExists: existsSync(resolverPath),
    existingProviderSeeds,
    catalogState,
  }
}

export function printLibraryState(state: LibraryState): string {
  const lines: string[] = []
  lines.push('# Library State')
  lines.push('')
  lines.push(`## Prisma Tables (${state.prismaTables.length})`)
  lines.push(`- ProviderCapabilityTaxonomy: ${state.hasProviderTaxonomyTable ? '✅' : '❌'}`)
  lines.push(`- PlatformCatalog: ${state.hasPlatformCatalogTable ? '✅' : '❌'}`)
  lines.push('')
  lines.push('## Storage & Engines')
  lines.push(`- ProviderTaxonomyStore contract: ${state.taxonomyStoreContract ? '✅' : '❌'}`)
  lines.push(`- ProviderTaxonomyResolver: ${state.resolverExists ? '✅' : '❌'}`)
  lines.push('')
  lines.push(`## Existing Provider Seeds (${state.existingProviderSeeds.length})`)
  for (const s of state.existingProviderSeeds.slice(0, 20)) lines.push(`- ${s}`)
  lines.push('')
  lines.push('## Catalog Progress')
  lines.push(`- Total: ${state.catalogState.total}`)
  lines.push(`- Skeleton: ${state.catalogState.skeleton}`)
  lines.push(`- Drilling: ${state.catalogState.drilling}`)
  lines.push(`- Complete: ${state.catalogState.complete}`)
  return lines.join('\n')
}
