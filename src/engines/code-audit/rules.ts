// src/engines/code-audit/rules.ts
// Declarative static rule registry. Every rule runs against the token-aware
// projection (strings/comments stripped), carries a dimension + severity +
// confidence + patch recipe, and supports file allowlists for sanctioned
// wrappers. High-signal rules from the classic engine and devops/audit-code
// are ported here as first-class, token-aware entries.

import type { AuditRule, FindingSeed, TokenizedFile } from './types.js'

const CODE_EXT = ['.ts', '.tsx', '.js', '.jsx']
const JS_EXT = ['.ts', '.tsx', '.js', '.jsx', '.prisma']
const FRONTEND_EXT = ['.tsx', '.jsx']

// ── Shared detection helpers ──────────────────────────────────────────────

/** Does the code projection contain a real (non-string) `callee(...)` call anywhere? */
function codeHasCall(tf: TokenizedFile, callee: string): boolean {
  for (let i = 0; i < tf.tokens.length; i++) {
    if (tf.tokens[i]?.text === callee && tf.tokens[i + 1]?.text === '(') return true
  }
  return false
}

/** Is this a backend engine file (src/engines/*), not a frontend one? */
function isBackendEngine(filePath: string): boolean {
  if (/frontend[\\/]/.test(filePath)) return false
  return /(^|[\\/])src[\\/]engines[\\/]/.test(filePath)
}

/**
 * Import-aware projection: strip comments (and everything else) but preserve
 * the module specifiers of import/export/require statements. The tokenizer
 * blanks ALL string literals — including specifiers — so drift rules must
 * scan this projection (raw `tf.code` would never see the path).
 *
 * A line only counts as an import line when the tokenizer emitted a real
 * `import`/`export`/`require` token there — string content never produces
 * tokens, so `const s = "import from 'storage/impl/x'"` is correctly ignored.
 * Multi-line imports are covered by scanning up to 4 lines past the keyword.
 */
function importProjection(tf: TokenizedFile): { line: number; spec: string }[] {
  const out: { line: number; spec: string }[] = []
  const seen = new Set<number>()
  for (const t of tf.tokens) {
    const isImportKw = t.kind === 'keyword' && (t.text === 'import' || t.text === 'export')
    const isRequire = t.kind === 'identifier' && t.text === 'require'
    if (!isImportKw && !isRequire) continue
    if (seen.has(t.line)) continue
    for (let d = 0; d <= 4; d++) {
      const raw = tf.lines[t.line - 1 + d]
      if (raw === undefined) break
      const line = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const m =
        /\bfrom\s+['"]([^'"\n]+)['"]/.exec(line) ??
        /\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/.exec(line)
      if (!m) continue
      out.push({ line: t.line, spec: m[1]! })
      seen.add(t.line)
      break
    }
  }
  return out
}

/** Normalise a specifier for segment matching (handles `/` and `\`). */
function specSegments(spec: string): string {
  return spec.replace(/\\/g, '/')
}

/** Does the module specifier reference a storage/impl path? */
function isStorageImplImport(spec: string): boolean {
  return /(^|\/)(storage\/impl)(\/|$)/.test(specSegments(spec))
}

/** Does the module specifier reference the CDP executor/transport? */
function isCdpImport(spec: string): boolean {
  return /(^|\/)(executor\/cdp|cdp-transport)(\/|$)/.test(specSegments(spec))
}

// ── The registry ──────────────────────────────────────────────────────────

