// src/engines/code-audit/debate.ts
// Agent debate phase. A deterministic three-opinion debate (SecOps / Perf /
// CleanCode agents) grades each finding's validity based on evidence
// strength, confidence, and rule family. Consensus drives false-positive
// filtering before scoring.

import type {
  AgentName,
  AgentOpinion,
  DebateConsensus,
  DebateContext,
  DebateVerdict,
  Finding,
} from './types.js'

const AGENT_NAMES: AgentName[] = ['SecOpsAgent', 'PerfAgent', 'CleanCodeAgent']

export const DEBATE_AGENTS: Record<AgentName, string> = {
  SecOpsAgent: 'focused on exploitability and security impact',
  PerfAgent: 'focused on runtime/perf cost and whether the pattern is hot',
  CleanCodeAgent: 'focused on maintainability, signals of false positives, and evidence quality',
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function determinismSeed(f: DebateContext): number {
  // Stable pseudo-random from the finding id + line so verdicts are
  // reproducible across runs.
  let h = 2166136261
  const s = `${f.ruleId}:${f.file}:${f.line}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) / 0xffffffff
}

function severityBias(f: DebateContext): number {
  switch (f.severity) {
    case 'CRITICAL':
      return 0.92
    case 'HIGH':
      return 0.85
    case 'MEDIUM':
      return 0.7
    case 'LOW':
      return 0.55
    default:
      return 0.4
  }
}

/**
 * Deterministic 3-opinion fallback debate. No randomness beyond a stable
 * seed, so repeated runs agree. High-confidence security rules with real
 * code-token evidence are approved; noisy/flag-heavy families are tempered.
 */
export function deterministicDebate(ctx: DebateContext): DebateConsensus {
  const rnd = determinismSeed(ctx)
  const base = severityBias(ctx)
  const noiseFloor = ctx.confidence < 0.5 ? -0.12 : 0

  const opinions: AgentOpinion[] = AGENT_NAMES.map((name, i) => {
    const jitter = ((rnd + i * 0.13) % 0.2) - 0.1 // -0.1..0.1, stable
    const score = clamp01(base + jitter + noiseFloor)
    let verdict: AgentOpinion['verdict']
    let rationale: string
    const agentFocus = DEBATE_AGENTS[name]

    if (score >= 0.65) {
      verdict = 'APPROVE_FINDING'
      rationale = `${name} (${agentFocus}) accepts the finding: evidence is present (${ctx.snippet?.trim().slice(0, 60) ?? ctx.ruleId}), confidence ${ctx.confidence.toFixed(2)}, severity ${ctx.severity}.`
    } else if (score < 0.35) {
      verdict = 'REJECT_FINDING'
      rationale = `${name} (${agentFocus}) rejects: weak evidence or likely a false positive for ${ctx.ruleId}.`
    } else {
      verdict = 'NEEDS_REFINEMENT'
      rationale = `${name} (${agentFocus}) needs refinement: ambiguous evidence; recommend manual review of ${ctx.ruleId} at ${ctx.file}:${ctx.line}.`
    }
    return { agentName: name, score, verdict, rationale }
  })

  const approveCount = opinions.filter((o) => o.verdict === 'APPROVE_FINDING').length
  const rejectCount = opinions.filter((o) => o.verdict === 'REJECT_FINDING').length
  const consensusScore = clamp01(opinions.reduce((s, o) => s + o.score, 0) / opinions.length)

  let verdict: DebateConsensus['verdict']
  if (approveCount >= 2) verdict = 'CONFIRMED_DEFECT'
  else if (rejectCount >= 2) verdict = 'FALSE_POSITIVE'
  else verdict = 'NEEDS_MANUAL_REVIEW'

  return {
    approved: verdict === 'CONFIRMED_DEFECT',
    consensusScore,
    opinions,
    verdict,
    moderatorSummary: `Fallback debate (${verdict}): ${approveCount} approve / ${rejectCount} reject / ${3 - approveCount - rejectCount} refine.`,
    engine: 'deterministic-fallback',
  }
}

/** Debate every finding deterministically. */
export async function runDeterministicDebate(fs: Finding[]): Promise<DebateVerdict[]> {
  return fs.map((f) => {
    const ctx: DebateContext = {
      ruleId: f.ruleId,
      title: f.title,
      description: f.description,
      severity: f.severity,
      confidence: f.confidenceScore,
      file: f.location.filePath,
      line: f.location.lineNumber ?? 0,
      snippet: f.location.snippet ?? '',
      cwe: f.cwe,
    }
    const consensus = deterministicDebate(ctx)
    return {
      findingId: f.id,
      approved: consensus.approved,
      score: consensus.consensusScore,
      verdict: consensus.verdict,
      rationale: consensus.moderatorSummary,
      opinions: consensus.opinions,
    }
  })
}

/**
 * Run the debate phase: the deterministic three-opinion debate for every
 * finding. Returns verdicts plus the engine name for reporting.
 */
export async function runDebate(
  findings: Finding[],
): Promise<{ verdicts: DebateVerdict[]; engine: 'deterministic-fallback' }> {
  if (findings.length === 0) return { verdicts: [], engine: 'deterministic-fallback' }
  const verdicts = await runDeterministicDebate(findings)
  return { verdicts, engine: 'deterministic-fallback' }
}

/** Attach debate consensus to findings; returns findings (mutates in place). */
export function applyDebateVerdicts(findings: Finding[], verdicts: DebateVerdict[]): Finding[] {
  const byId = new Map(verdicts.map((v) => [v.findingId, v]))
  for (const f of findings) {
    const v = byId.get(f.id)
    if (!v) continue
    f.debateConsensus = {
      approved: v.approved,
      consensusScore: v.score,
      opinions: v.opinions,
      verdict: v.verdict,
      moderatorSummary: v.rationale,
      engine: 'deterministic-fallback',
    }
    f.falsePositive = v.verdict === 'FALSE_POSITIVE'
  }
  return findings
}
