// src/framing/frame-version.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// The frame version is bumped on any breaking change to the
// NormalizedRequest / NormalizedResponse / FramingAdapter shapes.
// REPROGRAMMABILITY.md (Phase 10) references this version.
//
// The frame version is INDEPENDENT of CONTRACT_VERSION (the
// reprogrammability contract). They evolve separately.

export const FRAME_VERSION = 1 as const

/**
 * The set of transports a FramingAdapter may use.
 *
 * - `webapp` — Chrome slave + CDP + recipe DAG (the canonical Vivim path)
 * - `api`    — direct HTTP/SSE to the provider's API (OpenAI-shaped)
 * - `local`  — local model invocation (Ollama / llama.cpp)
 *
 * This is a closed set. A 4th transport requires a contract amendment
 * (Phase 10 invariants lock).
 */
export type FrameTransport = 'webapp' | 'api' | 'local'

export const FRAME_TRANSPORTS: readonly FrameTransport[] = ['webapp', 'api', 'local'] as const
