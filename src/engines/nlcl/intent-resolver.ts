import { EngineError } from '../../errors.js'
import type { EmbeddingProvider } from '../semantic-search.js'
import type { CommandPatternRegistry } from './command-registry.js'
import { LayeredResolver } from './layered-resolver.js'
import { NLCommandParser } from './nl-parser.js'
import type { IntentResolver, NLCContext, ParsedIntent, ResolverConfig } from './types.js'

// ── Deterministic (default, zero AI) ──────────────────────────────────────

export class DeterministicResolver implements IntentResolver {
  readonly name = 'deterministic'
  private parser: NLCommandParser

  constructor(registry: CommandPatternRegistry) {
    this.parser = new NLCommandParser(registry)
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    return this.parser.parse(rawInput, ctx, {
      surface: ctx.surface,
      maxAlternatives: 3,
      minConfidence: 0.3,
    })
  }
}

// ── Local LLM (Ollama / llama.cpp / LM Studio) ────────────────────────────

export interface LocalLLMAdapter {
  complete(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>
}

export class LocalLLMResolver implements IntentResolver {
  readonly name = 'local-llm'
  private adapter: LocalLLMAdapter
  private registry: CommandPatternRegistry
  private minConfidence: number

  constructor(adapter: LocalLLMAdapter, registry: CommandPatternRegistry, minConfidence = 0.5) {
    this.adapter = adapter
    this.registry = registry
    this.minConfidence = minConfidence
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const catalog = this.registry.exportForSurface(ctx.surface)
    const prompt = this.buildPrompt(rawInput, catalog)

    try {
      const response = await this.adapter.complete(prompt, { temperature: 0.1, maxTokens: 512 })
      return this.parseLLMResponse(response, rawInput)
    } catch {
      return null
    }
  }

  private buildPrompt(
    rawInput: string,
    catalog: Array<{ intent: string; description: string; examples: string[] }>,
  ): string {
    const catalogStr = catalog
      .map((c) => `- ${c.intent}: ${c.description} (e.g. ${c.examples.slice(0, 2).join(', ')})`)
      .join('\n')

    return `You are a command intent classifier. Given a user's natural language input, classify it into one of the following intents. Respond as JSON: {"intent":"<intent>","input":{<params>},"confidence":<0-1>}

Available intents:
${catalogStr}

User input: "${rawInput}"

JSON response:`
  }

  private parseLLMResponse(response: string, rawInput: string): ParsedIntent | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      const parsed = JSON.parse(jsonMatch[0]) as {
        intent?: string
        input?: Record<string, unknown>
        confidence?: number
      }
      if (!parsed.intent) return null

      const pattern = this.registry.getByIntent(parsed.intent)
      if (!pattern) return null

      const validated = pattern.inputSchema.safeParse(parsed.input ?? {})
      if (!validated.success) return null

      return {
        patternId: pattern.id,
        intent: pattern.intent,
        input: validated.data as Record<string, unknown>,
        confidence: Math.min(parsed.confidence ?? 0.7, 1.0),
        rawInput,
        matchedPattern: 'local-llm',
        alternatives: [],
        resolvedAt: Date.now(),
      }
    } catch {
      return null
    }
  }
}

// ── Provider LLM (delegates to user's provider via harness) ───────────────

export interface ProviderLLMAdapter {
  query(prompt: string): Promise<string>
}

export class ProviderLLMResolver implements IntentResolver {
  readonly name = 'provider-llm'
  private adapter: ProviderLLMAdapter
  private registry: CommandPatternRegistry

  constructor(adapter: ProviderLLMAdapter, registry: CommandPatternRegistry) {
    this.adapter = adapter
    this.registry = registry
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const catalog = this.registry.exportForSurface(ctx.surface)
    const prompt = this.buildPrompt(rawInput, catalog)

    try {
      const response = await this.adapter.query(prompt)
      const localParser = new LocalLLMResolver(
        { complete: async (p: string) => (p === prompt ? response : '') },
        this.registry,
      )
      return localParser.resolve(rawInput, ctx)
    } catch {
      return null
    }
  }

  private buildPrompt(
    rawInput: string,
    catalog: Array<{ intent: string; description: string; examples: string[] }>,
  ): string {
    const catalogStr = catalog
      .map((c) => `- ${c.intent}: ${c.description} (e.g. ${c.examples.slice(0, 2).join(', ')})`)
      .join('\n')

    return `Classify this user command into one intent. Respond as JSON: {"intent":"<intent>","input":{<params>},"confidence":<0-1>}

Intents:
${catalogStr}

Input: "${rawInput}"
JSON:`
  }
}

