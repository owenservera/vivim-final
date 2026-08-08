// src/engines/browser-automation/types.ts
// Shared types for the provider-free browser-automation backbone (SOTA-03/05/09).
// Objective-agnostic, config-driven. No scenario-specific logic lives here.

import type { ZodType } from 'zod'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { SemanticGroundingEngine } from './semantic-grounding.js'

// ── Grounding (SOTA-05) ─────────────────────────────────────────────────────

/** A target element described by any combination of grounding modes. */
export interface SemanticSelector {
  /** ARIA role + accessible name (highest priority). */
  aria?: { role?: string; name?: string }
  /** data-testid attribute. */
  testid?: string
  /** <label> association or aria-label. */
  label?: string
  /** input placeholder text. */
  placeholder?: string
  /** ARIA role only. */
  role?: string
  /** Exact/partial visible text content. */
  text?: string
  /** Legacy CSS selector. */
  css?: string
  /** Legacy XPath. */
  xpath?: string
  /** Visual grounding: screenshot region + description. */
  visual?: { region?: { x: number; y: number; w: number; h: number }; description: string }
  /** Relative anchoring. */
  relative?: 'left-of' | 'right-of' | 'above' | 'below'
  /** nth match (0-indexed) when multiple candidates. */
  nth?: number
  /** Ordered fallback list (composite grounding). */
  composite?: SemanticSelector[]
}

export interface ResolvedElement {
  /** CSS selector that uniquely identifies the element (used for re-resolution). */
  selector: string
  /** Backing SemanticSelector mode that matched. */
  mode: keyof Omit<SemanticSelector, 'composite'>
  /** Optional bounding box (viewport-relative). */
  box?: { x: number; y: number; w: number; h: number }
  /** Stable backend node id (for CDP Input.dispatchMouseEvent rect math). */
  backendNodeId?: number
  /** True if the match came from the SelectorHealer fallback. */
  healed?: boolean
  /** 0-based index into top-frame `document.querySelectorAll('iframe')` when the
   *  match lives inside an iframe (same-origin). Absent = main frame. */
  frameIndex?: number
}

export interface AccessibilityNode {
  role: string
  name?: string
  description?: string
  value?: string
  checked?: boolean
  focused?: boolean
  ignored?: boolean
  children?: AccessibilityNode[]
}

// ── Trust / policy (Axis E) ─────────────────────────────────────────────────

export type TrustLevel = 'read' | 'write' | 'destructive'

export interface TrustPolicy {
  /** Allowed without confirmation. */
  autoRead?: boolean
  /** Allowed but logged. */
  autoWrite?: boolean
  /** Requires human confirmation before execution. */
  requireConfirmation?: boolean
  /** Blocked entirely in auto mode. */
  destructiveBlock?: boolean
  /** Minimum confidence (0-1) to act without asking. */
  confidenceThreshold?: number
  /** Allowlist of URL host suffixes; empty = any. */
  sourceAllowlist?: string[]
  /** Citations / provenance must be tracked for outputs. */
  provenanceTrack?: boolean
}

/** Common trust presets (Axis E). Defined here (not registry.ts) to avoid a
 *  module-init cycle: registry.ts imports the defs at top level, and the defs
 *  read TRUST during module evaluation. */
export const TRUST: Record<'read' | 'write' | 'destructive', TrustPolicy> = {
  read: { autoRead: true, confidenceThreshold: 0.5 },
  write: { autoRead: true, autoWrite: true, confidenceThreshold: 0.6 },
  destructive: {
    autoRead: true,
    autoWrite: true,
    requireConfirmation: true,
    destructiveBlock: true,
    confidenceThreshold: 0.8,
  },
}

export interface BudgetCap {
  maxIterations?: number
  maxDurationMs?: number
  maxCdpCommandsPerIter?: number
  maxLlmCallsPerLoop?: number
  rateLimitPerMin?: number
}

// ── Capability registry (B5) ────────────────────────────────────────────────

export type CapabilityAxis =
  | 'nav'
  | 'input'
  | 'scroll'
  | 'wait'
  | 'extract'
  | 'capture'
  | 'tab'
  | 'net'
  | 'state'
  | 'observe'
  | 'flow'
  | 'os'

export interface CapCtx {
  slaveId: string
  governor: ChromeGovernor
  grounding: SemanticGroundingEngine
  params: Record<string, unknown>
  runId?: string
  budget?: BudgetCap
}

export interface CapResult {
  ok: boolean
  /** Output value(s) produced (text, json, base64, etc.). */
  output?: unknown
  /** Human-readable detail for logs / chat. */
  detail?: string
  /** Optional recognized elements (for grounding caps). */
  resolved?: ResolvedElement
  error?: string
}

export interface BrowserCapabilityDef {
  /** auto:<class>:<action> — e.g. auto:nav:click, auto:extract:table */
  id: string
  axis: CapabilityAxis
  description: string
  /** Zod schema validating params at the boundary. */
  params: ZodType
  /** If set, the handler auto-resolves a target element before acting. */
  grounding?: keyof SemanticSelector | 'composite'
  /** Params that must NOT be treated as target descriptors for grounding
   *  (e.g. `type` uses `text` as the VALUE to type, not a target). */
  groundingExclude?: Set<string>
  /** Trust classification. */
  trust: TrustPolicy
  /** Emits HarnessNode[] (DAG step) OR runs imperatively via governor. */
  handler: (ctx: CapCtx) => Promise<CapResult>
}

// ── Agentic loop (SOTA-03) ──────────────────────────────────────────────────

export interface AgenticGoal {
  goal: string
  /** Optional explicit capability ids to prefer. */
  preferredCapabilities?: string[]
  /** Bounded fan-out for research-style goals. */
  fanout?: number
  trust?: TrustPolicy
  budget?: BudgetCap
}

export type AgentStepKind = 'sense' | 'plan' | 'act' | 'observe' | 'reflect' | 'adapt'

export interface AgentStep {
  kind: AgentStepKind
  detail: string
  /** Capability id invoked, if any. */
  capability?: string
  ok?: boolean
  timestamp: number
}

export interface AgentLoopResult {
  runId: string
  goal: string
  achieved: boolean
  iterations: number
  steps: AgentStep[]
  /** Final synthesized output (text/markdown/json). */
  output?: unknown
  error?: string
}

// ── Observation tap ────────────────────────────────────────────────────────

export interface Observation {
  url: string
  title: string
  /** Trimmed accessibility tree. */
  a11y?: AccessibilityNode
  domSummary?: string
  consoleErrors?: string[]
  networkPending?: number
  screenshot?: string
}
