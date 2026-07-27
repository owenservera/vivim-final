// src/engines/format-classifier.ts
// FormatClassifier — LLM-driven fallback for classifying unknown wire formats
// and generating parsers when StreamingResponseAnalyzer confidence < 0.7.
//
// The classifier sends the raw body to an LLM with a structured prompt,
// parses the JSON classification response, and can generate a logic_code
// parser matching the seed parser contract.

import { EngineError } from '../errors.js'
import type { StreamTransport } from './streaming-response-analyzer.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LlmClient {
  complete: (prompt: string) => Promise<string>
}

export interface FormatClassification {
  transport: StreamTransport
  eventName?: string
  providerHint?: string
  confidence: number
  dataPath?: string
  schemaDescription: string
  rationale: string
}

// ── Prompts ────────────────────────────────────────────────────────────────

const CLASSIFY_PROMPT = `You are analyzing a raw streaming response body from an LLM provider's web UI.
Classify the wire format and identify the data path to extract text content.

Raw body (first 3000 chars):
{bodySample}

Answer with JSON only (no markdown, no explanation):
{
  "transport": "sse"|"json_stream"|"batchexecute"|"websocket"|"polling"|"unknown",
  "eventName": string or null,
  "providerHint": string or null,
  "confidence": 0.0-1.0,
  "dataPath": "JS accessor path to text content, e.g. choices[0].delta.content",
  "schemaDescription": "brief description of the format",
  "rationale": "why you chose this classification"
}`

const GENERATE_PARSER_PROMPT = `Given the raw streaming body and classification below, generate a JavaScript
parser module that follows the seed parser contract.

Classification: {classification}
Raw body (first 5000 chars): {bodySample}

The parser must follow this exact contract:
exports.default = {
  name: '{providerSlug}/inferred',
  version: 1,
  providerId: '{providerSlug}',
  parse: function(rawBody) { /* returns array of {type, text} blocks */ },
  detectCompletion: function(rawBody) { /* returns boolean */ },
  getConfidence: function(rawBody) { /* returns 0.0-1.0 */ }
}

ContentBlock types: 'text', 'reasoning', 'tool-call', 'file', 'meta'
Return ONLY valid JavaScript code in a code block.`

// ── FormatClassifier ──────────────────────────────────────────────────────

export class FormatClassifier {
  constructor(private llmClient: LlmClient) {}

  /**
   * Classify an unknown wire format using LLM analysis.
   */
  async classify(body: string): Promise<FormatClassification> {
    if (!body || body.trim().length === 0) {
      throw new EngineError('FormatClassifierError', 'Cannot classify empty body')
    }

    const bodySample = body.slice(0, 3000)
    const prompt = CLASSIFY_PROMPT.replace('{bodySample}', bodySample)

    const response = await this.llmClient.complete(prompt)
    const classification = this.parseClassificationResponse(response)

    return classification
  }

  /**
   * Generate a parser logic_code from raw body + classification.
   */
  async generateParser(
    body: string,
    classification: FormatClassification,
    providerSlug: string,
  ): Promise<string> {
    if (!body || body.trim().length === 0) {
      throw new EngineError('FormatClassifierError', 'Cannot generate parser from empty body')
    }

    const bodySample = body.slice(0, 5000)
    const classificationJson = JSON.stringify(classification, null, 2)

    const prompt = GENERATE_PARSER_PROMPT.replace('{classification}', classificationJson)
      .replace('{bodySample}', bodySample)
      .replace(/{providerSlug}/g, providerSlug)

    const response = await this.llmClient.complete(prompt)
    const code = this.extractCodeBlock(response)

    if (!code || code.trim().length === 0) {
      throw new EngineError('FormatClassifierError', 'LLM returned empty parser code')
    }

    return code
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private parseClassificationResponse(response: string): FormatClassification {
    // Try to extract JSON from the response (may be wrapped in markdown)
    const jsonMatch =
      response.match(/```(?:json)?\s*([\s\S]*?)```/) ?? response.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? (jsonMatch[1]?.trim() ?? '') : response.trim()

    try {
      const parsed = JSON.parse(jsonStr)
      const validTransports: StreamTransport[] = ['sse', 'websocket', 'polling', 'unknown']
      const transport = validTransports.includes(parsed.transport) ? parsed.transport : 'unknown'

      return {
        transport,
        eventName: parsed.eventName ?? undefined,
        providerHint: parsed.providerHint ?? undefined,
        confidence:
          typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        dataPath: parsed.dataPath ?? undefined,
        schemaDescription:
          typeof parsed.schemaDescription === 'string'
            ? parsed.schemaDescription
            : 'Unknown format',
        rationale:
          typeof parsed.rationale === 'string' ? parsed.rationale : 'No rationale provided',
      }
    } catch {
      throw new EngineError(
        'FormatClassifierError',
        `Failed to parse LLM response as JSON: ${response.slice(0, 200)}`,
      )
    }
  }

  private extractCodeBlock(response: string): string {
    // Extract from markdown code block
    const codeBlockMatch = response.match(/```(?:javascript|js)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) return codeBlockMatch[1]?.trim() ?? ''

    // If no code block, try to find exports.default pattern
    const exportsMatch = response.match(/(exports\.default\s*=\s*\{[\s\S]*\})/)
    if (exportsMatch) return exportsMatch[1]?.trim() ?? ''

    // Return raw response as last resort
    return response.trim()
  }
}
