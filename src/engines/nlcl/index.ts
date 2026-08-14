// src/engines/nlcl/index.ts
// Natural Language Command Layer (NLCL) — barrel exports.
// The "comms system" that makes the entire platform controllable via natural language.

export { getDefaultCommandPatterns, getPatternsByCategory } from './catalog.js'
export { CommandPatternRegistry } from './command-registry.js'
export { bindContext, resolvePronouns } from './context-binder.js'
export {
  normalizeBoolean,
  normalizeNumberWords,
  normalizeRelativeDate,
  normalizeRelativeTime,
  resolveEntityValues,
} from './entity-resolution.js'
export {
  AppExecutor,
  BrowserExecutor,
  CapabilityExecutor,
  ConversationExecutor,
  EmailExecutor,
  FileExecutor,
  type MailAdapter,
  ProviderLLMExecutor,
  SystemExecutor,
} from './executors/index.js'
export {
  diceCoefficient,
  fuzzySimilarity,
  jaroWinkler,
  levenshtein,
  levenshteinSimilarity,
} from './fuzzy-matcher.js'
export { FuzzyResolver } from './fuzzy-resolver.js'
export {
  createResolver,
  DeterministicResolver,
  HybridResolver,
  type LocalLLMAdapter,
  LocalLLMResolver,
  type ProviderLLMAdapter,
  ProviderLLMResolver,
  unresolvedIntent,
} from './intent-resolver.js'
export { type CompositeIntent, IntentRouter } from './intent-router.js'
export {
  LayeredResolver,
  type LayeredResolverOptions,
  type LayerTelemetry,
  type ResolutionLayer,
} from './layered-resolver.js'
export { LLMSlaveResolver } from './llm-slave-resolver.js'
export { NLCommandParser, type ParseOptions } from './nl-parser.js'
export { NLCLEngine, type NLCLEngineDeps } from './nlcl-engine.js'
// ── Phase 25 additions ─────────────────────────────────────────────────────
export {
  coerceValues,
  type ExtractResult,
  extractParameters,
  validateInput,
} from './parameter-extraction.js'
export { buildIntentFromPattern, extractPatternInput } from './pattern-match.js'
export { SemanticResolver } from './semantic-resolver.js'
// ── SOTA NLU pipeline layers ───────────────────────────────────────────────
export {
  defaultNormalizer,
  normalizeText,
  TextNormalizer,
  tokenizeText,
} from './text-normalizer.js'
export { cosineSimilarity, type SparseVector, Tfidf, type TfidfOptions } from './tfidf.js'

export type {
  ActionClassification,
  CommandExecutor,
  CommandPattern,
  CommandResult,
  ExecutorId,
  IntentResolver,
  NLCContext,
  NLCLEngineConfig,
  NLCLSurface,
  NLPattern,
  ParsedIntent,
  ResolverConfig,
} from './types.js'
export { classificationAtLeast, DEFAULT_NLCL_CONFIG } from './types.js'
