// src/engines/kernel/oracle-diagnostic.ts
// OracleDiagnosticEngine — the oracle's "immune system". Scans for problems:
// stubs, broken wires, missing deps, stalled engines, health degradation, schema
// mismatches, missing config. Generates actionable diagnostic reports.

import { ulid } from '../../ids.js'
import type { KernelStore } from '../../storage/contracts/kernel-store.js'
import type { KernelRegistry } from './kernel-registry.js'

export type DiagnosticSeverity = 'critical' | 'warning' | 'info'
export type DiagnosticCategory =
  | 'stub'
  | 'broken-wire'
  | 'missing-dep'
  | 'stalled'
  | 'health-degraded'
  | 'config-missing'
  | 'schema-mismatch'

export interface DiagnosticIssue {
  id: string
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  engineId: string
  description: string
  evidence: string[]
  suggestedFix: string
  autoFixable: boolean
  detectedAt: number
}

// Known stub method markers. Engines may also self-report stubs via
// descriptor.metadata.stubMethods (string[]).
const KNOWN_STUB_MARKERS = ['executeHarnessPlan', 'not implemented', 'not yet implemented']

export class OracleDiagnosticEngine {
  private knownStubs = new Map<string, string[]>()

  constructor(
    private readonly registry: KernelRegistry,
    private readonly store: KernelStore | null = null,
  ) {}

  registerKnownStub(engineId: string, method: string): void {
    const existing = this.knownStubs.get(engineId) ?? []
    existing.push(method)
    this.knownStubs.set(engineId, existing)
  }

  async scan(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    issues.push(...(await this.checkStubs()))
    issues.push(...(await this.checkWiring()))
    issues.push(...(await this.checkHealth()))
    issues.push(...(await this.checkSchema()))
    issues.push(...(await this.checkConfig()))
    return issues
  }

  async scanEngine(engineId: string): Promise<DiagnosticIssue[]> {
    const all = await this.scan()
    return all.filter((i) => i.engineId === engineId)
  }

  async getIssue(id: string): Promise<DiagnosticIssue | null> {
    const all = await this.scan()
    return all.find((i) => i.id === id) ?? null
  }

  async getIssuesBySeverity(severity: string): Promise<DiagnosticIssue[]> {
    const all = await this.scan()
    return all.filter((i) => i.severity === severity)
  }

  async getIssuesByEngine(engineId: string): Promise<DiagnosticIssue[]> {
    return this.scanEngine(engineId)
  }

  async checkStubs(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    for (const engine of this.registry.listEngines()) {
      const reported = (engine.metadata?.stubMethods as string[] | undefined) ?? []
      const known = this.knownStubs.get(engine.id) ?? []
      const methods = new Set([...reported, ...known])
      for (const method of methods) {
        if (KNOWN_STUB_MARKERS.includes(method) || method.toLowerCase().includes('stub')) {
          issues.push({
            id: `stub:${engine.id}:${method}`,
            severity: 'warning',
            category: 'stub',
            engineId: engine.id,
            description: `Engine ${engine.id} has stub method ${method}`,
            evidence: [`metadata.stubMethods includes "${method}"`],
            suggestedFix: `Implement ${method} per its atomic spec`,
            autoFixable: false,
            detectedAt: Date.now(),
          })
        }
      }
    }
    return issues
  }

