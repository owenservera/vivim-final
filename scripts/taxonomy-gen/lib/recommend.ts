// scripts/taxonomy-gen/lib/recommend.ts
// Scores platforms by value/effort and suggests where to start.

import { loadState } from './state.ts'
import { scanLibrary } from './catalog-scan.ts'

const CATEGORY_WEIGHT: Record<string, number> = {
  social_messaging: 1.0,
  social_feed: 1.0,
  ai_chatbot: 0.9,
  ai_tooling: 0.8,
  productivity: 0.85,
  forum: 0.7,
  dating: 0.6,
  ide: 0.75,
  agentic_agent: 0.8,
  browser_automation: 0.9,
}

export interface Recommendation {
  slug: string
  category: string
  score: number
  value: number
  effort: number
  rationale: string
}

export function recommend(): Recommendation[] {
  const state = loadState()
  const lib = scanLibrary()

  // If no skeleton yet, recommend building it first
  if (!state.skeletonDone) {
    return [
      {
        slug: '__skeleton__',
        category: 'all',
        score: 1.0,
        value: 1.0,
        effort: 1.0,
        rationale: 'No PlatformCatalog yet. Run `skeleton` to build the master list first.',
      },
    ]
  }

  const recs: Recommendation[] = state.platforms
    .filter((p) => p.status !== 'complete')
    .map((p) => {
      const catWeight = CATEGORY_WEIGHT[p.category] ?? 0.5
      // Value: category importance × coverage gap (not yet complete)
      const value = catWeight * (p.status === 'skeleton' ? 1.0 : 0.6)
      // Effort: lower if already drilling (partial), higher if blank
      const effort = p.status === 'drilling' ? 0.5 : p.sourceConfidence === 'high' ? 0.4 : 0.7
      const score = value / effort
      return {
        slug: p.slug,
        category: p.category,
        score,
        value,
        effort,
        rationale: `${p.category} platform, status=${p.status}, confidence=${p.sourceConfidence}, value=${value.toFixed(2)}/effort=${effort.toFixed(2)}`,
      }
    })

  return recs.sort((a, b) => b.score - a.score)
}

export function printRecommendations(recs: Recommendation[]): string {
  const lines: string[] = []
  lines.push('# Recommendations — Where to Start')
  lines.push('')
  if (recs.length === 0) {
    lines.push('All platforms complete. Run `merge` to produce the seed file.')
    return lines.join('\n')
  }
  if (recs[0].slug === '__skeleton__') {
    lines.push(`⚠️  ${recs[0].rationale}`)
    lines.push('')
    lines.push('Next: `bun run taxonomy-gen skeleton`')
    return lines.join('\n')
  }
  lines.push('Top suggestions (highest value / lowest effort):')
  lines.push('')
  for (const r of recs.slice(0, 3)) {
    lines.push(`### ${r.slug} (${r.category}) — score ${r.score.toFixed(2)}`)
    lines.push(`- ${r.rationale}`)
    lines.push(`- Start: \`bun run taxonomy-gen session ${r.slug}\``)
    lines.push('')
  }
  lines.push(`Total pending: ${recs.length}`)
  return lines.join('\n')
}
