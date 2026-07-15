// src/engines/safe-eval.ts
// Guard for the three `new Function()` evaluation sites (stream-parser inline
// parsers, workflow-compiler / workflow-engine DSL conditions).
//
// Those expressions originate from DB-backed parser definitions and
// author-authored workflow definitions — they are NOT free-form user input.
// This guard rejects the most common code-execution vectors if a definition is
// ever sourced externally without authorization, closing the gap the security
// audit (AU-0001/0002/0003) flagged.

import { EngineError } from '../errors.js'

const FORBIDDEN_TOKENS =
  /\b(?:constructor|__proto__|prototype|process|globalThis|global|window|document|self|require|import|eval|Function|fetch|XMLHttpRequest|setTimeout|setInterval|setImmediate|queueMicrotask|Proxy|Reflect|Worker|postMessage|atob|btoa)\b/

export function assertTrustedExpressionSource(source: string, label: string): void {
  if (FORBIDDEN_TOKENS.test(source)) {
    throw new EngineError(
      `Refused to evaluate untrusted ${label}: expression references a forbidden token. Only author-defined DSL expressions are permitted.`,
    )
  }
}