// ── Hybrid (deterministic first, LLM fallback) ────────────────────────────

export class HybridResolver implements IntentResolver {
  readonly name = 'hybrid'
  private deterministic: DeterministicResolver
  private llmFallback: IntentResolver | null
  private minConfidence: number

  constructor(registry: CommandPatternRegistry, llmFallback?: IntentResolver, minConfidence = 0.5) {
    this.deterministic = new DeterministicResolver(registry)
    this.llmFallback = llmFallback ?? null
    this.minConfidence = minConfidence
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    const deterministic = await this.deterministic.resolve(rawInput, ctx)
    if (deterministic && deterministic.confidence >= this.minConfidence) {
      return deterministic
    }

    if (this.llmFallback) {
      const llmResult = await this.llmFallback.resolve(rawInput, ctx)
      if (llmResult && llmResult.confidence >= this.minConfidence) {
        if (deterministic) {
          llmResult.alternatives.unshift(deterministic)
        }
        return llmResult
      }
    }

    return deterministic
  }
}

// ── Factory ───────────────────────────────────────────────────────────────

export function createResolver(
  config: ResolverConfig,
  registry: CommandPatternRegistry,
  adapters?: {
    localLLM?: LocalLLMAdapter
    providerLLM?: ProviderLLMAdapter
    embeddingProvider?: EmbeddingProvider
    classifierResolver?: IntentResolver
  },
): IntentResolver {
  switch (config.type) {
    case 'deterministic':
      return new DeterministicResolver(registry)

    case 'local-llm': {
      if (!adapters?.localLLM) {
        if (config.fallbackToDeterministic) return new DeterministicResolver(registry)
        throw new EngineError('Local LLM adapter not provided and fallback disabled')
      }
      const llm = new LocalLLMResolver(adapters.localLLM, registry, config.minConfidence)
      if (config.fallbackToDeterministic) {
        return new HybridResolver(registry, llm, config.minConfidence)
      }
      return llm
    }

    case 'provider-llm': {
      if (!adapters?.providerLLM) {
        if (config.fallbackToDeterministic) return new DeterministicResolver(registry)
        throw new EngineError('Provider LLM adapter not provided and fallback disabled')
      }
      const llm = new ProviderLLMResolver(adapters.providerLLM, registry)
      if (config.fallbackToDeterministic) {
        return new HybridResolver(registry, llm, config.minConfidence)
      }
      return llm
    }

    case 'hybrid': {
      const fallbacks: IntentResolver[] = []
      if (adapters?.localLLM) {
        fallbacks.push(new LocalLLMResolver(adapters.localLLM, registry, config.minConfidence))
      }
      if (adapters?.providerLLM) {
        fallbacks.push(new ProviderLLMResolver(adapters.providerLLM, registry))
      }
      const primary = fallbacks[0] ?? null
      return new HybridResolver(registry, primary ?? undefined, config.minConfidence)
    }

    case 'layered': {
      // Full SOTA 6-layer pipeline: Deterministic → Fuzzy → Semantic → Classifier → LLM.
      const llms: IntentResolver[] = []
      if (adapters?.localLLM) {
        llms.push(
          new LocalLLMResolver(
            adapters.localLLM,
            registry,
            config.llmThreshold ?? config.minConfidence,
          ),
        )
      }
      if (adapters?.providerLLM) {
        llms.push(new ProviderLLMResolver(adapters.providerLLM, registry))
      }
      const llmFallback = llms[0] ?? (config.fallbackToDeterministic ? undefined : undefined)
      return new LayeredResolver(registry, {
        llmFallback,
        classifierResolver: adapters?.classifierResolver,
        fuzzyThreshold: config.fuzzyThreshold,
        semanticThreshold: config.semanticThreshold,
        llmThreshold: config.llmThreshold ?? config.minConfidence,
        embeddingProvider: adapters?.embeddingProvider,
      })
    }
  }
}

// ── Helper: unresolved intent (for audit logging) ─────────────────────────

export function unresolvedIntent(rawInput: string): ParsedIntent {
  return {
    patternId: 'unresolved',
    intent: 'unresolved',
    input: { raw: rawInput },
    confidence: 0,
    rawInput,
    matchedPattern: 'none',
    alternatives: [],
    resolvedAt: Date.now(),
  }
}
