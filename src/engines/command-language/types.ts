// ─── Prefix Characters ───────────────────────────────────────────────
export type Prefix = '/' | '@' | '#' | '!' | '~' | '$' | '?'

export const ALL_PREFIXES: Prefix[] = ['/', '@', '#', '!', '~', '$', '?']

export function isPrefix(char: string): char is Prefix {
  return (ALL_PREFIXES as string[]).includes(char)
}

// ─── Command Categories ──────────────────────────────────────────────
export type CommandCategory =
  | 'conversation'
  | 'memory'
  | 'email'
  | 'file'
  | 'browser'
  | 'llm'
  | 'system'
  | 'canvas'
  | 'channel'
  | 'session'
  | 'workflow'
  | 'automation'
  | 'provider'
  | 'agent'
  | 'tag'
  | 'discovery'

// ─── Argument Kinds ──────────────────────────────────────────────────
export type ArgKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tag'
  | 'path'
  | 'choice'
  | 'select'
  | 'conv'
  | 'provider'
  | 'url'
  | 'json'
  | 'ref'
  | 'cron'
  | 'duration'

// ─── Command Context ─────────────────────────────────────────────────
export interface CommandContext {
  activeProvider: string | null
  activeConvId: string | null
  activeAccountId: string | null
  lastAssistantText: string | null
  lastAssistantAt: number | null
  lastUserPrompt: string | null
  gmailAccounts: Array<{ hash: string; email: string }>
  dueMemoryCount: number
  panelStatus: 'connecting' | 'connected' | 'disconnected'
  activeTags: string[]
  recentCommands: string[]
  sessionState: Record<string, unknown>
}

// ─── Suggestion ──────────────────────────────────────────────────────
export interface Suggestion {
  id: string
  label: string
  description: string
  category: CommandCategory
  prefix: Prefix
  icon?: string
  score: number
}

// ─── Arg Spec ────────────────────────────────────────────────────────
export interface ArgSpec {
  name: string
  kind: ArgKind
  placeholder: string
  required: boolean
  default?: string | ((ctx: CommandContext) => string | null)
  multiline?: boolean
  suggestions?: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  options?: Array<{ value: string; label: string }>
  acceptContextRef?: 'lastAssistant' | 'activeConv' | 'lastFile' | 'lastUrl'
  validation?: (value: string) => string | null
}

// ─── Command Result ──────────────────────────────────────────────────
export type CommandResult =
  | { ok: true; toast: string; detail?: string; openUrl?: string; followup?: string }
  | { ok: false; toast: string; detail?: string }

// ─── Unified Command Spec ────────────────────────────────────────────
export interface UnifiedCommandSpec {
  id: string
  prefix: Prefix
  namespace: string
  title: string
  subtitle?: string
  keywords?: string[]
  icon?: string
  category: CommandCategory
  surfaces: Array<'cli' | 'ui' | 'api' | 'mcp' | 'palette'>

  when?: (ctx: CommandContext) => boolean
  boost?: (ctx: CommandContext) => number
  destructive?: boolean

  args?: ArgSpec[]

  run: (args: Record<string, unknown>, ctx: CommandContext) => Promise<CommandResult>

  aliases?: string[]
  examples?: string[]

  capabilityId?: string
  patternId?: string
}

// ─── Unified Live Command ────────────────────────────────────────────
export interface UnifiedLiveCommand extends UnifiedCommandSpec {
  live: true
  suggest: (q: string, ctx: CommandContext) => Promise<Suggestion[]>
  runOnSuggestion: (s: Suggestion, ctx: CommandContext) => Promise<CommandResult>
}

// ─── Parsed Command ──────────────────────────────────────────────────
export interface ParsedCommand {
  prefix: Prefix | null
  command: string
  rawArgs: string
  tokens: string[]
  isCombo: boolean
}

// ─── Command Intent ──────────────────────────────────────────────────
export interface CommandIntent {
  commandId: string
  confidence: number
  category: CommandCategory
  args: Record<string, unknown>
  source: 'prefix' | 'nlp' | 'nlcl'
  color: CategoryColor
  interpretation: string
}

// ─── Command Combo ───────────────────────────────────────────────────
export interface CommandCombo {
  intents: CommandIntent[]
  executionOrder: 'sequential' | 'parallel' | 'mixed'
  dependencies: Array<[number, number]>
  interpretation: string
  dominantCategory: CommandCategory
}

// ─── Disclosure Levels ───────────────────────────────────────────────
export type DisclosureLevel = 'L0' | 'L1' | 'L2' | 'L3'

// ─── Interpretation State ────────────────────────────────────────────
export interface InterpretationState {
  level: DisclosureLevel
  intent: CommandIntent | null
  combo: CommandCombo | null
  color: CategoryColor
  position: 'above' | 'below' | 'floating' | 'inline'
  visible: boolean
  expanded: boolean
}

// ─── Interpretation Config ───────────────────────────────────────────
export interface InterpretationConfig {
  position: 'above' | 'below' | 'floating' | 'inline'
  expandOn: 'auto' | 'tab' | 'hover'
  dismissOn: 'escape' | 'enter' | 'blur'
  maxWidth: number
  animationDuration: number
}

// ─── Category Color ──────────────────────────────────────────────────
export interface CategoryColor {
  category: CommandCategory
  primary: string
  hsl: [number, number, number]
  shades: {
    light: string
    medium: string
    dark: string
  }
}

// ─── Pattern Match Result (NLP) ──────────────────────────────────────
export interface PatternMatchResult {
  commandId: string
  description: string
  confidence: number
  category: CommandCategory
  matchedPattern: string
}

// ─── Command Description Row (DB) ───────────────────────────────────
export interface CommandDescriptionRow {
  id: string
  commandId: string
  description: string
  patterns: string[]
  category: string
  prefix: string | null
  confidence: number
  enabled: boolean
}
