// src/engines/nlcl/index.ts
// Natural Language Command Layer (NLCL) — barrel exports.
// The "comms system" that makes the entire platform controllable via natural language.

export { NLCLEngine, type NLCLEngineDeps } from './nlcl-engine.js'
export { CommandPatternRegistry } from './command-registry.js'
export { NLCommandParser, type ParseOptions } from './nl-parser.js'
export {
  DeterministicResolver,
  LocalLLMResolver,
  ProviderLLMResolver,
  HybridResolver,
  createResolver,
  unresolvedIntent,
  type LocalLLMAdapter,
  type ProviderLLMAdapter,
} from './intent-resolver.js'
export { IntentRouter, type CompositeIntent } from './intent-router.js'
export { getDefaultCommandPatterns, getPatternsByCategory } from './catalog.js'

// ── SOTA NLU pipeline layers ───────────────────────────────────────────────
export { TextNormalizer, defaultNormalizer, normalizeText, tokenizeText } from './text-normalizer.js'
export {
  levenshtein,
  levenshteinSimilarity,
  jaroWinkler,
  diceCoefficient,
  fuzzySimilarity,
} from './fuzzy-matcher.js'
export { Tfidf, cosineSimilarity, type SparseVector, type TfidfOptions } from './tfidf.js'
export {
  normalizeRelativeDate,
  normalizeRelativeTime,
  normalizeNumberWords,
  normalizeBoolean,
  resolveEntityValues,
} from './entity-resolution.js'
export { extractPatternInput, buildIntentFromPattern } from './pattern-match.js'
export { SemanticResolver } from './semantic-resolver.js'
export { FuzzyResolver } from './fuzzy-resolver.js'
export {
  LayeredResolver,
  type ResolutionLayer,
  type LayeredResolverOptions,
  type LayerTelemetry,
} from './layered-resolver.js'

export {
  FileExecutor,
  BrowserExecutor,
  ProviderLLMExecutor,
  SystemExecutor,
  ConversationExecutor,
  CapabilityExecutor,
  EmailExecutor,
  AppExecutor,
  type MailAdapter,
} from './executors/index.js'

export type {
  CommandPattern,
  ParsedIntent,
  CommandResult,
  NLCContext,
  NLCLEngineConfig,
  IntentResolver,
  ResolverConfig,
  CommandExecutor,
  ExecutorId,
  ActionClassification,
  NLCLSurface,
  NLPattern,
} from './types.js'
export { DEFAULT_NLCL_CONFIG, classificationAtLeast } from './types.js'
