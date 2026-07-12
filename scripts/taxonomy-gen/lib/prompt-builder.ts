// scripts/taxonomy-gen/lib/prompt-builder.ts
// Renders prompt templates with variable substitution.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROMPTS_DIR = join(import.meta.dir, '..', 'prompts')

export interface PromptVars {
  platform?: string
  category?: string
  prior?: string
  discoveryHints?: string
  // new: protocol / tech-stack / shared-pool context
  techStack?: string
  protocol?: string
  priorNodes?: string // JSON of already-generated shared nodes (capabilities/protocols/techstacks/parsers)
  vocab?: string // controlled vocabulary text for probability harvesting
}

export function buildPrompt(templateName: string, vars: PromptVars): string {
  const path = join(PROMPTS_DIR, `${templateName}.prompt.md`)
  let tmpl = readFileSync(path, 'utf-8')

  const subs: Record<string, string> = {
    '{platform}': vars.platform ?? '',
    '{category}': vars.category ?? '',
    '{prior}': vars.prior ?? '',
    '{discoveryHints}': vars.discoveryHints ?? '',
    '{techStack}': vars.techStack ?? '',
    '{protocol}': vars.protocol ?? '',
    '{priorNodes}': vars.priorNodes ?? '',
    '{vocab}': vars.vocab ?? '',
  }

  for (const [key, value] of Object.entries(subs)) {
    tmpl = tmpl.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
  }

  return tmpl
}

// Round 0 — shared node pool (capabilities, protocols, webapp tech stacks, parsers)
export const SHARED_POOL = 'shared-pool'

// Round 1 — platform catalog
export const SKELETON = 'skeleton'

// Round 2 — per-platform drill-down (accumulated into taxonomy.json)
export const DRILLDOWN_SECTIONS = [
  'provider-meta',
  'capabilities',
  'methods',
  'parsers',
  'constraints',
  'edges',
  'validate',
] as const
export type DrilldownSection = (typeof DRILLDOWN_SECTIONS)[number]

// Round 3 — probability harvesting from a controlled vocabulary
export const PROBABILITY_HARVEST = 'probability-harvest'

export type SectionName =
  | typeof SHARED_POOL
  | typeof SKELETON
  | typeof PROBABILITY_HARVEST
  | DrilldownSection
