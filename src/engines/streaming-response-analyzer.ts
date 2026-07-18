// src/engines/streaming-response-analyzer.ts
// StreamingResponseAnalyzer — infers the streaming transport + delta schema from a
// captured raw response body and generates a `logic_code` parser matching the seed
// parser contract (chatgpt/001_openai_sse style: `parse`, `detectCompletion`,
// `getConfidence`). CDP-agnostic: takes a raw captured body, not a live browser.
// Capture itself stays in ProtocolDiscoveryEngine (Governor Canon preserved).

export type StreamTransport = 'sse' | 'websocket' | 'polling' | 'unknown'

export interface StreamAnalysis {
  transport: StreamTransport
  eventName?: string
  dataPath: string
  sampleDelta: unknown
  confidence: number
  logicCode: string
}

export interface AnalyzerOptions {
  /** Fail threshold; analysis with confidence below this is considered unusable. */
  minConfidence?: number
}

function classifyTransport(body: string): { transport: StreamTransport; eventName?: string } {
  const trimmed = body.trim()
  if (!trimmed) return { transport: 'unknown' }
  // SSE: lines like `event: delta` / `data: {...}`
  if (
    /^(event|data):/m.test(trimmed) ||
    trimmed.includes('\ndata:') ||
    trimmed.startsWith('data: ')
  ) {
    const eventMatch = /^event:\s*(\S+)/m.exec(trimmed)
    return { transport: 'sse', eventName: eventMatch?.[1] }
  }
  // WebSocket frames are often bare JSON objects without HTTP framing
  if (/^\{[\s\S]*\}$/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return { transport: 'websocket' }
    } catch {
      // fall through
    }
  }
  // JSON-lines polling
  const lines = trimmed.split('\n').filter(Boolean)
  if (lines.length > 1) {
    let allJson = true
    for (const l of lines.slice(0, 5)) {
      try {
        JSON.parse(l)
      } catch {
        allJson = false
        break
      }
    }
    if (allJson) return { transport: 'polling' }
  }
  return { transport: 'unknown' }
}

function extractJsonRecords(body: string): Json[] {
  const trimmed = body.trim()
  const records: Json[] = []
  // SSE: parse `data: {json}` lines, stop at [DONE]
  const sseLines = trimmed.split('\n')
  let sawSse = false
  for (const line of sseLines) {
    const m = /^data:\s*(.*)$/.exec(line)
    if (!m) continue
    sawSse = true
    const payload = m[1]?.trim()
    if (payload === '[DONE]') break
    if (!payload) continue
    try {
      records.push(JSON.parse(payload))
    } catch {
      /* ignore non-json */
    }
  }
  if (sawSse && records.length > 0) return records
  // Bare JSON
  try {
    records.push(JSON.parse(trimmed))
  } catch {
    /* ignore */
  }
  // JSON-lines
  if (records.length === 0) {
    for (const l of sseLines) {
      const t = l.trim()
      if (!t) continue
      try {
        records.push(JSON.parse(t))
      } catch {
        /* ignore */
      }
    }
  }
  return records
}

/**
 * Locate the most likely delta content path by walking records. Returns a JS
 * accessor expression like `choices[0].delta.content` and a sample value.
 */
type Json = Record<string, unknown> | unknown[]

function dig(record: unknown, path: string): unknown {
  const segments = path.split('.')
  let cur: unknown = record
  for (const seg of segments) {
    const idxMatch = /^(\w+)\[(\d+)\]$/.exec(seg)
    if (idxMatch) {
      const arr = cur as unknown[]
      const el = arr?.[Number(idxMatch[2])]
      if (el === undefined) return undefined
      cur = el
    } else {
      const obj = cur as Record<string, unknown> | undefined
      const el = obj?.[seg]
      if (el === undefined) return undefined
      cur = el
    }
  }
  return cur
}

function inferDataPath(records: Json[]): { path: string; sample: unknown } {
  // Candidate locations to check, common across LLM providers.
  const candidates: Array<{ path: string; get: (r: Json) => unknown }> = [
    { path: 'choices[0].delta.content', get: (r) => dig(r, 'choices[0].delta.content') },
    { path: 'choices[0].message.content', get: (r) => dig(r, 'choices[0].message.content') },
    { path: 'choices[0].text', get: (r) => dig(r, 'choices[0].text') },
    { path: 'delta.content', get: (r) => dig(r, 'delta.content') },
    { path: 'content', get: (r) => dig(r, 'content') },
    { path: 'text', get: (r) => dig(r, 'text') },
    { path: 'output', get: (r) => dig(r, 'output') },
  ]
  for (const c of candidates) {
    const found = records.map(c.get).find((v) => typeof v === 'string' && v.length > 0)
    if (found != null) return { path: c.path, sample: found }
  }
  return { path: 'content', sample: '' }
}

