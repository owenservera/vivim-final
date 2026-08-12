// src/engines/code-audit/types.ts
// Comprehensive domain model for the SOTA (State-of-the-Art) 10-phase agentic
// code audit engine. Unifies the classic severity model (CRITICAL..INFO), the
// devops/audit-code priority/dimension model (P0-P3), real-time streaming
// events, token-aware static analysis, and verified patch synthesis.

export type AuditPhase =
  | 'INGESTION_AST'
  | 'TOPOLOGY_CALL_GRAPH'
  | 'CONTEXT_INDEXING'
  | 'STATIC_ANALYSIS'
  | 'TAINT_TRACKING'
  | 'AGENT_DEBATE'
  | 'DYNAMIC_TESTING'
  | 'RISK_TRIAGE'
  | 'PATCH_SYNTHESIS'
  | 'REPORTING'

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export type Dimension =
  | 'security'
  | 'correctness'
  | 'architecture'
  | 'quality'
  | 'performance'
  | 'testing'
  | 'dependencies'
  | 'drift'
  | 'commands'
  | 'frontend'

export type Risk = 'H' | 'M' | 'L'

export interface CodeLocation {
  filePath: string
  lineNumber?: number
  columnNumber?: number
  snippet?: string
}

export interface TaintStep {
  step: number
  location: CodeLocation
  description: string
}

export interface TaintFlow {
  source: CodeLocation
  sink: CodeLocation
  path: TaintStep[]
}

export type AgentName = 'SecOpsAgent' | 'PerfAgent' | 'CleanCodeAgent'

export interface AgentOpinion {
  agentName: AgentName
  score: number // 0.0 to 1.0
  verdict: 'APPROVE_FINDING' | 'REJECT_FINDING' | 'NEEDS_REFINEMENT'
  rationale: string
}

export interface DebateConsensus {
  approved: boolean
  consensusScore: number // 0.0 to 1.0
  opinions: AgentOpinion[]
  verdict: 'CONFIRMED_DEFECT' | 'FALSE_POSITIVE' | 'NEEDS_MANUAL_REVIEW'
  moderatorSummary: string
  engine: 'deterministic-fallback'
}

export type VerificationStatus = 'verified' | 'refuted' | 'unverified'

export interface Finding {
  id: string
  phase: AuditPhase
  title: string
  description: string
  location: CodeLocation
  severity: SeverityLevel
  cwe?: string
  ruleId: string
  confidenceScore: number // 0.0 to 1.0
  dimension: Dimension
  evidence?: string
  impact?: string
  taintFlow?: TaintFlow
  debateConsensus?: DebateConsensus
  suggestedPatch?: {
    diff: string
    explanation: string
    patchedSnippet: string
    kind: RulePatchRecipe['kind']
  }
  patchVerification?: { status: VerificationStatus; note: string }
  generatedTestCode?: string
  dynamicVerification?: { status: VerificationStatus; note: string }
  falsePositive?: boolean
}

export interface GraphNode {
  id: string
  label: string
  kind: 'FUNCTION' | 'CLASS' | 'INTERFACE' | 'MODULE' | 'EXPRESSION'
  filePath: string
  lineStart: number
  lineEnd: number
  complexity: number
}

export interface GraphEdge {
  sourceId: string
  targetId: string
  relation: 'CALLS' | 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'USES_TAINTED_DATA'
}

export interface CodebaseTopology {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cyclomaticComplexitySum: number
  maxComplexityNode?: GraphNode
  orphanFiles: string[]
}

export interface IngestionStats {
  totalFiles: number
  totalLinesOfCode: number
  fileTypes: Record<string, number>
  parsedSymbolsCount: number
}

export interface PhaseResult {
  phase: AuditPhase
  status: 'COMPLETED' | 'SKIPPED' | 'FAILED'
  durationMs: number
  findingsCount: number
  details?: Record<string, unknown>
}

export interface AuditSummary {
  severity: Record<SeverityLevel, number>
  byDimension: Record<string, number>
  falsePositiveCount: number
}

export interface AuditReport {
  id: string
  timestamp: string
  targetPath: string
  commit?: string
  scope?: string
  overallHealthScore: number // 0 - 100
  risk: Risk
  slocTotal: number
  fileCount: number
  ingestionStats: IngestionStats
  topologySummary: {
    totalSymbols: number
    totalEdges: number
    maxComplexity: number
  }
  phaseResults: PhaseResult[]
  findings: Finding[]
  summary: Record<SeverityLevel, number>
  byDimension: Record<string, number>
  byRule: Record<string, number>
}

// ── SARIF 2.1.0 export ────────────────────────────────────────────────────

