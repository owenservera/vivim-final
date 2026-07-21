// devops/llm-testing/types.ts
// Core types for the LLM-as-Human production testing system.

import type { CapabilitySurface } from '../../src/engines/unified-registry.js'

// ── Surfaces ──────────────────────────────────────────────────────────────

export type TestSurface = CapabilitySurface | 'provider'

export type TestMode = 'smoke' | 'full' | 'parity' | 'providers' | 'workflow'

export type TestStatus = 'pass' | 'fail' | 'skip' | 'error'

// ── Test Case ─────────────────────────────────────────────────────────────

export interface TestCase {
  id: string
  surface: TestSurface
  capability: string
  action: string
  expected: string
  input?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  timeoutMs?: number
}

// ── Test Result ───────────────────────────────────────────────────────────

export interface TestResult {
  id: string
  surface: TestSurface
  capability: string
  action: string
  expected: string
  actual: string
  status: TestStatus
  durationMs: number
  timestamp: string
  screenshot?: string
  consoleLogs?: string[]
  networkRequests?: string[]
  error?: string
  fix?: string
}

// ── Pattern ───────────────────────────────────────────────────────────────

export interface PatternFailure {
  timestamp: string
  symptom: string
  rootCause: string
  fix: string
}

export interface Pattern {
  id: string
  surface: TestSurface
  capability: string
  pattern: string
  confidence: number
  lastVerified: string
  failures: PatternFailure[]
  tags: string[]
}

// ── Provider Knowledge ────────────────────────────────────────────────────

export type SendMethod = 'enter-or-click' | 'click-send-button'

export interface ProviderKnowledge {
  composerSelector: string
  sendMethod: SendMethod
  sendButtonSelector?: string
  enterKeyBroken: boolean
  streamFormat: string
  quirks: string[]
  lastTested: string
  successRate: number
}

// ── Surface Coverage ──────────────────────────────────────────────────────

export interface SurfaceCoverage {
  totalCapabilities: number
  testedCapabilities: number
  coverage: number
  lastFullRun: string
  gaps: string[]
}

// ── Error Entry ───────────────────────────────────────────────────────────

export interface ErrorEntry {
  id: string
  surface: TestSurface
  capability: string
  error: string
  rootCause: string
  fix: string
  occurrences: number
  lastSeen: string
  resolved: boolean
}

// ── Priority ──────────────────────────────────────────────────────────────

export interface PriorityEntry {
  surface: TestSurface
  capability: string
  reason: string
  riskScore: number
  coverageGap: number
}

// ── Session ───────────────────────────────────────────────────────────────

export interface SessionSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  errored: number
  newPatternsLearned: number
  errorsEncountered: number
  coverageDelta: Record<TestSurface, { before: number; after: number }>
}

export interface SessionTrace {
  sessionId: string
  startedAt: string
  endedAt: string
  mode: TestMode
  config: {
    backendPort: number
    frontendPort: number
    providers: string[]
  }
  tests: TestResult[]
  summary: SessionSummary
}

// ── Knowledge Store ───────────────────────────────────────────────────────

export interface PatternsFile {
  version: number
  lastUpdated: string
  patterns: Pattern[]
}

export interface ProvidersFile {
  [providerSlug: string]: ProviderKnowledge
}

export interface SurfacesFile {
  [surface in TestSurface]?: SurfaceCoverage
}

export interface ErrorsFile {
  errors: ErrorEntry[]
}

export interface PrioritiesFile {
  version: number
  lastComputed: string
  queue: PriorityEntry[]
}

// ── Knowledge Delta ───────────────────────────────────────────────────────

export interface KnowledgeDelta {
  newPatterns: Pattern[]
  updatedPatterns: Pattern[]
  newErrors: ErrorEntry[]
  updatedErrors: ErrorEntry[]
}

// ── Adapter Config ────────────────────────────────────────────────────────

export interface TestConfig {
  backendPort: number
  frontendPort: number
  providers: string[]
  timeoutMs: number
  maxProviderPrompts: number
  providerDelayMs: number
}
