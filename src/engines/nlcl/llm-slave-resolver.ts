import type { IntentResolver, NLCContext, ParsedIntent } from './types.js'

// ── LLMSlaveResolver: Catalog-grounded LLM resolution ─────────────────────────

export interface LLMSlaveResolverDeps {
  providerLLM: ProviderLLMAdapter
  catalog: () => Array<{ id: string; intent: string; description: string; inputSchema: unknown }>
}

export interface ProviderLLMAdapter {
  query(prompt: string): Promise<string>
}

export class LLMSlaveResolver implements IntentResolver {
  readonly name = 'llm-slave'
  private adapter: ProviderLLMAdapter
  private getCatalog: () => Array<{
    id: string
    intent: string
    description: string
    inputSchema: unknown
  }>

  constructor(deps: LLMSlaveResolverDeps) {
    this.adapter = deps.providerLLM
    this.getCatalog = deps.catalog
  }

  async resolve(rawInput: string, _ctx: NLCContext): Promise<ParsedIntent | null> {
    const catalog = this.getCatalog()
    const prompt = this.buildPrompt(rawInput, catalog)

    try {
      const response = await this.adapter.query(prompt)
      return this.parseLLMResponse(response, rawInput, catalog)
    } catch {
      return null
    }
  }

  private buildPrompt(
    rawInput: string,
    catalog: Array<{ id: string; intent: string; description: string }>,
  ): string {
    const catalogStr = catalog.map((c) => `- capabilityId: "${c.id}" | ${c.description}`).join('\n')

    return `You are a command resolver. Given a user sentence, select ONE capabilityId from the catalog and produce valid JSON input. Respond ONLY as JSON: {"capabilityId":"<id>","input":{<params>}}

Catalog:
${catalogStr}

User: "${rawInput}"

JSON:`
  }

  private parseLLMResponse(
    response: string,
    rawInput: string,
    catalog: Array<{ id: string; intent: string; description: string; inputSchema: unknown }>,
  ): ParsedIntent | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null

      const parsed = JSON.parse(jsonMatch[0]) as {
        capabilityId?: string
        input?: Record<string, unknown>
      }
      if (!parsed.capabilityId) return null

      // Find matching pattern
      const pattern = catalog.find((c) => c.id === parsed.capabilityId)
      if (!pattern) return null

      return {
        patternId: pattern.id,
        intent: parsed.capabilityId,
        input: parsed.input ?? {},
        confidence: 1.0,
        rawInput,
        matchedPattern: 'llm-slave',
        alternatives: [],
        resolvedAt: Date.now(),
        capabilityId: parsed.capabilityId,
      }
    } catch {
      return null
    }
  }
}
