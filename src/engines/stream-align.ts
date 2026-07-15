// src/engines/stream-align.ts
// StreamAlignmentEngine — Phase 23.1
// Aligns a *captured* provider stream against the DB-driven StreamParserEngine.
// Answers: does the parser we have actually parse what the provider streams?
// Infers the real wire format, detects the response delta path, validates a
// configured delta path (unit 2.16), and autocomputes parser hashes (unit 2.15).

import { createHash } from 'node:crypto'
import { EngineError } from '../errors.js'
import type { StreamParserEngine } from './stream-parser.js'

export type StreamFormat = 'sse' | 'json' | 'html' | 'websocket' | 'custom'

export interface AlignmentReport {
  providerId: string
  sampleCount: number
  parserName: string | null
  parserConfiguredFormat: StreamFormat | null
  inferredFormat: StreamFormat
  confidence: number
  blockCount: number
  textBlocks: number
  detectedDeltaPath: string | null
  streamFieldCandidates: string[]
  mismatches: string[]
  suggestions: string[]
  ok: boolean
}

export interface DeltaPathValidation {
  valid: boolean
  resolvedValue: unknown
  error?: string
}

// Candidate response delta paths, most common first.
const DELTA_PATH_CANDIDATES = [
  'choices[0].delta.content',
  'choices[0].message.content',
  'choices[0].text',
  'delta.content',
  'message.content',
  'content',
  'text',
  'data.content',
  'data.text',
  'outputs[0].text',
  'response',
]

function getAtPath(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const token of path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const idx = Number(token)
      cur = Number.isNaN(idx) ? undefined : cur[idx]
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[token]
    } else {
      return undefined
    }
  }
  return cur
}

export class StreamAlignmentEngine {
  constructor(private readonly streamParser: StreamParserEngine) {}

  /**
   * Align a set of captured raw stream bodies against the active parser for
   * `providerId`. Produces a report the CLI can print and the discovery runner
   * can persist.
   */
  async alignCaptured(
    bodies: string[],
    providerId: string,
    configuredFormat?: StreamFormat | null,
  ): Promise<AlignmentReport> {
    const samples = bodies.filter((b) => b && b.trim().length > 0)
    if (samples.length === 0) {
      return {
        providerId,
        sampleCount: 0,
        parserName: null,
        parserConfiguredFormat: configuredFormat ?? null,
        inferredFormat: 'custom',
        confidence: 0,
        blockCount: 0,
        textBlocks: 0,
        detectedDeltaPath: null,
        streamFieldCandidates: [],
        mismatches: [
          'No stream body was captured — interaction may not have triggered a response.',
        ],
        suggestions: [
          'Verify the composer selector and send action; increase the capture timeout.',
        ],
        ok: false,
      }
    }

    let parserName: string | null = null
    let totalConfidence = 0
    let blockCount = 0
    let textBlocks = 0

    for (const body of samples) {
      const result = await this.streamParser.parse(body, providerId)
      parserName ??= result.parserName
      totalConfidence += result.confidence
      blockCount += result.blocks.length
      for (const b of result.blocks) {
        if (b.kind === 'text' || b.kind === 'code' || b.kind === 'thinking') textBlocks++
      }
    }

    const inferredFormat = samples[0] ? this.inferFormat(samples[0]) : 'custom'
    const jsonSample = samples[0] ? this.extractJsonSample(samples[0]) : null
    const { path: detectedDeltaPath, candidates: streamFieldCandidates } =
      this.detectDeltaPath(jsonSample)

    const mismatches: string[] = []
    const suggestions: string[] = []

    if (configuredFormat && configuredFormat !== inferredFormat) {
      mismatches.push(
        `Configured format '${configuredFormat}' does not match inferred wire format '${inferredFormat}'.`,
      )
      suggestions.push(
        `Set ProviderStreamConfig.streamTransport to '${inferredFormat}' (or update the parser).`,
      )
    }

    if (textBlocks === 0) {
      mismatches.push('Parser produced zero text/code blocks from the captured stream.')
      suggestions.push(
        detectedDeltaPath
          ? `Wire the parser to deltaPath '${detectedDeltaPath}'.`
          : 'No delta path detected — verify the provider uses SSE/JSON delta streaming.',
      )
    }

    if (inferredFormat !== 'html' && !detectedDeltaPath) {
      mismatches.push('Could not locate a response delta path in the captured JSON.')
      suggestions.push(
        'Inspect the captured body and set an explicit deltaPath in ProviderStreamConfig.',
      )
    }

    return {
      providerId,
      sampleCount: samples.length,
      parserName,
      parserConfiguredFormat: configuredFormat ?? null,
      inferredFormat,
      confidence: totalConfidence / samples.length,
      blockCount,
      textBlocks,
      detectedDeltaPath,
      streamFieldCandidates,
      mismatches,
      suggestions,
      ok: mismatches.length === 0,
    }
  }

