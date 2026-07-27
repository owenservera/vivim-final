// src/engines/nlcl/help-resolver.ts
// Tier 4 unit 16.9 — HelpResolver with embedder-based question detection.
//
// Closes audit finding ❌-14: the previous implementation (planned in the
// design doc but never implemented) used a regex to detect help questions
// ("how do I", "what is", "tell me about"). This was brittle:
//   • "show me how to delete a conversation" doesn't match the regex but IS
//     a help question.
//   • "what is the weather" DOES match the regex but ISN'T a help question
//     (it's a general query, not about the system).
//
// New approach:
//   1. Compute the dense embedding of the user's input.
//   2. Compare against a corpus of help-question prototypes (pre-computed
//      embeddings, refreshed when the catalog changes).
//   3. If the best-match prototype is above the help-threshold, treat the
//      input as a help question and route to the help executor.
//   4. If best match is below threshold, return null — let the regular
//      resolver handle it.
//
// The corpus is built from:
//   • The existing catalog's `description` and `examples` fields.
//   • A small set of seed help prototypes ("how do I", "what can you do",
//     "show me help", "list commands", "what commands are available").
//
// This runs as a pre-resolver step (before the deterministic resolver) so
// help questions don't waste cycles on fuzzy/semantic/LLM retrieval.

import { MiniLmEmbeddingProvider } from '../embedding-minilm.js'
import type { EmbeddingProvider } from '../semantic-search.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { buildIntentFromPattern } from './pattern-match.js'
import type { CommandPattern, NLCContext, ParsedIntent } from './types.js'

// ── Help Prototypes ──────────────────────────────────────────────────────

/**
 * Seed prototypes for help questions. These are intentionally broad — the
 * embedder generalizes from them to paraphrases.
 */
const HELP_PROTOTYPES: string[] = [
  'how do I use this',
  'what can you do',
  'help me',
  'show me help',
  'list commands',
  'what commands are available',
  'how does this work',
  'show available actions',
  'tell me about the system',
  'what are my options',
  'how do I get started',
  'i need help',
  "i don't know what to do",
  'show me what you can do',
  'guide me',
]

/**
 * Help-question patterns that ALWAYS get treated as help, regardless of
 * embedder score. These are the unambiguous cases (regex is fine here
 * because we're matching literal commands like "help", not paraphrases).
 */
const HELP_LITERAL_PATTERNS = [
  /^help\b/i,
  /^\?\s*$/,
  /^commands\b/i,
  /^list\s+commands\b/i,
  /^show\s+commands\b/i,
]

export interface HelpResolverOpts {
  /** Dense embedding provider. Defaults to MiniLmEmbeddingProvider. */
  embeddingProvider?: EmbeddingProvider
  /** Threshold above which an input is treated as a help question (default 0.7). */
  helpThreshold?: number
}

interface HelpEntry {
  text: string
  embedding: number[]
  /** If matched, return this pattern (or null for the generic "help" intent). */
  pattern: CommandPattern | null
}

export class HelpResolver {
  private readonly registry: CommandPatternRegistry
  private readonly embeddingProvider: EmbeddingProvider
  private readonly helpThreshold: number
  private cachedEntries: HelpEntry[] = []
  private cachedRegistrySize = -1

  constructor(registry: CommandPatternRegistry, opts?: HelpResolverOpts) {
    this.registry = registry
    this.embeddingProvider = opts?.embeddingProvider ?? new MiniLmEmbeddingProvider()
    this.helpThreshold = opts?.helpThreshold ?? 0.7
  }

  /**
   * Try to resolve the raw input as a help question.
   * Returns a ParsedIntent pointing at the system.help pattern (if registered)
   * or a synthetic help intent. Returns null if the input isn't a help question.
   */
  async resolve(rawInput: string, _ctx: NLCContext): Promise<ParsedIntent | null> {
    // Step 1: literal pattern check (unambiguous cases).
    if (HELP_LITERAL_PATTERNS.some((re) => re.test(rawInput.trim()))) {
      return this.buildHelpIntent(rawInput)
    }

    // Step 2: embedder-based question detection.
    await this.ensureIndex()
    if (this.cachedEntries.length === 0) return null

    const queryEmbedding = await this.embeddingProvider.embed(rawInput)
    let best: { entry: HelpEntry; score: number } | null = null
    for (const entry of this.cachedEntries) {
      const score = cosine(queryEmbedding, entry.embedding)
      if (!best || score > best.score) {
        best = { entry, score }
      }
    }
    if (!best || best.score < this.helpThreshold) return null

    // Matched a help prototype (or a catalog entry's example).
    // If the best match is a catalog entry, return that entry's pattern
    // (the user is asking about a specific command).
    if (best.entry.pattern) {
      return buildIntentFromPattern(
        best.entry.pattern,
        rawInput,
        best.score,
        'help:catalog-prototype',
      )
    }
    return this.buildHelpIntent(rawInput)
  }

  /** Build the synthetic system.help intent. */
  private buildHelpIntent(rawInput: string): ParsedIntent {
    // Try to find a registered system.help pattern.
    const helpPattern = this.registry.list().find((p) => p.intent === 'system.help')
    if (helpPattern) {
      return buildIntentFromPattern(helpPattern, rawInput, 1.0, 'help:literal')
    }
    // Fallback: synthetic intent. The router will return an "unresolved"-
    // style result with a help message.
    return {
      patternId: 'system.help',
      intent: 'system.help',
      input: { query: rawInput },
      confidence: 1.0,
      rawInput,
      matchedPattern: 'help:literal',
      alternatives: [],
      resolvedAt: Date.now(),
      capabilityId: 'system.help',
      classification: 'read',
    }
  }

  /** Build the corpus of help prototypes + catalog examples. */
  private async ensureIndex(): Promise<void> {
    const size = this.registry.size()
    if (size === this.cachedRegistrySize && this.cachedEntries.length > 0) return

    const entries: HelpEntry[] = []
    // Seed help prototypes — pattern is null (use synthetic help intent).
    const prototypeEmbeddings = await this.embeddingProvider.embedBatch(HELP_PROTOTYPES)
    HELP_PROTOTYPES.forEach((text, i) => {
      entries.push({
        text,
        embedding: prototypeEmbeddings[i] ?? [],
        pattern: null,
      })
    })
    // Catalog examples — pattern is the catalog entry.
    const allPatterns = this.registry.list()
    for (const pattern of allPatterns) {
      // Skip the system.help pattern itself (already covered by prototypes).
      if (pattern.intent === 'system.help') continue
      // Use the pattern's first example + description as the prototype.
      const doc = `${pattern.description} ${pattern.examples.slice(0, 2).join(' ')}`
      const embedding = await this.embeddingProvider.embed(doc)
      entries.push({ text: doc, embedding, pattern })
    }
    this.cachedEntries = entries
    this.cachedRegistrySize = size
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
