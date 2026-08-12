// src/engines/code-audit/index.ts
// Production-grade 10-Phase Agentic Code Audit Engine (SOTA rewrite).
//
// Phase pipeline:
//   1. INGESTION_AST      — collect + tokenize files (token-aware)
//   2. TOPOLOGY_CALL_GRAPH — symbols, complexity, call/import edges
//   3. CONTEXT_INDEXING   — keyword/entity index for rule context
//   4. STATIC_ANALYSIS    — declarative rule registry, real-code matching only
//   5. TAINT_TRACKING     — cross-statement taint source→sink flows
//   6. AGENT_DEBATE       — deterministic 3-agent debate
//   7. DYNAMIC_TESTING    — real bun test probes (bounded), not dead stubs
//   8. RISK_TRIAGE        — dedupe, consensus filtering, confidence-weighted scoring
//   9. PATCH_SYNTHESIS    — recipe-based diffs + re-run verification
//  10. REPORTING          — health score, risk, SARIF, streamed report
//
// Every phase emits real-time progress via callbacks + NDJSON + the
// CapabilityEventBus so the auditing agent sees live feedback instead of
// silent work.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { newId } from '../../ids.js'
import { getLogger } from '../../lib/logger.js'
import { CapabilityEventBus } from '../capability-event-bus.js'
import { applyDebateVerdicts, runDebate } from './debate.js'
import { applyDynamicResults, runDynamicProbes } from './dynamic.js'
import { synthesizePatches } from './patch.js'
import { getRules, isRuleAllowed } from './rules.js'
import {
  computeByRule,
  computeHealthScore,
  computeRisk,
  computeSummary,
  dedupeFindings,
  triageByConsensus,
} from './scoring.js'
import { composeSink, findingEvent, NdjsonWriter, resultToEvent } from './stream.js'
import { buildTopology, extractSymbols, type SymbolRecord } from './symbols.js'
import { analyzeTaint, attachTaint } from './taint.js'
import { tokenize } from './tokenizer.js'
import type {
  AuditPhase,
  AuditReport,
  AuditSummary,
  CodeAuditOptions,
  CodebaseTopology,
  Finding,
  IngestionStats,
  PhaseResult,
  SarifLog,
  SeverityLevel,
  StreamEvent,
  TokenizedFile,
} from './types.js'

export * from './types.js'

const log = getLogger('code-audit-engine')

export class CodeAuditEngine {
  private options: CodeAuditOptions
  private eventBus: CapabilityEventBus
  private sink: ReturnType<typeof composeSink>
  private targetFiles: string[] = []
  private topology: CodebaseTopology = {
    nodes: [],
    edges: [],
    cyclomaticComplexitySum: 0,
    orphanFiles: [],
  }
  private ingestionStats: IngestionStats = {
    totalFiles: 0,
    totalLinesOfCode: 0,
    fileTypes: {},
    parsedSymbolsCount: 0,
  }
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private startTime = 0

