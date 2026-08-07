// src/engines/onboarding/parser-synthesis-engine.ts
// Stage 5 — Structural Parser Induction (SPI).
// See FINAL-UPGRADE-PLAN-V2.md §7 (Tier F) for design rationale.
//
// Audit-aware upgrades baked in (V2):
//  - ❌-3 (source): takes a real `protocolFingerprintId` (was `sessionId`
//    "simplified 1:1 for illustration" which would violate the FK constraint).
//  - ❌-4 (source): dead ternary removed; intermediate `high_confidence_prospect`
//    vs `low_confidence_prospect` status so the gate knows which to prioritize.
//  - 🚀-5 protocol-aware unwrap: routes raw samples through `unwrapPayload`
//    before `tryParseAll`, so SSE/WebSocket/chunked payloads are properly
//    extracted instead of being treated as raw strings.
//
// Tier F (V2) additions — close P-2..P-6:
//  - P-2: canonical JSON in detectFraming (sorts object keys before stringify).
//  - P-3: content-key allowlist for inferRole (text/content/body/message/etc).
//  - P-4: required vs optional field detection (presence >= 0.8).
//  - P-5: array element shape induction (recursive fieldMap for array items).
//  - P-6: better scoring — key presence + type stability + role inference.
//
// P-1 (parser_program emit) is closed by writing to ProviderParser in the
// orchestrator's Stage 7 (see provider-onboarding-orchestrator.ts Tier C).

import { ulid } from 'ulid'
import type { ParserCandidateStoreContract } from '../../storage/contracts/onboarding/parser-candidate-store.js'
import { unwrapPayload } from './protocol-sniffer.js'
import type { InducedShape, TransportClass } from './types.js'

/**
 * Tier F P-3 — content-bearing key allowlist. These keys unambiguously map to
 * the `content_delta` role. Without this, inferRole would fall through to
 * 'opaque' for `text` / `content` / `message` / `delta` fields (the actual
 * content-bearing fields!) because they don't match the regex table and may
 * not pass the monotonic-string check (e.g. delta="" → "hello" → "hello world"
 * has the first sample empty, breaking monotonicity).
 */
const CONTENT_KEYS = new Set([
  'text',
  'content',
  'body',
  'message',
  'delta',
  'chunk',
  'data',
  'value',
  'payload',
  'response',
  'answer',
  'reply',
  'output',
  'completion',
  'generated_text',
  'text_delta',
  'content_delta',
  'message_delta',
])

export class ParserSynthesisEngine {
  constructor(private readonly candidateStore: ParserCandidateStoreContract) {}

  /**
   * @param protocolFingerprintId Real ProtocolFingerprint.id (audit ❌-3 fix —
   *   the source MD passed `sessionId` here, which would violate the FK
   *   constraint at insert time).
   */
  async synthesize(
    sessionId: string,
    protocolFingerprintId: string | null,
    transportClass: TransportClass,
    rawSamples: string[],
  ): Promise<InducedShape | null> {
    // 🚀-5 protocol-aware unwrap — strip SSE/WS/chunked framing before parsing.
    const unwrapped = rawSamples.flatMap((s) => unwrapPayload(transportClass, s))
    const parsed = unwrapped.filter((v) => v !== null && v !== undefined)
    if (parsed.length < 2) return null

    const framing = this.detectFraming(parsed)
    const fieldMap = this.induceFieldMap(parsed)
    const confidence = this.scoreAgreement(parsed, fieldMap)

    const shape: InducedShape = { kind: framing, fieldMap, confidence }

    // Audit ❌-4 fix — dead `confidence >= 0.9 ? "prospect" : "prospect"` ternary
    // removed. Now we emit a meaningful intermediate status so the test gate
    // (Stage 6) knows which candidates to prioritize.
    const status = confidence >= 0.8 ? 'high_confidence_prospect' : 'low_confidence_prospect'

    await this.candidateStore.create({
      id: ulid(),
      sessionId,
      protocolFingerprintId: protocolFingerprintId ?? undefined,
      inducedShapeJson: JSON.stringify(shape),
      confidence,
      sampleCount: parsed.length,
      status,
    })

    return shape
  }

  /**
   * Tier F P-2 — canonical JSON before stringification. JSON.stringify is
   * insertion-order-dependent; two frames `{a:1, b:2}` and `{b:2, a:1}` would
   * produce different strings, breaking the b.includes(a) extension check.
   * Sorting keys at every level makes the comparison stable.
   */
  private detectFraming(samples: unknown[]): 'full_snapshot' | 'incremental_delta' {
    const strings = samples.map((s) => (typeof s === 'string' ? s : canonicalStringify(s)))
    let extensionCount = 0
    for (let i = 0; i < strings.length - 1; i++) {
      const a = strings[i]!
      const b = strings[i + 1]!
      if (b.includes(a) && b.length >= a.length) extensionCount++
    }
    const ratio = extensionCount / Math.max(1, strings.length - 1)
    return ratio >= 0.6 ? 'full_snapshot' : 'incremental_delta'
  }

