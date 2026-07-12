// tests/unit/engines/telemetry-audit.test.ts
// TelemetryAudit — zero-cloud proof tests

import { beforeEach, describe, expect, test } from 'bun:test'
import { TelemetryAudit } from '../../../src/engines/telemetry-audit.js'

describe('TelemetryAudit', () => {
  let audit: TelemetryAudit

  beforeEach(() => {
    audit = new TelemetryAudit(['https://api.openai.com', 'https://api.anthropic.com'])
    audit.clear()
  })

  test('recordCall stores call with auto-classified provider flag', () => {
    audit.recordCall({
      timestamp: Date.now(),
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      initiator: 'CapabilityEngine',
      responseStatus: 200,
      durationMs: 150,
      isToAiProvider: false, // will be overridden
    })
    const calls = audit.getCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.isToAiProvider).toBe(true)
  })

  test('generateReport returns clean verdict with zero non-provider calls', () => {
    const now = Date.now()
    audit.recordCall({
      timestamp: now,
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      initiator: 'CapabilityEngine',
      responseStatus: 200,
      durationMs: 100,
      isToAiProvider: false,
    })
    const report = audit.generateReport(now - 1000, now + 1000)
    expect(report.verdict).toBe('clean')
    expect(report.callsToAiProviders).toBe(1)
    expect(report.callsToOther).toBe(0)
    expect(report.nonProviderCalls).toHaveLength(0)
  })

  test('generateReport returns suspicious with non-provider URLs', () => {
    const now = Date.now()
    audit.recordCall({
      timestamp: now,
      method: 'GET',
      url: 'https://analytics.example.com/track',
      initiator: 'TelemetryModule',
      responseStatus: 200,
      durationMs: 50,
      isToAiProvider: false,
    })
    const report = audit.generateReport(now - 1000, now + 1000)
    expect(report.verdict).toBe('suspicious')
    expect(report.callsToOther).toBe(1)
    expect(report.nonProviderCalls).toHaveLength(1)
    expect(report.nonProviderCalls[0]!.url).toContain('analytics.example.com')
  })

  test('generateReport returns violating with >10 non-provider calls', () => {
    const now = Date.now()
    for (let i = 0; i < 15; i++) {
      audit.recordCall({
        timestamp: now + i,
        method: 'GET',
        url: `https://tracker${i}.example.com/pixel`,
        initiator: 'Tracker',
        responseStatus: 200,
        durationMs: 10,
        isToAiProvider: false,
      })
    }
    const report = audit.generateReport(now - 1000, now + 10000)
    expect(report.verdict).toBe('violating')
    expect(report.callsToOther).toBe(15)
  })

  test('URL normalization strips paths and query strings', () => {
    const now = Date.now()
    audit.recordCall({
      timestamp: now,
      method: 'GET',
      url: 'https://cdn.example.com/assets/logo.png?v=2',
      initiator: 'UI',
      responseStatus: 200,
      durationMs: 30,
      isToAiProvider: false,
    })
    const report = audit.generateReport(now - 1000, now + 1000)
    expect(report.nonProviderCalls[0]!.url).toBe('https://cdn.example.com')
  })

  test('time range filtering works correctly', () => {
    const now = Date.now()
    audit.recordCall({
      timestamp: now - 5000,
      method: 'GET',
      url: 'https://old.example.com/data',
      initiator: 'Old',
      responseStatus: 200,
      durationMs: 10,
      isToAiProvider: false,
    })
    audit.recordCall({
      timestamp: now,
      method: 'GET',
      url: 'https://new.example.com/data',
      initiator: 'New',
      responseStatus: 200,
      durationMs: 10,
      isToAiProvider: false,
    })
    const report = audit.generateReport(now - 1000, now + 1000)
    expect(report.totalOutboundCalls).toBe(1)
    expect(report.nonProviderCalls[0]!.url).toContain('new.example.com')
  })

  test('empty period returns clean report with zero counts', () => {
    const report = audit.generateReport(0, 1000)
    expect(report.verdict).toBe('clean')
    expect(report.totalOutboundCalls).toBe(0)
    expect(report.callsToAiProviders).toBe(0)
    expect(report.callsToOther).toBe(0)
  })

  test('clear removes all records', () => {
    audit.recordCall({
      timestamp: Date.now(),
      method: 'POST',
      url: 'https://api.openai.com/v1/test',
      initiator: 'Test',
      responseStatus: 200,
      durationMs: 10,
      isToAiProvider: false,
    })
    expect(audit.getCalls()).toHaveLength(1)
    audit.clear()
    expect(audit.getCalls()).toHaveLength(0)
  })

  test('AI provider URL detection matches configured domains', () => {
    const now = Date.now()
    audit.recordCall({
      timestamp: now,
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      initiator: 'ClaudeEngine',
      responseStatus: 200,
      durationMs: 200,
      isToAiProvider: false,
    })
    const calls = audit.getCalls()
    expect(calls[0]!.isToAiProvider).toBe(true)
  })
})