function jsAccessor(path: string): string {
  // choices[0].delta.content -> r.choices && r.choices[0] && r.choices[0].delta && r.choices[0].delta.content
  const parts = path.split('.')
  let expr = 'r'
  const steps: string[] = []
  for (const p of parts) {
    const idx = /^(\w+)\[(\d+)\]$/.exec(p)
    if (idx) {
      expr += ` && ${expr}.${idx[1]} && ${expr}.${idx[1]}[${idx[2]}]`
      steps.push(`${expr}.${idx[1]}[${idx[2]}]`)
    } else {
      expr += ` && ${expr}.${p}`
      steps.push(`${expr}.${p}`)
    }
  }
  return steps.join(' && ') || 'r'
}

/**
 * Generate `logic_code` JS matching the seed parser contract. The generated code
 * exposes `var parse`, `var detectCompletion`, `var getConfidence` and assigns
 * `exports.default`.
 */
function generateLogicCode(opts: {
  dataPath: string
  transport: StreamTransport
  eventName?: string
}): string {
  const accessor = jsAccessor(opts.dataPath)
  const parseBody =
    opts.transport === 'sse'
      ? `var blocks = []; var index = 0; var lines = rawBody.split('\\n'); for (var i = 0; i < lines.length; i++) { var trimmed = lines[i].trim(); if (!trimmed.startsWith('data:')) continue; var payload = trimmed.slice(5).trim(); if (payload === '[DONE]') break; try { var json = JSON.parse(payload); var val = ${accessor}; if (typeof val === 'string' && val.length > 0) { var lastBlock = blocks[blocks.length - 1]; if (lastBlock && lastBlock.kind === 'text') { lastBlock.content += val; } else { blocks.push({ kind: 'text', content: val, index: index++ }); } } } catch (e) { void e; } } if (blocks.length === 0 && rawBody.trim().length > 0) { blocks.push({ kind: 'text', content: rawBody, index: 0 }); } return blocks;`
      : `var blocks = []; var index = 0; var records = []; try { var lines = rawBody.split('\\n').filter(Boolean); for (var i = 0; i < lines.length; i++) { try { records.push(JSON.parse(lines[i])); } catch (e) { void e; } } if (records.length === 0) records.push(JSON.parse(rawBody)); } catch (e) { records = []; } for (var j = 0; j < records.length; j++) { var val = ${accessor}; if (typeof val === 'string' && val.length > 0) { var lastBlock = blocks[blocks.length - 1]; if (lastBlock && lastBlock.kind === 'text') { lastBlock.content += val; } else { blocks.push({ kind: 'text', content: val, index: index++ }); } } } if (blocks.length === 0 && rawBody.trim().length > 0) { blocks.push({ kind: 'text', content: rawBody, index: 0 }); } return blocks;`

  const detectCompletion =
    opts.transport === 'sse'
      ? `return rawBody.indexOf('[DONE]') !== -1 || /"finish_reason"\\s*:\\s*"(stop|length)"/.test(rawBody);`
      : `return /"finish_reason"\\s*:\\s*"(stop|length)"/.test(rawBody) || /"done"\\s*:\\s*true/.test(rawBody);`

  const getConfidence =
    opts.transport === 'sse'
      ? `var hasDone = rawBody.indexOf('[DONE]') !== -1; var hasDelta = rawBody.indexOf('choices') !== -1 && rawBody.indexOf('delta') !== -1; if (hasDone) return 1; if (hasDelta) return 0.7; return 0;`
      : `return rawBody.indexOf('"finish_reason"') !== -1 ? 0.8 : 0.4;`

  return `var parse = function(rawBody) { ${parseBody} }; var detectCompletion = function(rawBody) { ${detectCompletion} }; var getConfidence = function(rawBody) { ${getConfidence} }; exports.default = { name: 'inferred/${opts.transport}', version: 1, providerId: 'inferred', parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };`
}

export class StreamingResponseAnalyzer {
  constructor(private minConfidence = 0.7) {}

  /** Run analysis over a captured raw body. */
  analyze(rawBody: string): StreamAnalysis {
    const { transport, eventName } = classifyTransport(rawBody)
    if (transport === 'unknown') {
      return {
        transport: 'unknown',
        dataPath: '',
        sampleDelta: '',
        confidence: 0,
        logicCode: '',
      }
    }

    const records = extractJsonRecords(rawBody)
    if (records.length === 0) {
      return { transport, eventName, dataPath: '', sampleDelta: '', confidence: 0.1, logicCode: '' }
    }

    const { path, sample } = inferDataPath(records)
    let confidence = 0.5
    if (transport === 'sse' && rawBody.includes('[DONE]')) confidence = 0.9
    else if (transport === 'sse') confidence = 0.7
    else if (transport === 'websocket' || transport === 'polling') confidence = 0.6
    if (typeof sample === 'string' && sample.length > 0) confidence = Math.min(1, confidence + 0.1)

    const logicCode = generateLogicCode({ dataPath: path, transport, eventName })
    return { transport, eventName, dataPath: path, sampleDelta: sample, confidence, logicCode }
  }
}
