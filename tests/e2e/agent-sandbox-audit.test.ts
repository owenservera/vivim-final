// tests/e2e/agent-sandbox-audit.test.ts
// AGENT4 — Sandbox audit harness for the OpenCode local-agent integration.
//
// Drives `cap:agent:run` (AGENT1's spec-022 surface) for the two verified Zen
// free models:
//   - opencode/hy3-free
//   - opencode/deepseek-v4-flash-free
//
// Two modes:
//   OFFLINE (default): validates the NDJSON parser contract + mocked execute
//     path without touching the opencode CLI or the network.
//   LIVE (AGENT4_LIVE=1): hits the running server's universal execute route
//     POST /api/capabilities/cap:agent:run/execute for each model, captures
//     latency/ok/permissionDenied/sessionId/tokens, and emits an audit report.
//
// NOTE: this test OWNS no production code. It only exercises cap:agent:run
// (registered by AGENT1) and the exported parseOpencodeJson parser. It never
// re-registers the capability or edits the executor.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseOpencodeJson } from '../../src/engines/local-agent/local-agent-executor.js'

const BASE = `http://127.0.0.1:${process.env.CAP_STORE_PORT ?? 9420}`
const LIVE = process.env.AGENT4_LIVE === '1'
const MODELS = ['opencode/hy3-free', 'opencode/deepseek-v4-flash-free'] as const

const PROMPTS = ['Reply with exactly: PONG', 'What is 2+2? Answer with just the number.'] as const

const audit: Array<{
  model: string
  prompt: string
  mode: 'live' | 'offline'
  ok: boolean
  latencyMs?: number
  exitCode?: number
  permissionDenied?: boolean
  blockCount?: number
  textBlocks?: number
  toolCalls?: number
  sessionId?: string
  tokens?: unknown
  error?: string
}> = []

