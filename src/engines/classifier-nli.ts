// src/engines/classifier-nli.ts
// NliClassifierProvider — tiny local expert #2: CLI / intent classification.
//
// Model: Xenova/nli-deberta-v3-xsmall (ONNX, ~22M params, ~70MB fp32 / ~20MB
// int8-quantized). Cross-encoder NLI model repurposed as zero-shot text
// classification: given raw input + a list of candidate intent labels (the
// NLCL command catalog), it returns a calibrated probability per label.
//
// Why this model for this slot:
//   - It is NOT a generative LLM — no hallucinated JSON, no prompt injection
//     surface, no sampling. Pure classification head over NLI entailment.
//   - Runs the same @huggingface/transformers ONNX runtime already bundled
//     for the embedding provider (embedding-hf.ts) — zero new native deps,
//     zero new install-size category, just another ~20MB model artifact
//     fetched into VIVIM_MODEL_CACHE on first use.
//   - Slots directly into the existing 5-layer NLCL pipeline
//     (see nlcl/layered-resolver.ts) as a cheap pre-filter in front of the
//     LLM fallback (llm-slave-resolver.ts), which is the only layer today
//     that calls out to a full-size provider LLM. Every request the
//     classifier resolves with high confidence is a request that never
//     reaches the LLM — this is the direct cost lever ("without breaking
//     the bank") for CLI/intent resolution.
//
// This file is intentionally self-contained: it depends only on
// '@huggingface/transformers' (already a project dependency) and defines
// its own narrow interface so it can be adopted independently of the NLCL
// resolver wiring (see nlcl/classifier-resolver.ts for that integration).

const MODEL = 'Xenova/nli-deberta-v3-xsmall'

export interface ClassificationResult {
  /** Candidate labels, sorted highest-confidence first. */
  labels: string[]
  /** Scores parallel to `labels`, each in [0, 1]. Not guaranteed to sum to 1 when multiLabel is true. */
  scores: number[]
}

export interface IntentClassifierProvider {
  readonly name: string
  /** Warm up the pipeline (call once at boot). Idempotent. */
  init(): Promise<void>
  /**
   * Classify `text` against `candidateLabels`.
   * @param multiLabel When true, each label is scored independently (useful
   *   when more than one intent may legitimately apply). Default false
   *   (single-label / labels compete against each other — matches how
   *   NLCL intents are mutually exclusive per command).
   */
  classify(text: string, candidateLabels: string[], multiLabel?: boolean): Promise<ClassificationResult>
  dispose(): void
}

type ZeroShotPipeline = (
  text: string,
  labels: string[],
  options?: { multi_label?: boolean; hypothesis_template?: string },
) => Promise<{ sequence: string; labels: string[]; scores: number[] }>

let _pipePromise: Promise<ZeroShotPipeline> | null = null

function getPipeline(): Promise<ZeroShotPipeline> {
  if (!_pipePromise) {
    _pipePromise = import('@huggingface/transformers').then(
      ({ pipeline }) =>
        pipeline('zero-shot-classification', MODEL, {
          // int8 dynamic quantization keeps the on-disk artifact ~20MB and
          // is more than sufficient precision for intent routing.
          dtype: 'q8',
          cache_dir: process.env.VIVIM_MODEL_CACHE ?? 'data/models',
        }) as unknown as Promise<ZeroShotPipeline>,
    )
  }
  return _pipePromise
}

export class NliClassifierProvider implements IntentClassifierProvider {
  readonly name = 'nli:deberta-v3-xsmall'

  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = getPipeline().then(() => {})
    }
    return this.initPromise
  }

  async classify(
    text: string,
    candidateLabels: string[],
    multiLabel = false,
  ): Promise<ClassificationResult> {
    if (candidateLabels.length === 0) return { labels: [], scores: [] }
    const pipe = await getPipeline()
    const out = await pipe(text, candidateLabels, {
      multi_label: multiLabel,
      // Framed for CLI command routing rather than generic topic labels.
      hypothesis_template: 'The user wants to {}.',
    })
    return { labels: out.labels, scores: out.scores }
  }

  /** Null out the pipeline reference (for tests / hot reload). */
  dispose(): void {
    _pipePromise = null
    this.initPromise = null
  }
}
