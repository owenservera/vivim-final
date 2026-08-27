// ─── Command Language Engine ──────────────────────────────────────────
// Core routing engine for the command language system.

export { getArgSuggestions, validateArgs } from './args.js'
export { AutocompleteEngine } from './autocomplete.js'
export { createCapSpec, parseCapCommand, validateCapCommand } from './capability-specs.js'
export {
  CATEGORY_COLORS,
  getBlendedColor,
  getContrastRatio,
  getShade as getColorShade,
  hexToHsl,
  hslToHex,
} from './colors.js'
export { detectCombo } from './combo-detector.js'
export { getContextRefTypes, isContextRef, resolveContextRef } from './context-ref.js'
export { devopsSpecs } from './devops-specs.js'
export { discoverySpecs } from './discovery-specs.js'
export { InterpretationEngine } from './interpretation.js'
export { mentionSpecs } from './mention-specs.js'
export {
  detectIntent,
  getCategoryColor,
  getConfidenceLevel,
  getShade,
  isHighConfidence,
  matchPatterns,
} from './nlp-matcher.js'
export { extractCommandName, hasPrefix, parseInput } from './parser.js'
export { CommandLanguageRegistry } from './registry.js'
export { getSuggestions, resolveCommand } from './resolver.js'
// ─── Spec Files ──────────────────────────────────────────────────────
export { slashSpecs } from './slash-specs.js'
export { tagSpecs } from './tag-specs.js'

// ─── Types ───────────────────────────────────────────────────────────
export type {
  ArgKind,
  ArgSpec,
  CategoryColor,
  CommandCategory,
  CommandCombo,
  CommandContext,
  CommandDescriptionRow,
  CommandIntent,
  CommandResult,
  DisclosureLevel,
  InterpretationConfig,
  InterpretationState,
  ParsedCommand,
  PatternMatchResult,
  Prefix,
  Suggestion,
  UnifiedCommandSpec,
  UnifiedLiveCommand,
} from './types.js'

export { ALL_PREFIXES, isPrefix } from './types.js'