  async checkWiring(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    for (const engine of this.registry.listEngines()) {
      for (const dep of engine.dependencies) {
        const depEngine = this.registry.getEngine(dep)
        if (!depEngine) {
          issues.push({
            id: `missing-dep:${engine.id}:${dep}`,
            severity: 'critical',
            category: 'missing-dep',
            engineId: engine.id,
            description: `Engine ${engine.id} depends on missing engine ${dep}`,
            evidence: [`dependencies: ${JSON.stringify(engine.dependencies)}`],
            suggestedFix: `Register engine ${dep} or remove the dependency`,
            autoFixable: false,
            detectedAt: Date.now(),
          })
        } else if (depEngine.status === 'error') {
          issues.push({
            id: `broken-wire:${engine.id}:${dep}`,
            severity: 'warning',
            category: 'broken-wire',
            engineId: engine.id,
            description: `Engine ${engine.id} depends on errored engine ${dep}`,
            evidence: [
              `${dep} status = error`,
              `error: ${String(depEngine.metadata?.error ?? 'unknown')}`,
            ],
            suggestedFix: `Heal engine ${dep} (restart or reconnect)`,
            autoFixable: false,
            detectedAt: Date.now(),
          })
        }
      }
    }
    return issues
  }

  async checkHealth(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    for (const engine of this.registry.listEngines()) {
      const status = engine.health?.status
      if (status === 'unhealthy') {
        issues.push({
          id: `health:${engine.id}:unhealthy`,
          severity: 'critical',
          category: 'health-degraded',
          engineId: engine.id,
          description: `Engine ${engine.id} is unhealthy`,
          evidence: [JSON.stringify(engine.health?.details ?? {})],
          suggestedFix: 'Restart or reconfigure engine',
          autoFixable: true,
          detectedAt: Date.now(),
        })
      } else if (status === 'degraded') {
        issues.push({
          id: `health:${engine.id}:degraded`,
          severity: 'warning',
          category: 'health-degraded',
          engineId: engine.id,
          description: `Engine ${engine.id} is degraded`,
          evidence: [JSON.stringify(engine.health?.details ?? {})],
          suggestedFix: 'Reset circuit breaker or reconfigure engine',
          autoFixable: true,
          detectedAt: Date.now(),
        })
      }
    }
    return issues
  }

  async checkSchema(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    if (!this.store) {
      issues.push({
        id: 'schema:nostore',
        severity: 'info',
        category: 'schema-mismatch',
        engineId: 'kernel',
        description: 'No KernelStore attached — cannot verify kernel tables',
        evidence: ['store is null'],
        suggestedFix: 'Attach a KernelStore to enable schema verification',
        autoFixable: false,
        detectedAt: Date.now(),
      })
      return issues
    }
    // Expected kernel tables (best-effort: presence verified via a probe query).
    const expected = ['kernel_spans', 'kernel_provenance', 'kernel_topology', 'kernel_events']
    void expected
    // Full introspection requires DB-specific access; the KernelStore contract
    // exposes queryRecentSpans/provenance which fail loudly if the table is missing.
    try {
      await this.store.queryRecentSpans(1)
    } catch (err) {
      issues.push({
        id: 'schema:spans',
        severity: 'critical',
        category: 'schema-mismatch',
        engineId: 'kernel',
        description: 'kernel_spans table query failed',
        evidence: [String(err)],
        suggestedFix: 'Run prisma migration for kernel tables (0.5)',
        autoFixable: false,
        detectedAt: Date.now(),
      })
    }
    return issues
  }

  async checkConfig(): Promise<DiagnosticIssue[]> {
    const issues: DiagnosticIssue[] = []
    for (const engine of this.registry.listEngines()) {
      const required = (engine.metadata?.requiredConfig as string[] | undefined) ?? []
      for (const key of required) {
        if (engine.config[key] === undefined) {
          issues.push({
            id: `config:${engine.id}:${key}`,
            severity: 'warning',
            category: 'config-missing',
            engineId: engine.id,
            description: `Engine ${engine.id} missing required config "${key}"`,
            evidence: [`requiredConfig: ${JSON.stringify(required)}`],
            suggestedFix: `Provide config "${key}" via ConfigManager`,
            autoFixable: true,
            detectedAt: Date.now(),
          })
        }
      }
    }
    return issues
  }
}

// Re-export to keep id generation available to actuator consumers if needed.
export function newDiagnosticId(): string {
  return ulid()
}
