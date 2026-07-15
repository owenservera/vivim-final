// src/engines/nlcl/types.ts
// Natural Language Command Layer (NLCL) — shared type contracts.
// The "comms system": lets users type natural language and the system
// deterministically parses + routes + executes — no local AI required for 95% of commands.
// Pluggable IntentResolver allows swapping in a local LLM for the remaining 5%.

import type { ZodSchema } from 'zod'
import type { CapabilitySurface } from '../unified-registry.js'

// ── Core Types ────────────────────────────────────────────────────────────

export type NLCLSurface = CapabilitySurface | 'frontend'

export type ActionClassification =
  | 'read'
  | 'write'
  | 'navigate'
  | 'destructive'
  | 'communication'
  | 'financial'
  | 'system'

export type ExecutorId =
  | 'file'
  | 'browser'
  | 'email'
  | 'provider-llm'
  | 'capability'
  | 'system'
  | 'conversation'
  | 'workflow'
  | 'app'
  | 'canvas'
  | 'memory'
  | 'llm'
  | 'web'

export interface NLCContext {
  workspacePath?: string
  providerId?: string
  accountId?: string
  conversationId?: string
  slaveId?: string
  userId?: string
  surface: NLCLSurface
  metadata: Record<string, unknown>
  canvasState?: Record<string, unknown>
  activeSessionId?: string
}

/** Raw request context from HTTP/CLI transport for bindContext. */
export interface RawRequestContext {
  conversationId?: string
  providerId?: string
  slaveId?: string
  userId?: string
  surface?: NLCLSurface
  metadata?: Record<string, unknown>
  canvasState?: Record<string, unknown>
  activeSessionId?: string
}

export interface CommandResult {
  ok: boolean
  intent: string
  output?: unknown
  text?: string
  error?: string
  latencyMs: number
  traceId: string
  followUp?: string
  requiresConfirmation?: boolean
  classification: ActionClassification
  /** Unit 25.1 — resolved UnifiedCapability id (or slug) so downstream transports can act directly. */
  capabilityId?: string
  confirmation?: {
    token: string
    prompt: string
  }
  clarification?: {
    prompt: string
    missing?: string[]
    ambiguous?: string[]
    options?: string[]
  }
}

export interface ParsedIntent {
  patternId: string
  intent: string
  input: Record<string, unknown>
  confidence: number
  rawInput: string
  matchedPattern: string
  alternatives: ParsedIntent[]
  resolvedAt: number
  /** Unit 25.1 — resolved UnifiedCapability id for registry execution. */
  capabilityId?: string
  /** Action classification of the matched capability (drives HITL approval gating). */
  classification?: ActionClassification
}

export interface NLPattern {
  regex: RegExp
  keywords?: string[]
  priority: number
  extract: (match: RegExpMatchArray, rawInput: string) => Record<string, unknown>
}

export interface CommandPattern {
  id: string
  intent: string
  description: string
  patterns: NLPattern[]
  aliases: string[]
  examples: string[]
  inputSchema: ZodSchema
  outputSchema: ZodSchema
  executor: ExecutorId
  execute: (input: Record<string, unknown>, ctx: NLCContext) => Promise<unknown>
  category: string
  surfaces: NLCLSurface[]
  requiresConfirmation: boolean
  classification: ActionClassification
  aiFallback: boolean
  tags: string[]
  /** Unit 25.1 — target UnifiedCapability id (slug or id) for direct registry execution. */
  capabilityId?: string
}

// ── Resolver Interface (Pluggable AI) ─────────────────────────────────────

export interface IntentResolver {
  readonly name: string
  resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null>
}

export interface ResolverConfig {
  type: 'deterministic' | 'local-llm' | 'provider-llm' | 'hybrid' | 'layered'
  localLlmEndpoint?: string
  localLlmModel?: string
  providerId?: string
  fallbackToDeterministic: boolean
  minConfidence: number
  // SOTA layered-pipeline thresholds (Layer 2/3/4 gates).
  fuzzyThreshold?: number
  semanticThreshold?: number
  llmThreshold?: number
}

// ── Executor Interface ────────────────────────────────────────────────────

export interface CommandExecutor {
  readonly id: ExecutorId
  execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult>
}

// ── Engine Config ─────────────────────────────────────────────────────────

export interface NLCLEngineConfig {
  resolver: ResolverConfig
  defaultTimeoutMs: number
  enableAIFallback: boolean
  maxAlternatives: number
  auditLog: boolean
}

export const DEFAULT_NLCL_CONFIG: NLCLEngineConfig = {
  resolver: {
    // SOTA default: full 5-layer pipeline (Deterministic → Fuzzy → Semantic → LLM).
    type: 'layered',
    fallbackToDeterministic: true,
    minConfidence: 0.5,
    fuzzyThreshold: 0.7,
    semanticThreshold: 0.6,
    llmThreshold: 0.5,
  },
  defaultTimeoutMs: 30_000,
  enableAIFallback: true,
  maxAlternatives: 3,
  auditLog: true,
}

// ── Helper: classification priority ───────────────────────────────────────

const CLASSIFICATION_PRIORITY: Record<ActionClassification, number> = {
  read: 0,
  navigate: 1,
  system: 2,
  communication: 3,
  write: 4,
  destructive: 5,
  financial: 6,
}

export function classificationAtLeast(
  classification: ActionClassification,
  threshold: ActionClassification,
): boolean {
  return (CLASSIFICATION_PRIORITY[classification] ?? 0) >= (CLASSIFICATION_PRIORITY[threshold] ?? 0)
}