export interface SarifLog {
  $schema: string
  version: string
  runs: Array<{
    tool: {
      driver: {
        name: string
        version: string
        informationUri: string
        rules: Array<{
          id: string
          shortDescription: { text: string }
          fullDescription: { text: string }
          defaultConfiguration: { level: 'error' | 'warning' | 'note' }
        }>
      }
    }
    results: Array<{
      ruleId: string
      message: { text: string }
      level: 'error' | 'warning' | 'note'
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string }
          region: { startLine: number }
        }
      }>
    }>
  }>
}

// ── Token-aware static analysis ────────────────────────────────────────────

export type TokenKind = 'identifier' | 'keyword' | 'punct' | 'number' | 'regex'

export interface Token {
  text: string
  line: number // 1-based
  column: number // 0-based
  kind: TokenKind
}

/**
 * A file with strings/comments/templates stripped to spaces (line-preserving)
 * plus the meaningful code tokens. Rules run against `tokens` / `code` only,
 * never against the raw source, so string references like `'eval('` can never
 * masquerade as real calls.
 */
export interface TokenizedFile {
  filePath: string
  source: string
  lines: string[]
  code: string // source with non-code regions blanked
  tokens: Token[]
}

// ── Declarative rule registry ─────────────────────────────────────────────

export interface RulePatchRecipe {
  kind: 'remove-line' | 'wrap-try-catch' | 'insert-log' | 'replace' | 'manual'
  summary: string
  steps: string[]
  effort: 'S' | 'M' | 'L'
  /** Reconstruct a patched line for the given finding; returns null for 'manual'. */
  render?: (finding: Finding, lineText: string) => string | null
}

export interface AuditRule {
  id: string
  dimension: Dimension
  severity: SeverityLevel
  cwe?: string
  title: string
  description: string
  confidence: number // base confidence 0..1
  extensions: string[]
  /** File-level allowlist (path substrings). Sanctioned wrappers go here. */
  allowlist?: string[]
  /** Runs on the code-only token projection. Return raw finding seeds. */
  detect(tf: TokenizedFile): FindingSeed[]
  /** Optional raw-line fallback for non-JS files (e.g. .ps1). */
  detectRaw?(filePath: string, lines: string[]): FindingSeed[]
  patch?: RulePatchRecipe
}

export interface FindingSeed {
  line: number
  snippet: string
  title?: string
  description?: string
  evidence?: string
  impact?: string
  confidence?: number
  cwe?: string
  severity?: SeverityLevel
}

// ── Debate verdicts ───────────────────────────────────────────────────────

export interface DebateVerdict {
  findingId: string
  approved: boolean
  score: number
  verdict: DebateConsensus['verdict']
  rationale: string
  opinions: AgentOpinion[]
}

export interface DebateContext {
  ruleId: string
  title: string
  description: string
  severity: SeverityLevel
  confidence: number
  file: string
  line: number
  snippet: string
  cwe?: string
}

// ── Streaming ─────────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'audit:start'; targetPath: string; ts: string; id: string }
  | { type: 'phase:start'; phase: AuditPhase; ts: string }
  | {
      type: 'phase:end'
      phase: AuditPhase
      status: PhaseResult['status']
      durationMs: number
      findingsCount: number
      ts: string
    }
  | { type: 'finding'; finding: Finding; ts: string }
  | { type: 'tick'; elapsedMs: number; filesScanned: number; findingsSoFar: number; ts: string }
  | { type: 'audit:end'; report: AuditReport; ts: string }
  | { type: 'audit:error'; message: string; ts: string }

export interface AuditStreamCallbacks {
  onProgress?: (event: StreamEvent) => void
  onFinding?: (finding: Finding) => void
  onPhase?: (phase: AuditPhase, result: PhaseResult) => void
  onTick?: (tick: { elapsedMs: number; filesScanned: number; findingsSoFar: number }) => void
}

// ── Engine options ────────────────────────────────────────────────────────

export interface CodeAuditOptions {
  targetPath: string
  enableDynamicTesting?: boolean
  /** Actually run generated probe tests via bun test (bounded). */
  runDynamicTests?: boolean
  enablePatchGeneration?: boolean
  /** Re-run the rule on a patched copy; keep only patches that clear. */
  verifyPatches?: boolean
  enableSarifExport?: boolean
  maxDebateRounds?: number
  rulesFilter?: string[]
  /** Directory names to skip while walking (matched on entry name). */
  ignorePaths?: string[]
  /** File names to skip while walking (matched on entry name). */
  ignoreFiles?: string[]
  /** Real-time feedback (also mirrored to CapabilityEventBus). */
  stream?: AuditStreamCallbacks
  /** Tick interval in ms while phases are running (default 2000). */
  tickIntervalMs?: number
  /** Emit NDJSON stream to this file path. */
  ndjsonOut?: string
  /** Audit scope label surfaced in reports (e.g. 'sota'). */
  scope?: string
}
