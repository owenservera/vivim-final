// src/engines/safe-eval.ts
// Guard for the remaining `new Function()` evaluation site (stream-parser inline
// parsers via SandboxRunner).
//
// The workflow-compiler and workflow-engine sites have been migrated to
// safe-expression.ts (AST-based allowlist evaluator). The plugin-router migration script
// site has been migrated to a structured migration DSL (parseMigrationScript).
// This guard remains for the stream-parser SandboxRunner path, which still uses
// `new Function()` for DB-backed parser definitions.
// HAZARD H9 — denylist is fundamentally incomplete (fail-open). Proper fix is
// allowlist via safe-expression.ts + quickjs-only sandbox (see TODO below).
// This file is the short-term harden path; long-term migrate parsers to AST.

import { EngineError } from '../errors.js'

// Denylist — expands FIXES §3 with remaining risky globals omitted previously.
// Still denylist (inherently incomplete) — see safe-expression.ts for proper allowlist.
const FORBIDDEN_TOKENS =
  /\b(?:constructor|__proto__|prototype|process|globalThis|global|window|document|self|require|import|eval|Function|fetch|XMLHttpRequest|setTimeout|setInterval|setImmediate|queueMicrotask|Proxy|Reflect|Worker|postMessage|atob|btoa|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|navigator|location|Blob|TextEncoder|TextDecoder|structuredClone|MessageChannel|BroadcastChannel|crypto|SubtleCrypto|XMLSerializer|DOMParser|importScripts|WebAssembly|addEventListener|removeEventListener|FinalizationRegistry|WeakRef|WeakMap|WeakSet|Atomics|Intl|AbortController|AbortSignal|URL|URLSearchParams|File|FileReader|FormData|Headers|Request|Response|ReadableStream|WritableStream|TransformStream|Performance|PerformanceObserver|queueMicrotask|Scheduler|scheduler|navigator|permissions|Notification|fetch|AbortSignal)\b/i

export function assertTrustedExpressionSource(source: string, label: string): void {
  if (FORBIDDEN_TOKENS.test(source)) {
    throw new EngineError(
      `Refused to evaluate untrusted ${label}: expression references a forbidden token. Only author-defined DSL expressions are permitted.`,
    )
  }
}
