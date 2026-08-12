// src/engines/agentic-slm.ts
// AgenticSlmProvider — tiny local expert #3: agentic / automation planning.
//
// Model: onnx-community/Qwen2.5-0.5B-Instruct (ONNX, 0.5B params, q4
// quantized ~300-350MB on disk). Instruction-tuned decoder, chat-template
// aware, small enough to run step-planning and structured tool-call drafting
// entirely on-device via the same @huggingface/transformers ONNX runtime
// already used by the embedding provider — no new SDK, no new native deps.
//
// Why this model for this slot:
//   - This is the only one of the three tiny experts that is a true
//     generative LLM, because "decide the next automation step" / "draft a
//     tool call" genuinely needs open-ended generation — classification and
//     embedding cannot substitute here.
//   - 0.5B was chosen (over 0.25B / 1.5B / larger) as the smallest point on
//     the Qwen2.5 family that reliably follows a JSON tool-call schema in
//     practice; going smaller trades too much instruction-following
//     reliability for marginal size savings, going larger roughly doubles
//     the install artifact for automation tasks that are mostly short
//     "pick the next step" decisions, not long-form generation.
//   - Intended as a cheap first attempt for low-stakes / low-ambiguity
//     automation steps (see AutomationGoal.trustLevel === 'read' in
//     src/engines/automation/types.ts). High-trust or destructive steps
//     should still be gated to a full provider LLM per existing
//     TrustPolicy.humanGate / requiresConfirmation rules — this model does
//     not change that gating, it only reduces how often the expensive path
//     is *needed* for routine planning.
//
// Self-contained: depends only on '@huggingface/transformers'. Wiring into
// src/engines/automation/orchestrator.ts or the reprogrammability layer is
// left to the integration step (see UPGRADE-PACK doc) since those call
// sites are still evolving in this codebase.

const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  maxNewTokens?: number
  temperature?: number
  doSample?: boolean
}

export interface SmallLanguageModelProvider {
  readonly name: string
  init(): Promise<void>
  /** Free-form chat completion. */
  generate(messages: ChatMessage[], opts?: GenerateOptions): Promise<string>
  /**
   * Convenience wrapper for structured/tool-call style output: appends a
   * strict JSON-only instruction and best-effort parses the result.
   * Returns `null` (never throws) on malformed output so callers can decide
   * whether to retry, fall back to a full provider LLM, or ask for
   * clarification — mirrors the harness-repair-engine pattern already used
   * by llm-slave-resolver.ts, without pulling that dependency in here.
   */
  generateJSON<T = unknown>(messages: ChatMessage[], opts?: GenerateOptions): Promise<T | null>
  dispose(): void
}

type TextGenerationPipeline = (
  messages: ChatMessage[],
  options?: { max_new_tokens?: number; temperature?: number; do_sample?: boolean },
) => Promise<Array<{ generated_text: ChatMessage[] }>>

let _pipePromise: Promise<TextGenerationPipeline> | null = null

function getPipeline(): Promise<TextGenerationPipeline> {
  if (!_pipePromise) {
    _pipePromise = import('@huggingface/transformers').then(
      ({ pipeline }) =>
        pipeline('text-generation', MODEL, {
          // q4 keeps the on-disk artifact in the ~300-350MB range; the CPU
          // ONNX runtime path (no WebGPU) is used since this runs server/
          // desktop-side, not in a browser tab.
          dtype: 'q4',
          cache_dir: process.env.VIVIM_MODEL_CACHE ?? 'data/models',
        }) as unknown as Promise<TextGenerationPipeline>,
    )
  }
  return _pipePromise
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

export class AgenticSlmProvider implements SmallLanguageModelProvider {
  readonly name = 'slm:qwen2.5-0.5b-instruct'

  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = getPipeline().then(() => {})
    }
    return this.initPromise
  }

  async generate(messages: ChatMessage[], opts: GenerateOptions = {}): Promise<string> {
    const pipe = await getPipeline()
    const out = await pipe(messages, {
      max_new_tokens: opts.maxNewTokens ?? 256,
      temperature: opts.temperature ?? 0.2,
      do_sample: opts.doSample ?? false,
    })
    const reply = out[0]?.generated_text?.at(-1)
    return reply?.content ?? ''
  }

  async generateJSON<T = unknown>(
    messages: ChatMessage[],
    opts: GenerateOptions = {},
  ): Promise<T | null> {
    const jsonInstruction: ChatMessage = {
      role: 'system',
      content: 'Respond with ONLY a single valid JSON object. No prose, no markdown fences.',
    }
    const raw = await this.generate([jsonInstruction, ...messages], opts)
    try {
      return JSON.parse(extractJson(raw)) as T
    } catch {
      return null
    }
  }

  /** Null out the pipeline reference (for tests / hot reload). */
  dispose(): void {
    _pipePromise = null
    this.initPromise = null
  }
}
