// src/engines/onboarding/types.ts
// Shared types for the onboarding pipeline.
// See FINAL-UPGRADE-DESIGN.md §2.2 for design rationale.

import { z } from 'zod'

// ── WebApp Fingerprint Vector (WFV) ─────────────────────────────────────────
// Audit 🚀-1: includes a temporal `domDeltaShape` axis (pre-probe vs post-probe)
// so chat-LLM vs translation-UI vs code-assistant (which have nearly identical
// static shapes) become discriminable.

export const WebAppFingerprintVector = z.object({
  domShape: z.object({
    editableCount: z.number().int().nonnegative(),
    textboxRoleCount: z.number().int().nonnegative(),
    scrollableRepeatedBlockDetected: z.boolean(),
    ariaLandmarkRoles: z.array(z.string()),
  }),
  domDeltaShape: z.object({
    // 🚀-1 temporal axis — diff between pre-probe and post-probe snapshots.
    // Captures "this DOM mutates under interaction" which static shape cannot.
    editableCountDelta: z.number().int(),
    textboxRoleCountDelta: z.number().int(),
    appendedBlockCount: z.number().int().nonnegative(),
    replacedBlockCount: z.number().int().nonnegative(),
  }),
  networkShape: z.object({
    sseResponseCount: z.number().int().nonnegative(),
    websocketUpgradeDetected: z.boolean(),
    pollingCadenceMs: z.number().int().positive().nullable(),
  }),
  frameworkShape: z.object({
    // Audit ❌-5 (source) fix — replaced `rootFrameworkGuess` enum (which
    // collapsed svelte+unknown) with discrete boolean signals. Stays
    // LLM-model-agnostic per O2 (no brand/keyword matching).
    hasReactRoot: z.boolean(),
    hasNextData: z.boolean(),
    hasVueApp: z.boolean(),
    generatorMeta: z.string().nullable(),
  }),
  // Audit 🚀-9 fix — SHA-256 hex (was Bun.hash().toString(16) which is
  // variable-length and non-cryptographic).
  shapeSignature: z.string().regex(/^[0-9a-f]{64}$/),
})
export type WebAppFingerprintVector = z.infer<typeof WebAppFingerprintVector>

// ── Transport classification (ProtocolSniffer) ──────────────────────────────

export const TransportClass = z.enum([
  'sse',
  'websocket',
  'chunked_fetch',
  'xhr_poll',
  'dom_mutation_only',
])
export type TransportClass = z.infer<typeof TransportClass>

export interface ProtocolFingerprintResult {
  transportClass: TransportClass
  endpointPattern: string | null
  sampleHeaders: Record<string, string> | null
  cadenceMs: number | null
  confidence: number
}

// ── Parser induction (SPI) ──────────────────────────────────────────────────

/**
 * Tier F P-4 + P-5 — fieldMap entries now carry `required` (presence >= 0.8)
 * and optional `items` (recursive fieldMap for array-typed fields). Both are
 * optional to keep backward-compat with existing parser_candidate rows that
 * were written before V2.
 */
export interface InducedField {
  role: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  /** Tier F P-4 — true iff the field appears in >= 80% of samples. */
  required?: boolean
  /** Tier F P-5 — recursive fieldMap for array-typed fields' elements. */
  items?: Record<string, InducedField>
}

export interface InducedShape {
  kind: 'full_snapshot' | 'incremental_delta'
  fieldMap: Record<string, InducedField>
  confidence: number
}

// ── Capability test gate ────────────────────────────────────────────────────

export interface TestableCapability {
  readonly kind: 'dom_entity' | 'cdp_method' | 'parser'
  readonly id: string
  readonly providerId: string
  test(handle: GovernorHandleLike): Promise<{ passed: boolean; detail?: Record<string, unknown> }>
}

export interface GateOptions {
  sampleRuns: number
  // Audit 🚀-3 fix — Bayesian: promote when P(p > confidenceFloor | evidence) > promotionThreshold.
  confidenceFloor: number
  promotionThreshold: number
}

export const DEFAULT_GATE_OPTIONS: GateOptions = {
  sampleRuns: 5,
  confidenceFloor: 0.9,
  promotionThreshold: 0.95,
}

// ── GovernorHandle-like (narrow surface engines may depend on) ──────────────

export interface GovernorHandleLike {
  readonly slaveId: string
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
  evaluate<T>(expression: string): Promise<T>
}

// ── Onboarding session ──────────────────────────────────────────────────────

export type OnboardingStatus =
  | 'attached'
  | 'fingerprinted'
  | 'taxonomy_resolved'
  | 'discovered'
  | 'synthesized'
  | 'promoted'
  | 'registered'
  | 'failed'

export interface OnboardStartInput {
  slaveId: string
  targetOrigin: string
  dryRun?: boolean
}

export interface OnboardResult {
  sessionId: string
  providerId: string | null
  taxonomyId: string
  taxonomyMethod: 'matched_existing' | 'auto_generated'
  activatedCapabilityCount: number
}
