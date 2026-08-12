// scripts/taxonomy-gen/run.ts
// CLI orchestrator for the provider taxonomy generation system.
//
// Commands:
//   scan         — print existing library state + recommendations
//   shared-pool  — Round 0: generate shared node pool (capabilities/protocols/techstacks/parsers)
//   skeleton     — Round 1: build PlatformCatalog skeleton
//   session <slug> [--mode auto|agent] — Round 2: drill-down one platform
//   harvest <vocab-file> [--mode auto|agent] — Round 3: probability-table harvesting
//   status       — print gen state (progress per platform)
//   merge        — merge all nodes/edges → seeds/taxonomy/pool.taxonomy.json (master DB pool)
//   openclaw-harvest — Step A: parse OpenClaw taxonomy.yaml → seeds/taxonomy/openclaw-harvest.json
//
// Global flag: --mode auto|agent (default agent)

import { scanLibrary, printLibraryState } from './lib/catalog-scan.ts'
import { recommend, printRecommendations } from './lib/recommend.ts'
import { runSkeleton } from './lib/skeleton.ts'
import { runSession } from './lib/provider-session.ts'
import { runSharedPool } from './lib/shared-pool.ts'
import { runMerge } from './lib/merge.ts'
import { runHarvestPipeline } from './lib/harvest.ts'
import { runOpenClawHarvest } from './lib/openclaw-harvest.ts'
import { getState } from './lib/state.ts'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

function parseArgs(argv: string[]): { cmd: string; slug?: string; mode: 'auto' | 'agent' } {
  const mode = (argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'agent') as 'auto' | 'agent'
  const cmd = argv[0] ?? 'scan'
  const slug = argv.find((a) => !a.startsWith('--') && a !== cmd && a !== mode) ?? undefined
  const confirm = argv.includes('--confirm')
  return { cmd, slug, mode, confirm }
}

async function main() {
  const { cmd, slug, mode, confirm } = parseArgs(process.argv.slice(2))

  switch (cmd) {
    case 'scan': {
      // [audit] removed: console.log(printLibraryState(scanLibrary()))
      // [audit] removed: console.log('\n' + printRecommendations(recommend()))
      break
    }
    case 'shared-pool':
      await runSharedPool(mode, confirm)
      break
    case 'skeleton':
      await runSkeleton(mode, confirm)
      break
    case 'session':
      if (!slug) {
        // [audit] removed: console.error('Usage: taxonomy-gen session <slug> [--mode auto|agent]')
        process.exit(1)
      }
      await runSession(slug, mode)
      break
    case 'harvest': {
      if (!slug) {
        // [audit] removed: console.error('Usage: taxonomy-gen harvest <vocab-file> [--mode auto|agent]')
        process.exit(1)
      }
      const vocabPath = existsSync(slug) ? slug : join(import.meta.dir, '..', 'prompts', slug)
      if (!existsSync(vocabPath)) {
        // [audit] removed: console.error(`Vocab file not found: ${vocabPath}`)
        process.exit(1)
      }
      const vocab = readFileSync(vocabPath, 'utf-8')
      const result = await runHarvestPipeline({ vocab, mode })
      const outPath = join(import.meta.dir, '..', 'output', 'harvest', 'result.json')
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, JSON.stringify(result, null, 2))
      for (const r of result.reports) {
        // [audit] removed: console.log(`[${r.phase}] ${r.ok ? 'ok' : 'FAIL'} — ${r.notes.join('; ') || '(no notes)'}`)
      }
      // [audit] removed: console.log(`✅ Harvested ${result.terms.length} terms, table rows=${result.table.rows.length}, edges=${result.edges.length}`)
      break
    }
    case 'status': {
      const s = getState()
      // [audit] removed: console.log(`Skeleton done: ${s.skeletonDone} | Shared pool: ${s.sharedPoolDone}`)
      for (const p of s.platforms) {
        // [audit] removed: console.log(`  ${p.slug} [${p.category}] ${p.status} (${p.sectionsDone.length} sections, ${p.sourceConfidence})`)
      }
      break
    }
    case 'merge':
      runMerge()
      break
    case 'openclaw-harvest': {
      const r = runOpenClawHarvest()
      // [audit] removed: console.log(`   wrote ${r.nodeCount} nodes / ${r.edgeCount} edges → ${r.docPath}`)
      break
    }
    default:
      // [audit] removed: console.error(`Unknown command: ${cmd}`)
      // [audit] removed: console.error('Commands: scan, shared-pool, skeleton, session <slug>, harvest <vocab-file>, status, merge')
      process.exit(1)
  }
}

main().catch((e) => {
  // [audit] removed: console.error('Error:', e instanceof Error ? e.message : e)
  process.exit(1)
})