  /** Infer the wire format of a raw captured body. */
  inferFormat(body: string): StreamFormat {
    const trimmed = body.trim()
    if (/^(data:\s*)/m.test(trimmed) || /^data:\s*\[DONE\]/m.test(trimmed)) return 'sse'
    if (/event:\s*\w+/m.test(trimmed) && /data:/m.test(trimmed)) return 'sse'
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch {
        /* fall through */
      }
    }
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return 'html'
    return 'custom'
  }

  /**
   * Detect the response delta path from a JSON sample. Tries the well-known
   * candidates and returns the first that resolves to a non-empty string, plus
   * every candidate that resolves at all (for suggestions).
   */
  detectDeltaPath(jsonSample: string | null): { path: string | null; candidates: string[] } {
    if (!jsonSample) return { path: null, candidates: [] }
    let root: unknown
    try {
      root = JSON.parse(jsonSample)
    } catch {
      return { path: null, candidates: [] }
    }

    const candidates: string[] = []
    for (const candidate of DELTA_PATH_CANDIDATES) {
      const value = getAtPath(root, candidate)
      if (typeof value === 'string' && value.length > 0) {
        candidates.push(candidate)
      }
    }
    return { path: candidates[0] ?? null, candidates }
  }

  /**
   * Unit 2.16 — validate that a configured delta path resolves against a sample
   * of the provider's streamed JSON.
   */
  validateDeltaPath(deltaPath: string, sampleJson: string): DeltaPathValidation {
    let root: unknown
    try {
      root = JSON.parse(sampleJson)
    } catch (err) {
      return {
        valid: false,
        resolvedValue: undefined,
        error: `Sample is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    const value = getAtPath(root, deltaPath)
    if (value === undefined) {
      return {
        valid: false,
        resolvedValue: undefined,
        error: `Path '${deltaPath}' did not resolve.`,
      }
    }
    if (typeof value === 'string' && value.length === 0) {
      return {
        valid: false,
        resolvedValue: value,
        error: `Path '${deltaPath}' resolved to an empty string.`,
      }
    }
    return { valid: true, resolvedValue: value }
  }

  /**
   * Unit 2.15 — deterministic content hash for a parser's source/logic. Used to
   * autocompute `provider_parser.parser_hash` so the StreamParserEngine cache and
   * the registrar stay in sync without manual hashes.
   */
  computeParserHash(source: string): string {
    if (!source) throw new EngineError('computeParserHash: source must be non-empty')
    return createHash('sha256').update(source).digest('hex')
  }

  // ── Standalone helper (for import by registrar) ────────────────────────
  static computeParserHash(source: string): string {
    if (!source) throw new EngineError('computeParserHash: source must be non-empty')
    return createHash('sha256').update(source).digest('hex')
  }

  // ── private ─────────────────────────────────────────────────────────────

  private extractJsonSample(body: string): string | null {
    const format = this.inferFormat(body)
    if (format === 'json') return body.trim()
    if (format === 'sse') {
      // Grab the first `data:` line that is valid JSON (skip [DONE]).
      for (const line of body.split('\n')) {
        const m = line.match(/^data:\s*(.*)$/)
        const payload = m?.[1]?.trim()
        if (!payload || payload === '[DONE]') continue
        try {
          JSON.parse(payload)
          return payload
        } catch {
          /* try next line */
        }
      }
    }
    return null
  }
}