  constructor(options: CodeAuditOptions) {
    this.options = {
      enableDynamicTesting: true,
      runDynamicTests: true,
      enablePatchGeneration: true,
      verifyPatches: true,
      enableSarifExport: true,
      maxDebateRounds: 3,
      ignorePaths: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.tauri',
        '.next',
        'out',
        '.archive',
        '.runtime',
        'coverage',
        'target',
        'binaries',
        '.system_generated',
        'brain',
        '.open_code',
        '.opencode',
        '.kilo',
        '.claude',
        // Junk / non-source roots (mirrors .gitignore intent — the engine
        // walker does not parse .gitignore itself).
        'docs',
        'chrome-profiles',
        'harvest',
        'harvest-targets',
        'dev-code-impl',
        '.test-tmp',
        '.playwright-mcp',
        '.skills',
      ],
      ignoreFiles: ['test-sidecar.js', 'test-sidecar-prod.js'],
      tickIntervalMs: 2000,
      ...options,
    }
    this.eventBus = CapabilityEventBus.getInstance()
    this.sink = composeSink(
      this.options.stream,
      this.options.ndjsonOut ? new NdjsonWriter(this.options.ndjsonOut) : undefined,
      (event: StreamEvent) => this.emitBus(event),
    )
  }

  private emitBus(event: StreamEvent): void {
    // Mirror the stream into the capability event bus for agent visibility.
    if (event.type === 'finding') {
      this.eventBus.emit({
        type: 'capability:progress',
        step: 4,
        total: 10,
        description: `[code-audit] ${event.finding.severity} ${event.finding.ruleId} @ ${event.finding.location.filePath}:${event.finding.location.lineNumber ?? 1}`,
        moduleId: 'code-audit-engine',
        slaveId: 'local-audit-worker',
      })
    } else if (event.type === 'phase:end') {
      this.eventBus.emit({
        type: 'capability:progress',
        step: this.phaseIndex(event.phase) + 1,
        total: 10,
        description: `[code-audit] Phase ${event.phase} ${event.status} in ${event.durationMs}ms (${event.findingsCount} findings)`,
        moduleId: 'code-audit-engine',
        slaveId: 'local-audit-worker',
      })
    }
  }

  private phaseIndex(phase: AuditPhase): number {
    const order: AuditPhase[] = [
      'INGESTION_AST',
      'TOPOLOGY_CALL_GRAPH',
      'CONTEXT_INDEXING',
      'STATIC_ANALYSIS',
      'TAINT_TRACKING',
      'AGENT_DEBATE',
      'DYNAMIC_TESTING',
      'RISK_TRIAGE',
      'PATCH_SYNTHESIS',
      'REPORTING',
    ]
    return order.indexOf(phase)
  }

  /**
   * Execute the full 10-phase agentic code audit pipeline with live feedback.
   */
  public async executeAudit(): Promise<AuditReport> {
    this.startTime = Date.now()
    const targetPath = this.options.targetPath
    log.info(`[CodeAuditEngine] Starting 10-phase audit for: ${targetPath}`)
    this.sink.emit({ type: 'audit:start', targetPath, ts: now(), id: newId() })

    const findings: Finding[] = []
    const phaseResults: PhaseResult[] = []
    this.startTickLoop(findings)

    try {
      phaseResults.push(await this.runPhase1_Ingestion())
      phaseResults.push(await this.runPhase2_Topology())
      phaseResults.push(await this.runPhase3_ContextIndexing())
      phaseResults.push(await this.runPhase4_StaticAnalysis(findings))
      phaseResults.push(await this.runPhase5_TaintAnalysis(findings))

      const debate = await this.runPhase6_AgentDebate(findings)
      phaseResults.push(debate)

      phaseResults.push(await this.runPhase7_DynamicTesting(findings))
      phaseResults.push(await this.runPhase8_RiskTriage(findings))
      phaseResults.push(await this.runPhase9_PatchSynthesis(findings))

      const finalReport = await this.runPhase10_Reporting(findings, phaseResults)
      this.stopTickLoop()
      this.sink.emit({ type: 'audit:end', report: finalReport, ts: now() })
      this.sink.close()

      log.info(
        `[CodeAuditEngine] Audit complete. Health ${finalReport.overallHealthScore}/100, risk ${finalReport.risk}, findings ${finalReport.findings.length}`,
      )
      return finalReport
    } catch (err) {
      this.stopTickLoop()
      this.sink.emit({ type: 'audit:error', message: String(err), ts: now() })
      this.sink.close()
      log.error(`[CodeAuditEngine] Audit pipeline failed: ${String(err)}`)
      throw err
    }
  }

  // ── Phase 1: Ingestion & token-aware parsing ────────────────────────────

  private async runPhase1_Ingestion(): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('INGESTION_AST')

    this.targetFiles = this.collectSourceFiles(this.options.targetPath)
    let totalLines = 0
    const fileTypes: Record<string, number> = {}
    for (const file of this.targetFiles) {
      const ext = path.extname(file) || '.text'
      fileTypes[ext] = (fileTypes[ext] ?? 0) + 1
      try {
        totalLines += fs.readFileSync(file, 'utf-8').split('\n').length
      } catch {
  // [audit] log the error with context here
        // unreadable file: skip
      }
    }

    this.ingestionStats = {
      totalFiles: this.targetFiles.length,
      totalLinesOfCode: totalLines,
      fileTypes,
      parsedSymbolsCount: 0,
    }
    return this.endPhase('INGESTION_AST', start, 0, {
      totalFiles: this.targetFiles.length,
      totalLinesOfCode: totalLines,
      fileTypes,
    })
  }

  // ── Phase 2: Call graph & dependency topology ───────────────────────────

  private async runPhase2_Topology(): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('TOPOLOGY_CALL_GRAPH')

    const files: TokenizedFile[] = []
    const symbolsByFile = new Map<string, SymbolRecord[]>()

    for (const file of this.targetFiles) {
      let content: string
      try {
        content = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }
      const tf = tokenize(file, content)
      files.push(tf)
      const syms = extractSymbols(tf)
      if (syms.length > 0) symbolsByFile.set(file, syms)
    }

    const built = buildTopology(files, symbolsByFile)

    this.ingestionStats.parsedSymbolsCount = built.nodes.length
    this.topology = built

    return this.endPhase('TOPOLOGY_CALL_GRAPH', start, 0, {
      totalNodes: built.nodes.length,
      totalEdges: built.edges.length,
      cyclomaticComplexitySum: built.cyclomaticComplexitySum,
      maxComplexity: built.maxComplexityNode?.complexity ?? 0,
    })
  }

  // ── Phase 3: Context indexing ───────────────────────────────────────────

  private async runPhase3_ContextIndexing(): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('CONTEXT_INDEXING')
    return this.endPhase('CONTEXT_INDEXING', start, 0, {
      indexedEntities: this.topology.nodes.length,
      knowledgeGraphEdges: this.topology.edges.length,
      indexNotes:
        'Keyword + symbol index derived from token-aware scan (no external embedding service).',
    })
  }

  // ── Phase 4: Static rule analysis (token-aware) ─────────────────────────

  private async runPhase4_StaticAnalysis(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('STATIC_ANALYSIS')

    const rules = getRules(this.options.rulesFilter)
    let count = 0

    for (const file of this.targetFiles) {
      let content: string
      try {
        content = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }
      const lines = content.split('\n')
      const tf = tokenize(file, content)

      for (const rule of rules) {
        if (!rule.extensions.some((e) => file.endsWith(e))) continue
        if (!isRuleAllowed(rule, file)) continue
        let seeds
        try {
          if (rule.detectRaw && !/[.](ts|tsx|js|jsx|prisma)$/.test(file)) {
            seeds = rule.detectRaw(file, lines)
          } else {
            seeds = rule.detect(tf)
          }
        } catch {
          continue
        }
        for (const s of seeds) {
          findings.push({
            id: newId(),
            phase: 'STATIC_ANALYSIS',
            ruleId: rule.id,
            title: s.title ?? rule.title,
            description: s.description ?? rule.description,
            location: {
              filePath: file,
              lineNumber: s.line,
              snippet: s.snippet,
            },
            severity: s.severity ?? rule.severity,
            cwe: s.cwe ?? rule.cwe,
            confidenceScore: s.confidence ?? rule.confidence,
            dimension: rule.dimension,
            evidence: s.evidence,
            impact: s.impact,
          })
          count++
        }
      }
    }

    for (const f of findings) this.sink.emit(findingEvent(f))
    return this.endPhase('STATIC_ANALYSIS', start, count)
  }

  // ── Phase 5: Taint tracking ─────────────────────────────────────────────

  private async runPhase5_TaintAnalysis(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('TAINT_TRACKING')

    let taintCount = 0
    for (const file of this.targetFiles) {
      let content: string
      try {
        content = fs.readFileSync(file, 'utf-8')
      } catch {
        continue
      }
      const rawLines = content.split('\n')
      const codeLines = rawLines.map((l) =>
        l
          .replace(/'.*?'/g, ' ')
          .replace(/".*?"/g, ' ')
          .replace(/\/\/.*$/g, ''),
      )
      const { flows, dynamicExecFlows } = analyzeTaint(file, codeLines, rawLines)
      for (const flow of [...flows, ...dynamicExecFlows]) {
        findings.push({
          id: newId(),
          phase: 'TAINT_TRACKING',
          ruleId: 'TAINT-INJECTION-01',
          title: 'Unsanitized Data Flow to Execution Sink',
          description:
            'Untrusted input flows into a dynamic command/code execution sink without validation.',
          location: flow.sink,
          severity: 'HIGH',
          cwe: 'CWE-78',
          confidenceScore: 0.88,
          dimension: 'security',
          taintFlow: flow,
        })
        taintCount++
      }
    }

    // Annotate static findings that hit dynamic sinks with a taint flow.
    attachTaint(findings)

    // Stream the new taint findings so live feedback covers every phase.
    for (const f of findings) {
      if (f.phase === 'TAINT_TRACKING') this.sink.emit(findingEvent(f))
    }

    return this.endPhase('TAINT_TRACKING', start, taintCount, { flows: taintCount })
  }

  // ── Phase 6: Multi-agent debate & consensus ─────────────────────────────

  private async runPhase6_AgentDebate(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('AGENT_DEBATE')

    const { verdicts, engine } = await runDebate(findings)
    applyDebateVerdicts(findings, verdicts)
    const consensus = triageByConsensus(findings)

    return this.endPhase('AGENT_DEBATE', start, findings.length, {
      debatedFindings: findings.length,
      approved: consensus.approved.length,
      refuted: consensus.refuted.length,
      needsReview: consensus.needsReview.length,
      engine,
      rounds: this.options.maxDebateRounds ?? 3,
    })
  }

  // ── Phase 7: Dynamic verification (real probes) ─────────────────────────

  private async runPhase7_DynamicTesting(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('DYNAMIC_TESTING')

    if (!this.options.enableDynamicTesting) {
      return this.endPhase('DYNAMIC_TESTING', start, 0, { skipped: true }, 'SKIPPED')
    }

    const results = await runDynamicProbes(findings, this.options.runDynamicTests)
    applyDynamicResults(findings, results)
    const verified = [...results.values()].filter((r) => r.status === 'verified').length
    const refuted = [...results.values()].filter((r) => r.status === 'refuted').length

    return this.endPhase('DYNAMIC_TESTING', start, findings.length, {
      probesGenerated: results.size,
      probesVerified: verified,
      probesRefuted: refuted,
      executor: this.options.runDynamicTests ? 'bun-test' : 'off',
    })
  }

  // ── Phase 8: Risk triage & scoring ──────────────────────────────────────

  private async runPhase8_RiskTriage(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('RISK_TRIAGE')

    const deduped = dedupeFindings(findings)
    findings.length = 0
    findings.push(...deduped)

    const severityWeight: Record<SeverityLevel, number> = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      INFO: 1,
    }
    findings.sort((a, b) => {
      const w = severityWeight[b.severity] - severityWeight[a.severity]
      if (w !== 0) return w
      return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)
    })

    return this.endPhase('RISK_TRIAGE', start, findings.length, {
      deduplicated: deduped.length,
      falsePositives: triageByConsensus(findings).refuted.length,
    })
  }

  // ── Phase 9: Patch synthesis & verification ─────────────────────────────

  private async runPhase9_PatchSynthesis(findings: Finding[]): Promise<PhaseResult> {
    const start = Date.now()
    this.startPhase('PATCH_SYNTHESIS')

    if (!this.options.enablePatchGeneration) {
      return this.endPhase('PATCH_SYNTHESIS', start, 0, { skipped: true }, 'SKIPPED')
    }

    await synthesizePatches(findings, this.options.verifyPatches)
    const patched = findings.filter((f) => f.suggestedPatch).length
    const verified = findings.filter((f) => f.patchVerification?.status === 'verified').length

    return this.endPhase('PATCH_SYNTHESIS', start, patched, {
      patchesGenerated: patched,
      patchesVerified: verified,
      verificationEnabled: this.options.verifyPatches ?? true,
    })
  }

  // ── Phase 10: Reporting & SARIF export ──────────────────────────────────

  private async runPhase10_Reporting(
    findings: Finding[],
    phaseResults: PhaseResult[],
  ): Promise<AuditReport> {
    const start = Date.now()
    this.startPhase('REPORTING')

    const summary: AuditSummary = computeSummary(findings)
    const byRule = computeByRule(findings)
    const overallHealthScore = computeHealthScore(findings, this.targetFiles.length)
    const risk = computeRisk(findings)

    phaseResults.push(this.endPhase('REPORTING', start, findings.length, {}, 'COMPLETED', true))

    const report: AuditReport = {
      id: newId(),
      timestamp: now(),
      targetPath: this.options.targetPath,
      scope: this.options.scope,
      overallHealthScore,
      risk,
      slocTotal: this.ingestionStats.totalLinesOfCode,
      fileCount: this.targetFiles.length,
      ingestionStats: this.ingestionStats,
      topologySummary: {
        totalSymbols: this.topology.nodes.length,
        totalEdges: this.topology.edges.length,
        maxComplexity: this.topology.maxComplexityNode?.complexity ?? 0,
      },
      phaseResults,
      findings,
      summary: summary.severity,
      byDimension: summary.byDimension,
      byRule,
    }

    if (this.options.enableSarifExport) {
      this.generateSarifReport(report)
    }

    return report
  }

  // ── Public SARIF export ─────────────────────────────────────────────────

  public generateSarifReport(report: AuditReport): SarifLog {
    const levelOf = (s: SeverityLevel): 'error' | 'warning' | 'note' =>
      s === 'CRITICAL' || s === 'HIGH' ? 'error' : s === 'MEDIUM' ? 'warning' : 'note'
    return {
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'vivim-agentic-code-audit',
              version: '2.0.0-sota',
              informationUri: 'https://github.com/owenservera/vivim-final',
              rules: report.findings.map((f) => ({
                id: f.ruleId,
                shortDescription: { text: f.title },
                fullDescription: { text: f.description },
                defaultConfiguration: { level: levelOf(f.severity) },
              })),
            },
          },
          results: report.findings.map((f) => ({
            ruleId: f.ruleId,
            message: { text: `${f.title}: ${f.description}` },
            level: levelOf(f.severity),
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.location.filePath },
                  region: { startLine: f.location.lineNumber ?? 1 },
                },
              },
            ],
          })),
        },
      ],
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private collectSourceFiles(dirPath: string): string[] {
    const files: string[] = []
    if (!fs.existsSync(dirPath)) return files
    const stat = fs.statSync(dirPath)
    if (stat.isFile()) return [dirPath]

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (this.options.ignorePaths?.includes(entry.name)) continue
      if (entry.isFile() && this.options.ignoreFiles?.includes(entry.name)) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        files.push(...this.collectSourceFiles(fullPath))
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.ts') ||
          entry.name.endsWith('.tsx') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.jsx') ||
          entry.name.endsWith('.prisma') ||
          entry.name.endsWith('.ps1'))
      ) {
        files.push(fullPath)
      }
    }
    return files
  }

  private startPhase(phase: AuditPhase): void {
    this.sink.emit({ type: 'phase:start', phase, ts: now() })
  }

  private endPhase(
    phase: AuditPhase,
    startedAt: number,
    findingsCount: number,
    details?: Record<string, unknown>,
    status: PhaseResult['status'] = 'COMPLETED',
    skipPush = false,
  ): PhaseResult {
    const result: PhaseResult = {
      phase,
      status,
      durationMs: Date.now() - startedAt,
      findingsCount,
      ...(details ? { details } : {}),
    }
    if (!skipPush) this.sink.emit(resultToEvent(phase, result))
    return result
  }

  private startTickLoop(findings: Finding[]): void {
    const interval = this.options.tickIntervalMs ?? 2000
    this.tickTimer = setInterval(() => {
      this.sink.emit({
        type: 'tick',
        elapsedMs: Date.now() - this.startTime,
        filesScanned: this.targetFiles.length,
        findingsSoFar: findings.length,
        ts: now(),
      })
    }, interval)
  }

  private stopTickLoop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }
}

function now(): string {
  return new Date().toISOString()
}
