// scripts/taxonomy-gen/lib/skeleton.ts
// Round 1: generate PlatformCatalog skeleton.
//
// Flow (agent mode):
//   1. `skeleton --mode agent`          → prints the prompt
//   2. agent writes seeds/taxonomy/skeleton/platforms.json
//   3. `skeleton --mode agent --confirm` → loads it into gen state, marks done

import { buildPrompt } from './prompt-builder.ts'
import { ping, type PingMode } from './llm-ping.ts'
import { setSkeletonDone, upsertPlatform } from './state.ts'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT_DIR = join(import.meta.dir, '..', 'output')
const RAW_PATH = join(import.meta.dir, '..', '..', '..', 'seeds', 'taxonomy', 'skeleton', 'platforms.json')
const OUT_PATH = join(OUTPUT_DIR, 'skeleton', 'platforms.json')

function loadRawSkeleton(): { slug: string; category: string; sourceConfidence?: string }[] {
  if (!existsSync(RAW_PATH)) {
    throw new Error(`Skeleton raw file not found: ${RAW_PATH}\nRun \`skeleton --mode agent\` and write the output first.`)
  }
  const parsed = JSON.parse(readFileSync(RAW_PATH, 'utf-8')) as { platforms?: unknown[] }
  const platforms = (parsed.platforms ?? []) as { slug: string; category: string; sourceConfidence?: string }[]
  for (const p of platforms) {
    upsertPlatform({
      slug: p.slug,
      category: p.category,
      status: 'skeleton',
      sectionsDone: [],
      sourceConfidence: (p.sourceConfidence as 'high' | 'medium' | 'low') ?? 'medium',
    })
  }
  return platforms
}

export async function runSkeleton(mode: PingMode, confirm = false): Promise<void> {
  if (mode === 'agent' && confirm) {
    const platforms = loadRawSkeleton()
    if (!existsSync(join(OUT_PATH, '..'))) mkdirSync(join(OUT_PATH, '..'), { recursive: true })
    writeFileSync(OUT_PATH, JSON.stringify({ platforms }, null, 2))
    setSkeletonDone(true)
    // [audit] removed: console.log(`✅ Skeleton loaded: ${platforms.length} platforms catalogued.`)
    return
  }

  const prompt = buildPrompt('skeleton', {})
  const result = await ping(prompt, { mode, outputPath: 'skeleton/platforms.json' })

  if (mode === 'agent') {
    // [audit] removed: console.log('Agent mode: generate seeds/taxonomy/skeleton/platforms.json from the prompt above, then re-run with --mode agent --confirm')
    return
  }

  const platforms = (result.parsed as any)?.platforms ?? []
  for (const p of platforms) {
    upsertPlatform({
      slug: p.slug,
      category: p.category,
      status: 'skeleton',
      sectionsDone: [],
      sourceConfidence: p.sourceConfidence ?? 'medium',
    })
  }
  setSkeletonDone(true)

  if (!existsSync(join(OUT_PATH, '..'))) mkdirSync(join(OUT_PATH, '..'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify({ platforms }, null, 2))
  // [audit] removed: console.log(`✅ Skeleton: ${platforms.length} platforms catalogued.`)
}
