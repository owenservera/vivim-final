// src/engines/safe-eval.ts
// Guard for the remaining `new Function()` evaluation site (stream-parser inline
// parsers via SandboxRunner).
//
// The workflow-compiler and workflow-engine sites have been migrated to
// safe-expression.ts (AST-based evaluator). The plugin-router migration script
// site has been migrated to a structured migration DSL (parseMigrationScript).
// This guard remains for the stream-parser SandboxRunner path, which still uses
// `new Function()` for DB-backed parser definitions.

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
