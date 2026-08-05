// src/engines/telemetry-audit.ts
// TelemetryAudit — zero-cloud proof: record every outbound network call and generate audit reports.
// Proves that only user-configured AI provider endpoints are contacted — no telemetry, no analytics, no third-party tracking.

// ── Types ───────────────────────────────────────────────────────────────

import { EngineError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'

export interface NetworkCallRecord {
  id: string
  timestamp: number
  method: string
  url: string
  initiator: string // engine or module that made the call
  responseStatus: number | null
  durationMs: number
  isToAiProvider: boolean
}

export interface AuditReport {
  generatedAt: number
  periodFrom: number
  periodTo: number
  totalOutboundCalls: number
  callsToAiProviders: number
  callsToOther: number
  nonProviderCalls: Array<{ url: string; count: number; initiator: string }>
  verdict: 'clean' | 'suspicious' | 'violating'
  details: string[]
}

const MAX_RECORDS = 10_000

// ── Engine ──────────────────────────────────────────────────────────────

export class TelemetryAudit {
  private records: NetworkCallRecord[] = []
  private providerDomains: string[]
  private consentMode: boolean

  constructor(providerUrls: string[], consentMode = false) {
    this.providerDomains = providerUrls.map((url) => {
      try {
        return new URL(url).hostname
      } catch (e) {
        catchDebug(e, 'telemetry-audit: URL parse failed')
        return url
      }
    })
    this.consentMode = consentMode
  }

  /** Consent-gated fetch. Blocks non-consented hosts when consentMode is true. */
  async fetch(
    url: string,
    init: RequestInit,
    initiator = 'live-capability-http',
  ): Promise<Response> {
    if (this.consentMode) {
      const hostname = this.extractHostname(url)
      const isConsented = this.providerDomains.some((d) => hostname.includes(d))
      if (!isConsented) {
        throw new EngineError(`Host not consented: ${hostname}`)
      }
    }
    const start = Date.now()
    const res = await globalThis.fetch(url, init)
    this.recordCall({
      timestamp: Date.now(),
      method: init.method ?? 'GET',
      url,
      initiator,
      responseStatus: res.status,
      durationMs: Date.now() - start,
    })
    return res
  }

  recordCall(record: Omit<NetworkCallRecord, 'id' | 'isToAiProvider'>): void {
    const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const hostname = this.extractHostname(record.url)
    const isToAiProvider = this.providerDomains.some((d) => hostname.includes(d))

    this.records.push({ ...record, id, isToAiProvider })

    // Ring buffer — drop oldest when full
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS)
    }
  }

  generateReport(from: number, to: number): AuditReport {
    const filtered = this.records.filter((r) => r.timestamp >= from && r.timestamp <= to)
    const aiProviderCalls = filtered.filter((r) => r.isToAiProvider)
    const otherCalls = filtered.filter((r) => !r.isToAiProvider)

    // Group non-provider calls by normalized URL + initiator
    const grouped = new Map<string, { url: string; count: number; initiator: string }>()
    for (const call of otherCalls) {
      const normalizedUrl = this.normalizeUrl(call.url)
      const key = `${normalizedUrl}::${call.initiator}`
      const existing = grouped.get(key)
      if (existing) {
        existing.count++
      } else {
        grouped.set(key, { url: normalizedUrl, count: 1, initiator: call.initiator })
      }
    }

    const nonProviderCalls = Array.from(grouped.values())

    let verdict: AuditReport['verdict'] = 'clean'
    if (otherCalls.length > 10) {
      verdict = 'violating'
    } else if (otherCalls.length > 0) {
      verdict = 'suspicious'
    }

    const details: string[] = []
    if (verdict === 'clean') {
      details.push('All outbound calls are to configured AI providers')
    } else {
      details.push(`${otherCalls.length} non-provider outbound call(s) detected`)
      for (const entry of nonProviderCalls) {
        details.push(`  ${entry.url} (${entry.initiator}) × ${entry.count}`)
      }
    }

    return {
      generatedAt: Date.now(),
      periodFrom: from,
      periodTo: to,
      totalOutboundCalls: filtered.length,
      callsToAiProviders: aiProviderCalls.length,
      callsToOther: otherCalls.length,
      nonProviderCalls,
      verdict,
      details,
    }
  }

  getCalls(from?: number, to?: number): NetworkCallRecord[] {
    return this.records.filter((r) => {
      if (from !== undefined && r.timestamp < from) return false
      if (to !== undefined && r.timestamp > to) return false
      return true
    })
  }

  clear(): void {
    this.records = []
  }

  private extractHostname(url: string): string {
    try {
      return new URL(url).hostname
    } catch (e) {
      catchDebug(e, 'telemetry-audit: extractHost failed')
      return url
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`
    } catch (e) {
      catchDebug(e, 'telemetry-audit: normalizeUrl failed')
      return url
    }
  }
}