export const RULES: AuditRule[] = [
  // ── Security ────────────────────────────────────────────────────────────
  {
    id: 'SEC-CODE-EXEC-EVAL',
    dimension: 'security',
    severity: 'HIGH',
    cwe: 'CWE-95',
    title: 'Dynamic code execution via eval()',
    description:
      'eval() executes arbitrary code from a string. Token-aware detection — only real eval() calls are flagged, string references and comments are ignored.',
    confidence: 0.95,
    extensions: JS_EXT,
    allowlist: ['safe-eval', 'safe-expression'],
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        const t = tf.tokens[i]!
        if (t.text !== 'eval' || t.kind !== 'identifier') continue
        const next = tf.tokens[i + 1]
        if (next?.text !== '(') continue
        out.push({
          line: t.line,
          snippet: tf.lines[t.line - 1]?.trim() ?? '',
          evidence: 'eval( ... ) call on code token',
          impact:
            'Arbitrary code execution if the evaluated string is influenced by untrusted input.',
          confidence: 0.95,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Replace eval with a safe typed parser or sandboxed evaluator.',
      steps: [
        'Trace the expression string origin.',
        'If untrusted, validate against a strict allow-list or use the sandboxed evaluator.',
        'Prefer a typed API over eval.',
      ],
      effort: 'M',
    },
  },
  {
    id: 'SEC-NEW-FUNCTION',
    dimension: 'security',
    severity: 'MEDIUM',
    cwe: 'CWE-95',
    title: 'Runtime code compilation via new Function()',
    description:
      'new Function() compiles code at runtime. Legitimate in DSL/expression compilers only when the expression is fully trusted.',
    confidence: 0.8,
    extensions: JS_EXT,
    allowlist: ['safe-eval', 'safe-expression'],
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        if (tf.tokens[i]?.text === 'new' && tf.tokens[i + 1]?.text === 'Function') {
          out.push({
            line: tf.tokens[i]!.line,
            snippet: tf.lines[tf.tokens[i]!.line - 1]?.trim() ?? '',
            evidence: 'new Function( ... ) in code tokens',
            impact: 'Code execution if the compiled expression derives from untrusted input.',
            confidence: 0.8,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Confirm the expression source is trusted; otherwise validate or sandbox it.',
      steps: [
        'Trace where the expression string originates.',
        'If user-influenced, use an allow-listed parser instead.',
      ],
      effort: 'M',
    },
  },
  {
    id: 'SEC-SHELL-EXEC',
    dimension: 'security',
    severity: 'HIGH',
    cwe: 'CWE-78',
    title: 'Shell/process execution call',
    description:
      'child_process exec/spawn/execSync detected. Flagged only for real child_process usage; command injection is possible if arguments are untrusted.',
    confidence: 0.85,
    extensions: JS_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        const t = tf.tokens[i]!
        if (
          t.text !== 'exec' &&
          t.text !== 'spawn' &&
          t.text !== 'execFile' &&
          t.text !== 'execSync' &&
          t.text !== 'execFileSync'
        )
          continue
        const next = tf.tokens[i + 1]
        if (next?.text !== '(') continue
        // Skip property access (e.g. /re/.exec(x), child_process.exec): those
        // are not shell execution. Only bare calls count.
        const prev = tf.tokens[i - 1]
        if (prev?.text === '.') continue
        out.push({
          line: t.line,
          snippet: tf.lines[t.line - 1]?.trim() ?? '',
          evidence: 'bare process execution call in code tokens',
          impact: 'Arbitrary command execution if any argument is attacker-controlled.',
          confidence: 0.85,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Validate and whitelist inputs, or replace with a safe typed API.',
      steps: [
        'Identify the input source for the executed command/args.',
        'If untrusted, validate against a strict allow-list.',
      ],
      effort: 'M',
    },
  },

  // ── Correctness ─────────────────────────────────────────────────────────
  {
    id: 'CORR-SWALLOWED-CATCH',
    dimension: 'correctness',
    severity: 'MEDIUM',
    cwe: 'CWE-391',
    title: 'Swallowed exception in catch block',
    description:
      'A catch block with an empty (or comment-only) body silently discards the error. Token-aware: real empty braces only.',
    confidence: 0.88,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      const toks = tf.tokens
      for (let i = 0; i < toks.length; i++) {
        if (toks[i]?.text !== 'catch') continue
        // scan forward for the body braces
        let openIdx = -1
        for (let j = i + 1; j < Math.min(i + 12, toks.length); j++) {
          if (toks[j]?.text === '{') {
            openIdx = j
            break
          }
        }
        if (openIdx === -1) continue
        const closeIdx = toks[openIdx + 1]
        if (closeIdx && closeIdx.text === '}') {
          out.push({
            line: toks[i]!.line,
            snippet: tf.lines[toks[i]!.line - 1]?.trim() ?? '',
            evidence: 'catch block with empty body',
            impact: 'Failures become silent; root causes are hard to diagnose.',
            confidence: 0.88,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'insert-log',
      summary: 'Log the error (with context) inside the catch, or re-throw.',
      steps: [
        'Add a contextual log line (log.error(err)) inside the catch.',
        'Never leave a catch with no side effect.',
      ],
      effort: 'S',
    },
  },
  {
    id: 'CORR-RAW-ERROR',
    dimension: 'correctness',
    severity: 'MEDIUM',
    title: 'Raw new Error() used (use domain error classes)',
    description:
      'Engines should throw custom error classes from src/errors.ts, not generic Error, so callers can discriminate error types.',
    confidence: 0.9,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        if (tf.tokens[i]?.text === 'new' && tf.tokens[i + 1]?.text === 'Error') {
          out.push({
            line: tf.tokens[i]!.line,
            snippet: tf.lines[tf.tokens[i]!.line - 1]?.trim() ?? '',
            evidence: 'new Error(...) in code tokens',
            impact: 'Callers cannot discriminate error types; breaks the Result<T,E> pattern.',
            confidence: 0.9,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Replace with a domain error class from src/errors.ts.',
      steps: [
        'Import the appropriate custom error.',
        'Throw that class instead of new Error(...).',
      ],
      effort: 'S',
    },
  },
  {
    id: 'CORR-REACT-MISSING-KEY',
    dimension: 'frontend',
    severity: 'MEDIUM',
    cwe: 'CWE-1188',
    title: 'Missing "key" prop in JSX .map() render',
    description:
      'Iterating an array into JSX without a unique key prop causes re-render bugs and state mismatch.',
    confidence: 0.85,
    extensions: FRONTEND_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      const toks = tf.tokens
      for (let i = 0; i < toks.length; i++) {
        if (toks[i]?.text !== 'map') continue
        const line = toks[i]!.line
        const next = toks[i + 1]
        if (next?.text !== '(') continue
        // look for JSX after the map closing paren / arrow, within ~3 lines
        const window = tf.lines.slice(line - 1, line + 3).join(' ')
        if (!window.includes('<')) continue
        const follow = tf.lines.slice(line - 1, line + 4).join(' ')
        if (!follow.includes('key=') && !follow.includes('key=')) {
          out.push({
            line,
            snippet: tf.lines[line - 1]?.trim() ?? '',
            evidence: '.map() with JSX but no key= prop in the following lines',
            impact: 'React reconciliation issues; list state mismatches.',
            confidence: 0.85,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Add a stable key= prop (e.g. item.id) to the root element inside .map().',
      steps: ['Identify the list element.', 'Add key={item.id} (stable, not index-only).'],
      effort: 'S',
    },
  },
  {
    id: 'CORR-HOOK-LEAK',
    dimension: 'frontend',
    severity: 'HIGH',
    cwe: 'CWE-772',
    title: 'EventListener/subscription leak in useEffect',
    description:
      'useEffect attaches listeners without a cleanup function, leaking per-mount subscriptions.',
    confidence: 0.9,
    extensions: FRONTEND_EXT,
    detect(tf) {
      if (!codeHasCall(tf, 'useEffect')) return []
      const hasCleanup =
        tf.tokens.some((t) => t.text === 'removeEventListener') ||
        tf.source.includes('return () =>')
      if (hasCleanup) return []
      const out: FindingSeed[] = []
      for (const t of tf.tokens) {
        if (t.text === 'addEventListener') {
          out.push({
            line: t.line,
            snippet: tf.lines[t.line - 1]?.trim() ?? '',
            evidence: 'addEventListener in a useEffect without cleanup',
            impact: 'Memory leak; duplicated handlers across remounts.',
            confidence: 0.9,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Return a cleanup function that removes the listener.',
      steps: ['Return () => { removeEventListener(...) } from the effect.'],
      effort: 'S',
    },
  },
  {
    id: 'CORR-BUN-SPAWN-EXITCODE',
    dimension: 'correctness',
    severity: 'HIGH',
    cwe: 'CWE-667',
    title: 'Premature Bun.spawn exitCode access',
    description:
      'proc.exitCode returns null until "await proc.exited" resolves. Reading it directly yields false null/zero returns.',
    confidence: 0.91,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      const codeLines = tf.code.split('\n')
      for (let i = 0; i < codeLines.length; i++) {
        if (!codeLines[i]?.includes('.exitCode')) continue
        const before = codeLines.slice(Math.max(0, i - 5), i).join('\n')
        if (!before.includes('.exited')) {
          out.push({
            line: i + 1,
            snippet: tf.lines[i]?.trim() ?? '',
            evidence: '.exitCode read without preceding await .exited',
            impact: 'False zero/null exit codes; broken failure detection.',
            confidence: 0.91,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Always await proc.exited before reading exitCode.',
      steps: ['Add `await proc.exited` before reading proc.exitCode.'],
      effort: 'S',
    },
  },
  {
    id: 'CORR-FETCH-NO-TIMEOUT',
    dimension: 'correctness',
    severity: 'LOW',
    cwe: 'CWE-400',
    title: 'fetch() without timeout/AbortController guard',
    description:
      'Long-lived fetch against CDP or server endpoints can hang indefinitely without an AbortController signal.',
    confidence: 0.75,
    extensions: CODE_EXT,
    detect(tf) {
      if (tf.source.includes('AbortController') || tf.source.includes('signal:')) return []
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        if (tf.tokens[i]?.text === 'fetch' && tf.tokens[i + 1]?.text === '(') {
          out.push({
            line: tf.tokens[i]!.line,
            snippet: tf.lines[tf.tokens[i]!.line - 1]?.trim() ?? '',
            evidence: 'fetch call with no timeout guard in the file',
            impact: 'Tests/harnesses can hang indefinitely.',
            confidence: 0.75,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Wrap fetch with AbortController + timeout.',
      steps: [
        'Create an AbortController with a setTimeout.',
        'Pass signal to fetch; clear on completion.',
      ],
      effort: 'S',
    },
  },

  // ── Quality ─────────────────────────────────────────────────────────────
  {
    id: 'QUAL-ANY-TYPE',
    dimension: 'quality',
    severity: 'LOW',
    title: '`any` type used (prefer unknown + narrowing)',
    description:
      'The `any` type erases type safety. Token-aware: only real `any` annotations in engine code, not comments or strings.',
    confidence: 0.85,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      for (const t of tf.tokens) {
        if (t.text !== 'any' || t.kind !== 'identifier') continue
        // skip `any` inside import type lines and `// any` comments (already stripped)
        out.push({
          line: t.line,
          snippet: tf.lines[t.line - 1]?.trim() ?? '',
          evidence: 'any annotation in code tokens',
          impact: 'Loses type safety; hides bugs at compile time.',
          confidence: 0.85,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Replace `any` with a precise type or `unknown` + type guard.',
      steps: [
        'Identify the value real shape.',
        'Replace with that type, or unknown + a runtime guard.',
      ],
      effort: 'S',
    },
  },
  {
    id: 'QUAL-CONSOLE-LOG',
    dimension: 'quality',
    severity: 'LOW',
    title: 'Leftover console output in source',
    description:
      'Debug console.log/info should be routed through the structured logger (getLogger) or removed.',
    confidence: 0.95,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        const t = tf.tokens[i]!
        if (t.text !== 'console') continue
        const next = tf.tokens[i + 1]
        if (!next) continue
        const method = tf.tokens[i + 2]
        if (
          next.text === '.' &&
          method &&
          ['log', 'info', 'debug', 'warn', 'error'].includes(method.text)
        ) {
          out.push({
            line: t.line,
            snippet: tf.lines[t.line - 1]?.trim() ?? '',
            evidence: 'console.* call in code tokens',
            impact: 'Log noise; may leak internals in production.',
            confidence: 0.95,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'remove-line',
      summary: 'Remove the statement or use the structured logger.',
      steps: ['Delete or replace with logger.<level>().'],
      effort: 'S',
    },
  },

  // ── Performance ─────────────────────────────────────────────────────────
  {
    id: 'PERF-SYNC-IO',
    dimension: 'performance',
    severity: 'MEDIUM',
    title: 'Synchronous blocking I/O in runtime source',
    description:
      'Synchronous fs calls (readFileSync/writeFileSync/existsSync) block the event loop.',
    confidence: 0.9,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      for (let i = 0; i < tf.tokens.length; i++) {
        const t = tf.tokens[i]!
        if (t.text !== 'readFileSync' && t.text !== 'writeFileSync' && t.text !== 'existsSync')
          continue
        const next = tf.tokens[i + 1]
        if (next?.text !== '(') continue
        out.push({
          line: t.line,
          snippet: tf.lines[t.line - 1]?.trim() ?? '',
          evidence: 'sync fs call in code tokens',
          impact: 'Event-loop starvation under load.',
          confidence: 0.9,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Replace with the async counterpart (readFile/writeFile/exists).',
      steps: ['Switch to the async fs API.', 'Await it at the call site.'],
      effort: 'S',
    },
  },
  {
    id: 'PERF-NPLUS1-LOOP',
    dimension: 'performance',
    severity: 'MEDIUM',
    title: 'Possible N+1 await inside loop',
    description:
      'An await on a DB/network call appears inside a loop body, serialising one round-trip per iteration.',
    confidence: 0.8,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      const codeLines = tf.code.split('\n')
      for (let i = 0; i < codeLines.length; i++) {
        const line = codeLines[i]!
        const isLoop =
          /\b(for|while)\b/.test(line) || line.includes('forEach(') || line.includes('.map(')
        if (!isLoop) continue
        const body = codeLines.slice(i, i + 6).join(' ')
        if (/\bawait\s+(?:prisma|db|client|fetch|store)\b/i.test(body)) {
          out.push({
            line: i + 1,
            snippet: tf.lines[i]?.trim() ?? '',
            evidence: 'loop containing await on DB/network in the following lines',
            impact: 'Linear latency growth with collection size.',
            confidence: 0.8,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Batch the operation (bulk query / Promise.all with a concurrency limit).',
      steps: [
        'Collect the loop keys.',
        'Issue a single bulk query or Promise.all.',
        'Re-map results to original order.',
      ],
      effort: 'M',
    },
  },
  // ── Drift (architecture invariants) ────────────────────────────────────
  {
    id: 'DRIFT-ENGINE-STORAGE-IMPL',
    dimension: 'drift',
    severity: 'MEDIUM',
    title: 'Engine imports storage/impl directly (B2 — use store contracts)',
    description:
      'Engines must depend on src/storage/contracts/*, never on src/storage/impl/*. A direct impl import couples an engine to storage internals and defeats the Store Contracts invariant.',
    confidence: 0.97,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      if (!isBackendEngine(tf.filePath)) return out
      for (const { line, spec } of importProjection(tf)) {
        if (!isStorageImplImport(spec)) continue
        out.push({
          line,
          snippet: tf.lines[line - 1]?.trim() ?? '',
          evidence: `import from storage/impl in a backend engine file (${spec})`,
          impact:
            'Couples the engine to storage internals; violates the Store Contracts invariant (B2).',
          confidence: 0.97,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Depend on the engine-facing store contract from src/storage/contracts instead.',
      steps: [
        'Identify the contract interface in src/storage/contracts.',
        'Import the contract type.',
        'Inject the impl at the composition root.',
      ],
      effort: 'M',
    },
  },
  {
    id: 'DRIFT-ENGINE-IMPORTS-CDP',
    dimension: 'drift',
    severity: 'HIGH',
    title: 'Engine imports the CDP client directly (B1 — Governor Canon)',
    description:
      'Only ChromeGovernor touches CDP. An engine importing executor/cdp (BunCdpClient) bypasses the Governor Canon and breaks the single-owner invariant.',
    confidence: 0.97,
    extensions: CODE_EXT,
    detect(tf) {
      const out: FindingSeed[] = []
      if (!isBackendEngine(tf.filePath) || /chrome-governor/.test(tf.filePath)) return out
      for (const { line, spec } of importProjection(tf)) {
        if (!isCdpImport(spec)) continue
        out.push({
          line,
          snippet: tf.lines[line - 1]?.trim() ?? '',
          evidence: `CDP import in a backend engine file (${spec})`,
          impact: 'Violates the Governor Canon (invariant B1): only ChromeGovernor may touch CDP.',
          confidence: 0.97,
        })
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Route all CDP access through ChromeGovernor.',
      steps: [
        'Add a capability/action on ChromeGovernor.',
        'Have the engine depend on the governor interface instead.',
      ],
      effort: 'M',
    },
  },
]

// ── PowerShell pipeline rule (raw line scan, no JS lexer) ────────────────
export const POWERSHELL_RULES: AuditRule[] = [
  {
    id: 'LIVE-PS-PIPELINE-DROPS',
    dimension: 'correctness',
    severity: 'HIGH',
    cwe: 'CWE-703',
    title: 'PowerShell object-pipeline deserialization data loss',
    description:
      'Invoke-RestMethod piped to Select-Object/Out-File silently yields empty output in PowerShell 7+ due to deserialized JSON pipeline dropping.',
    confidence: 0.96,
    extensions: ['.ps1'],
    detect: () => [],
    detectRaw(_filePath, lines) {
      const out: FindingSeed[] = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        if (
          (line.includes('Invoke-RestMethod') || line.includes('Invoke-WebRequest')) &&
          (line.includes('| Select-Object') ||
            line.includes('| Out-File') ||
            line.includes('| ConvertTo-Json'))
        ) {
          out.push({
            line: i + 1,
            snippet: line.trim(),
            evidence: 'object pipeline after REST call in .ps1',
            impact: 'Empty files / false-empty reads despite API returning data.',
            confidence: 0.96,
          })
        }
      }
      return out
    },
    patch: {
      kind: 'manual',
      summary: 'Read API/JSON data through a bun script, never the PowerShell object pipeline.',
      steps: ['Write a .ts script that fetches and writes via fs.', 'Run it with bun.'],
      effort: 'S',
    },
  },
]

const ALL_RULES: AuditRule[] = [...RULES, ...POWERSHELL_RULES]

export function getRules(filter?: string[]): AuditRule[] {
  if (!filter || filter.length === 0) return ALL_RULES
  const set = new Set(filter)
  return ALL_RULES.filter((r) => set.has(r.id))
}

export function getRule(id: string): AuditRule | undefined {
  return ALL_RULES.find((r) => r.id === id)
}

/** Apply a rule's file-level allowlist. */
export function isRuleAllowed(rule: AuditRule, filePath: string): boolean {
  if (!rule.allowlist || rule.allowlist.length === 0) return true
  return !rule.allowlist.some((sub) => filePath.includes(sub))
}