  /**
   * Tier F P-4 + P-5 — induce a fieldMap with required/optional annotations
   * and recursive array-item shapes.
   */
  private induceFieldMap(samples: unknown[]): InducedShape['fieldMap'] {
    const fieldMap: InducedShape['fieldMap'] = {}
    const objectSamples = samples.filter(
      (s): s is Record<string, unknown> => typeof s === 'object' && s !== null && !Array.isArray(s),
    )
    if (objectSamples.length === 0) {
      fieldMap.content = { role: 'content_delta', type: 'string', required: true }
      return fieldMap
    }

    const keys = new Set<string>()
    for (const obj of objectSamples) for (const k of Object.keys(obj)) keys.add(k)

    for (const key of keys) {
      const values = objectSamples.map((o) => o[key]).filter((v) => v !== undefined)
      const presence = values.length / objectSamples.length
      const inferredType = this.inferType(values)
      const role = this.inferRole(key, values)

      // Tier F P-5 — for array-typed fields, recursively induce the element
      // shape. Lets the runtime parser navigate into `messages: [{role, content}]`.
      const items = inferredType === 'array' ? this.induceArrayItemShape(values) : undefined

      fieldMap[key] = {
        role,
        type: inferredType,
        // Tier F P-4 — required iff the field appears in >= 80% of samples.
        required: presence >= 0.8,
        ...(items ? { items } : {}),
      }
    }
    return fieldMap
  }

  /**
   * Tier F P-5 — induce the element shape of an array-typed field by
   * recursively calling induceFieldMap on the first array elements across
   * all samples.
   */
  private induceArrayItemShape(arrayValues: unknown[]): InducedShape['fieldMap'] | undefined {
    const elements: unknown[] = []
    for (const v of arrayValues) {
      if (Array.isArray(v)) {
        for (const el of v) elements.push(el)
      }
    }
    if (elements.length === 0) return undefined
    // Recurse on the collected elements.
    return this.induceFieldMap(elements)
  }

  /**
   * Tier F P-3 — content-key allowlist + existing regex heuristics.
   * The allowlist catches the most common content-bearing fields; the regex
   * table catches id/time/status fields; the monotonic-string check catches
   * content fields with non-allowlist names.
   */
  private inferRole(key: string, values: unknown[]): string {
    // Tier F P-3 — explicit content-key allowlist.
    if (CONTENT_KEYS.has(key.toLowerCase())) return 'content_delta'

    if (
      /id$/i.test(key) &&
      values.every(
        (v, i, arr) =>
          typeof v === 'number' && (i === 0 || (v as number) >= (arr[i - 1] as number)),
      )
    ) {
      return 'sequence_id'
    }
    if (/time|date|ts$/i.test(key)) return 'timestamp'
    if (/role|status|state/i.test(key)) return 'status'
    if (
      typeof values[0] === 'string' &&
      values.every((v, i, arr) => i === 0 || (v as string).length >= (arr[i - 1] as string).length)
    ) {
      return 'content_delta'
    }
    return 'opaque'
  }

  private inferType(values: unknown[]): 'string' | 'number' | 'boolean' | 'array' | 'object' {
    const first = values[0]
    if (Array.isArray(first)) return 'array'
    if (typeof first === 'number') return 'number'
    if (typeof first === 'boolean') return 'boolean'
    if (typeof first === 'object') return 'object'
    return 'string'
  }

  /**
   * Tier F P-6 — better scoring. The previous score was just key-presence
   * agreement, which assigns confidence 1.0 to a fieldMap with all-opaque
   * roles. The new score combines:
   *   - 50% key presence (how often the expected keys appear)
   *   - 30% type stability (does the field's type stay the same across samples)
   *   - 20% role inference (1.0 if role != 'opaque', 0.5 otherwise)
   */
  private scoreAgreement(samples: unknown[], fieldMap: InducedShape['fieldMap']): number {
    const objectSamples = samples.filter(
      (s): s is Record<string, unknown> => typeof s === 'object' && s !== null,
    )
    if (objectSamples.length === 0) return 0.5

    const expectedKeys = Object.keys(fieldMap)

    // 50% — key presence.
    const presenceRatio =
      objectSamples.filter((o) => expectedKeys.every((k) => k in o)).length / objectSamples.length

    // 30% — type stability. For each field, what fraction of samples have a
    // value of the same type as the first sample?
    let typeStabilitySum = 0
    for (const key of expectedKeys) {
      const expectedType = fieldMap[key]?.type
      const valuesFor = objectSamples.map((o) => o[key]).filter((v) => v !== undefined)
      if (valuesFor.length === 0) continue
      const stableCount = valuesFor.filter((v) => {
        if (expectedType === 'array') return Array.isArray(v)
        if (expectedType === 'object')
          return typeof v === 'object' && v !== null && !Array.isArray(v)
        if (expectedType === 'string') return typeof v === 'string'
        if (expectedType === 'number') return typeof v === 'number'
        if (expectedType === 'boolean') return typeof v === 'boolean'
        return false
      }).length
      typeStabilitySum += stableCount / valuesFor.length
    }
    const typeStability = expectedKeys.length > 0 ? typeStabilitySum / expectedKeys.length : 0

    // 20% — role inference. 1.0 if all roles are non-opaque, 0.5 otherwise.
    const nonOpaqueCount = expectedKeys.filter((k) => fieldMap[k]?.role !== 'opaque').length
    const roleScore = expectedKeys.length > 0 ? nonOpaqueCount / expectedKeys.length : 0

    const confidence = 0.5 * presenceRatio + 0.3 * typeStability + 0.2 * roleScore
    return Math.round(confidence * 100) / 100
  }
}

/**
 * Tier F P-2 — canonical JSON stringify. Sorts keys at every level so the
 * output is stable regardless of object insertion order.
 */
function canonicalStringify(v: unknown): string {
  return JSON.stringify(v, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (value as Record<string, unknown>)[k]
          return acc
        }, {})
    }
    return value
  })
}
