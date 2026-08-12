// src/engines/code-audit/taint.ts
// Lightweight cross-statement data-flow taint tracking. Produces real
// TaintFlow objects (source → sink with a step path) for findings that touch
// exec/spawn/eval/query sinks, and flags flow into dynamic code-execution
// sinks specifically.

import type { Finding, TaintFlow, TaintStep } from './types.js'

interface SourcePattern {
  name: string
  regex: RegExp
}

interface SinkPattern {
  name: string
  regex: RegExp
  detect: (line: string) => boolean
}

const SOURCE_PATTERNS: SourcePattern[] = [
  { name: 'request body', regex: /req\.body|request\.body|RequestBody|searchParams|params\b|req\.query|body\b/ },
  { name: 'environment', regex: /process\.env|Bun\.env/ },
  { name: 'user input', regex: /userInput|user_input|prompt|cli\s+arg|argv|commandLine/ },
  { name: 'network response', regex: /fetch\(|\.json\(\)|response\.text\(|res\.body/ },
  { name: 'external file', regex: /readFile|readFileSync|createReadStream|\.env\.parse/ },
]

const SINK_PATTERNS: SinkPattern[] = [
  {
    name: 'shell execution',
    regex: /(?<!\.)\b(exec|spawn|execFile|execSync|execFileSync|fork|child_process)\s*\(/,
    detect: (l) => /(?<!\.)\b(exec|spawn|execFile|execSync|execFileSync)\s*\(/.test(l),
  },
  {
    name: 'dynamic code exec',
    regex: /(?<!\.)\b(eval|new\s+Function|Function\s*\()/,
    detect: (l) => /(?<!\.)\beval\s*\(|\bnew\s+Function\b/.test(l),
  },
  {
    name: 'raw database query',
    regex: /\b(queryRawUnsafe|executeRawUnsafe|queryUnsafe|executeUnsafe)\s*\(|\.raw\s*\(/,
    detect: (l) => /\b(queryRawUnsafe|executeRawUnsafe|queryUnsafe|executeUnsafe)\s*\(|\.raw\s*\(/.test(l),
  },
]

export interface TaintReport {
  flows: TaintFlow[]
  dynamicExecFlows: TaintFlow[]
}

function blankNonCode(line: string): string {
  return line
    .replace(/'.*?'/g, ' ')
    .replace(/".*?"/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\/\/.*$/g, ' ')
}

/** Track tainted variables across a statement block and record flows. */
export function analyzeTaint(
  filePath: string,
  codeLines: string[],
  rawLines: string[],
  window = 8,
): TaintReport {
  const flows: TaintFlow[] = []
  const dynamicExecFlows: TaintFlow[] = []
  // line -> Set of tainted variable names (1-based line numbers)
  const taint: Map<number, Set<string>> = new Map()

  const varNameRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/
  const memberNameRe = /\b([A-Za-z_$][\w$]*)\s*=\s*(?:body|query|params|searchParams|env|argv|process\.env\.\w+)/

  for (let idx = 0; idx < codeLines.length; idx++) {
    const lineNo = idx + 1
    const raw = blankNonCode(rawLines[idx] ?? '')
    const current = new Set<string>(taint.get(lineNo) ?? [])

    // 1. New taint sources on this line.
    for (const s of SOURCE_PATTERNS) {
      if (s.regex.test(raw)) {
        // A fresh variable being assigned from a source.
        const vm = varNameRe.exec(raw)
        if (vm) {
          current.add(vm[1]!)
          continue
        }
        const mm = memberNameRe.exec(raw)
        if (mm) current.add(mm[1]!)
      }
    }

    // 2. Sinks: if this line references any tainted var (or is itself a source
    //    line) AND hits a sink pattern, record the flow. The taint reference is
    //    tested against the ORIGINAL line so interpolations inside template
    //    literals (`${body}`) are still caught after blanking.
    const rawCode = rawLines[idx] ?? ''
    const hasTaintedRef = [...current].some((name) => new RegExp(`\\b${name}\\b`).test(rawCode))
    for (const sink of SINK_PATTERNS) {
      if (!sink.detect(raw)) continue
      const isDynamicCode = sink.name === 'dynamic code exec'
      const sourceHit = SOURCE_PATTERNS.find((s) => s.regex.test(raw))
      if (hasTaintedRef || sourceHit) {
        const path: TaintStep[] = [
          {
            step: 1,
            location: { filePath, lineNumber: lineNo, snippet: raw.trim() },
            description: `Tainted value (${sourceHit?.name ?? 'inherited variable'}) reaches ${sink.name} sink`,
          },
        ]
        const flow: TaintFlow = {
          source: { filePath, lineNumber: lineNo, snippet: raw.trim() },
          sink: { filePath, lineNumber: lineNo, snippet: raw.trim() },
          path,
        }
        flows.push(flow)
        if (isDynamicCode) dynamicExecFlows.push(flow)
      }
    }

    // 3. Propagate taint forward within the window.
    if (current.size > 0) {
      for (let j = 1; j <= window; j++) {
        const nextLine = lineNo + j
        const nextSet = taint.get(nextLine) ?? new Set<string>()
        for (const name of current) nextSet.add(name)
        taint.set(nextLine, nextSet)
      }
    }
    taint.set(lineNo, current)
  }

  return { flows, dynamicExecFlows }
}

/**
 * Attach taint metadata to findings whose snippet hits a dynamic sink.
 * Returns the set of findings annotated with a TaintFlow (mutates in place).
 */
export function attachTaint(findings: Finding[]): Finding[] {
  for (const f of findings) {
    const snippet = f.location.snippet ?? ''
    const code = blankNonCode(snippet)
    const isDynamic = /(?<!\.)\beval\s*\(|\bnew\s+Function\b/.test(code)
    if (!isDynamic) continue
    const step: TaintStep = {
      step: 1,
      location: f.location,
      description: `Potential tainted input at ${f.ruleId} sink`,
    }
    const flow: TaintFlow = {
      source: f.location,
      sink: f.location,
      path: [step],
    }
    f.taintFlow = flow
  }
  return findings
}
