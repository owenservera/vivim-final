// ─── Command Language Engine ──────────────────────────────────────────
// Core routing engine for the command language system.

export { parseInput, extractCommandName, hasPrefix } from './parser.js'
export { resolveCommand, getSuggestions } from './resolver.js'
export {
  matchPatterns,
  detectIntent,
  isHighConfidence,
  getConfidenceLevel,
  getCategoryColor,
  getShade,
} from './nlp-matcher.js'
export { CommandLanguageRegistry } from './registry.js'
export { validateArgs, getArgSuggestions } from './args.js'
export { resolveContextRef, isContextRef, getContextRefTypes } from './context-ref.js'
export { parseCapCommand, validateCapCommand, createCapSpec } from './capability-specs.js'
export { detectCombo } from './combo-detector.js'
export { InterpretationEngine } from './interpretation.js'
export { AutocompleteEngine } from './autocomplete.js'
export {
  CATEGORY_COLORS,
  getShade as getColorShade,
  getBlendedColor,
  getContrastRatio,
  hexToHsl,
  hslToHex,
} from './colors.js'

// ─── Spec Files ──────────────────────────────────────────────────────
export { slashSpecs } from './slash-specs.js'
export { mentionSpecs } from './mention-specs.js'
export { tagSpecs } from './tag-specs.js'
export { devopsSpecs } from './devops-specs.js'
export { discoverySpecs } from './discovery-specs.js'

// ─── Types ───────────────────────────────────────────────────────────
export type {
  Prefix,
  CommandCategory,
  ArgKind,
  CommandContext,
  Suggestion,
  ArgSpec,
  CommandResult,
  UnifiedCommandSpec,
  UnifiedLiveCommand,
  ParsedCommand,
  CommandIntent,
  CommandCombo,
  DisclosureLevel,
  InterpretationState,
  InterpretationConfig,
  CategoryColor,
  PatternMatchResult,
  CommandDescriptionRow,
} from './types.js'

export { ALL_PREFIXES, isPrefix } from './types.js'
