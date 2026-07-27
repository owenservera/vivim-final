import { StreamAlignmentEngine } from '../../src/engines/stream-align.js'
// seeds/parsers/harvest.seed.ts
// 020 — Harvest every parser variant found in the OG trees into DB inline rows,
// then build real fallback chains (provider → generic → system).
//
// Governor Canon: this module only writes ProviderParserRow data; it never touches CDP.
import type { ProviderStore } from '../../src/storage/contracts/provider-store.js'
import { LOGIC_CODE as CHATGPT } from './harvested/chatgpt-openai-delta.js'
import { LOGIC_CODE as CLAUDE } from './harvested/claude-streaming-sse.js'
import { LOGIC_CODE as GEMINI } from './harvested/gemini-batchexecute.js'
import { LOGIC_CODE as GENERIC } from './harvested/generic-format-agnostic.js'
import { LOGIC_CODE as STUDIO } from './harvested/google-ai-studio.js'
import { LOGIC_CODE as SYSTEM } from './harvested/system-raw-text.js'

interface HarvestDef {
  name: string
  providerId: string
  version: number
  logicCode: string
  fallback?: string // parser name of the fallback tier
}

// Ordered so fallback tiers exist before they are referenced.
const DEFS: HarvestDef[] = [
  {
    name: 'claude/001_streaming_sse',
    providerId: 'claude',
    version: 1,
    logicCode: CLAUDE,
    fallback: 'generic/001_format_agnostic',
  },
  {
    name: 'chatgpt/001_openai_delta',
    providerId: 'chatgpt',
    version: 1,
    logicCode: CHATGPT,
    fallback: 'generic/001_format_agnostic',
  },
  {
    name: 'gemini/001_batchexecute',
    providerId: 'gemini',
    version: 1,
    logicCode: GEMINI,
    fallback: 'generic/001_format_agnostic',
  },
  {
    name: 'gemini/002_ai_studio',
    providerId: 'gemini',
    version: 2,
    logicCode: STUDIO,
    fallback: 'generic/001_format_agnostic',
  },
  {
    name: 'generic/001_format_agnostic',
    providerId: 'generic',
    version: 1,
    logicCode: GENERIC,
    fallback: 'system/001_raw_text',
  },
  { name: 'system/001_raw_text', providerId: 'system', version: 1, logicCode: SYSTEM },
]

/**
 * Upsert harvested parsers and wire the fallback chain (2-pass, mirrors the
 * ProviderRegistrar). Returns the count of parsers seeded.
 */
export async function seedHarvestedParsers(store: ProviderStore): Promise<number> {
  const now = Date.now()
  const nameToId = new Map<string, string>()

  for (const def of DEFS) {
    const id = `parser:${def.providerId}:${def.name.split('/')[1] ?? def.version}`
    await store.upsertParser({
      id,
      provider_id: def.providerId,
      parser_name: def.name,
      parser_version: def.version,
      parser_logic_type: 'inline',
      parser_file_path: null,
      parser_logic_code: def.logicCode,
      parser_hash: StreamAlignmentEngine.computeParserHash(def.logicCode),
      sample_body: null,
      is_active: 1,
      fallback_parser_id: null,
      created_at: now,
      updated_at: now,
    })
    nameToId.set(def.name, id)
  }

  for (const def of DEFS) {
    if (def.fallback && nameToId.has(def.name) && nameToId.has(def.fallback)) {
      const fromId = nameToId.get(def.name)
      const toId = nameToId.get(def.fallback)
      if (fromId && toId) {
        await store.setParserFallback(fromId, toId)
      }
    }
  }

  return DEFS.length
}

export { DEFS }