async function fetchJson(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(200_000),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// ── Verified NDJSON fixtures (opencode v1.17.15 grammar) ────────────────────
function ndjsonFixture(opts: {
  text: string
  sessionID: string
  withReasoning?: boolean
  withTool?: boolean
  withPermissionDenied?: boolean
}): string {
  const lines: unknown[] = [
    {
      type: 'step_start',
      sessionID: opts.sessionID,
      part: { type: 'step-start', sessionID: opts.sessionID },
    },
  ]
  if (opts.withReasoning) {
    lines.push({
      type: 'reasoning',
      part: { type: 'reasoning', text: 'thinking…', sessionID: opts.sessionID },
    })
  }
  if (opts.withTool) {
    lines.push({
      type: 'tool_use',
      part: {
        type: 'tool',
        tool: 'bash',
        callID: 'call_1',
        state: { status: 'completed', input: { cmd: 'ls' }, output: 'file.txt' },
        sessionID: opts.sessionID,
      },
    })
  }
  if (opts.withPermissionDenied) {
    // Verified silent denial: tool_use with tool:'invalid', exit still 0
    lines.push({
      type: 'tool_use',
      part: {
        type: 'tool',
        tool: 'invalid',
        callID: 'call_x',
        state: { status: 'completed', output: 'gated' },
        sessionID: opts.sessionID,
      },
    })
  }
  lines.push({ type: 'text', part: { type: 'text', text: opts.text, sessionID: opts.sessionID } })
  lines.push({
    type: 'step_finish',
    part: {
      type: 'step-finish',
      reason: 'stop',
      cost: 0.0001,
      tokens: { input: 12, output: 4, reasoning: 2, cache: { read: 1, write: 0 } },
      sessionID: opts.sessionID,
    },
  })
  return lines.map((l) => JSON.stringify(l)).join('\n')
}

describe('AGENT4 — agent-sandbox-audit (offline parser contract)', () => {
  it('parses a plain text response into a single text block', () => {
    const raw = ndjsonFixture({ text: 'PONG', sessionID: 'sess_abc' })
    const { blocks, sessionId, tokens } = parseOpencodeJson(raw)
    expect(sessionId).toBe('sess_abc')
    expect(
      blocks
        .filter((b) => b.type === 'text')
        .map((b: any) => b.text)
        .join(''),
    ).toContain('PONG')
    expect(tokens.input).toBe(12)
    expect(tokens.output).toBe(4)
  })

  it('parses reasoning + tool-call + tool-result blocks', () => {
    const raw = ndjsonFixture({
      text: 'done',
      sessionID: 'sess_2',
      withReasoning: true,
      withTool: true,
    })
    const { blocks } = parseOpencodeJson(raw)
    const types = blocks.map((b) => b.type)
    expect(types).toContain('reasoning')
    expect(types).toContain('tool-call')
    expect(types).toContain('tool-result')
    expect(types).toContain('text')
  })

  it('flags silent permission denial as PERMISSION_DENIED error block', () => {
    const raw = ndjsonFixture({ text: 'x', sessionID: 'sess_3', withPermissionDenied: true })
    const { permissionDenied, blocks } = parseOpencodeJson(raw)
    expect(permissionDenied).toBe(true)
    const err = blocks.find((b) => b.type === 'error')
    expect(err).toBeDefined()
    expect((err as any).code).toBe('PERMISSION_DENIED')
  })

  it('tolerates malformed lines without throwing', () => {
    const raw = `not-json\n${ndjsonFixture({ text: 'ok', sessionID: 'sess_4' })}\n\n`
    expect(() => parseOpencodeJson(raw)).not.toThrow()
    const { blocks } = parseOpencodeJson(raw)
    expect(blocks.some((b) => b.type === 'text')).toBe(true)
  })

  it('captures sessionID from a resume-style stream', () => {
    const raw = ndjsonFixture({ text: 'continued', sessionID: 'sess_resume_9' })
    const { sessionId } = parseOpencodeJson(raw)
    expect(sessionId).toBe('sess_resume_9')
  })
})

describe('AGENT4 — agent-sandbox-audit (live cap:agent:run)', () => {
  beforeAll(async () => {
    if (!LIVE) return
    // Confirm server reachable before live calls
    const { status } = await fetchJson('/health')
    expect([200, 503]).toContain(status)
  })

  if (!LIVE) {
    it.skip('LIVE mode disabled — set AGENT4_LIVE=1 to exercise real model calls', () => {})
  }

  for (const model of MODELS) {
    for (const prompt of PROMPTS) {
      it(`[${model}] "${prompt}"`, async () => {
        if (!LIVE) return
        const start = Date.now()
        const { status, body } = await fetchJson('/api/capabilities/cap:agent:run/execute', {
          method: 'POST',
          body: JSON.stringify({ input: { prompt, model } }),
        })
        const latencyMs = Date.now() - start
        const ok = status === 200 && body?.ok === true
        const blocks: any[] = Array.isArray(body?.blocks) ? body.blocks : []
        audit.push({
          model,
          prompt,
          mode: 'live',
          ok,
          latencyMs,
          exitCode: body?.exitCode,
          permissionDenied: body?.permissionDenied,
          blockCount: blocks.length,
          textBlocks: blocks.filter((b) => b.type === 'text').length,
          toolCalls: blocks.filter((b) => b.type === 'tool-call').length,
          sessionId: body?.sessionId,
          tokens: body?.tokens,
          error: body?.error ?? (status !== 200 ? `http ${status}` : undefined),
        })
        // Do not hard-fail the suite on live model variance; record + assert shape.
        expect(status).toBe(200)
        expect(body).toHaveProperty('ok')
        expect(body).toHaveProperty('blocks')
      }, 200_000)
    }
  }
})

afterAll(() => {
  if (audit.length === 0) return
  const dir = mkdtempSync(join(tmpdir(), 'agent4-audit-'))
  const file = join(dir, 'report.json')
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: 'live',
    models: MODELS,
    totalRuns: audit.length,
    okRuns: audit.filter((a) => a.ok).length,
    permissionDenied: audit.filter((a) => a.permissionDenied).length,
    latenciesMs: audit.map((a) => a.latencyMs ?? 0),
    runs: audit,
  }
  writeFileSync(file, JSON.stringify(summary, null, 2))
  // eslint-disable-next-line no-console
  console.log(`\n[AGENT4 AUDIT] report -> ${file}`)
  console.log(
    `[AGENT4 AUDIT] ok=${summary.okRuns}/${summary.totalRuns} pd=${summary.permissionDenied}`,
  )
  console.log(
    `[AGENT4 AUDIT] p50=${
      [...summary.latenciesMs].sort((a, b) => a - b)[Math.floor(summary.latenciesMs.length / 2)] ??
      0
    }ms max=${Math.max(0, ...summary.latenciesMs)}ms`,
  )
  // keep the file for inspection; uncomment to auto-clean: rmSync(dir, { recursive: true, force: true })
})
