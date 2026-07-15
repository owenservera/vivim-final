// devops/audit-code/checks/correctness.ts
// Correctness dimension: swallowed errors, raw Error in engines (B7), dead code.

import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, SRC_DIRS, scanForPattern } from '../scan.ts'

// Empty / no-op catch blocks (swallowed exceptions).
const SWALLOWED_RE = /\bcatch\s*\([^)]*\)\s*\{\s*(?:\/\/.*)?\s*\}/

// Raw `new Error(...)` inside engine code (B7 — use custom error classes).
const RAW_ERROR_RE = /\bnew\s+Error\s*\(/

// `return` or `throw` followed by unreachable code on the next line.
const DEAD_CODE_RE = /^\s*(?:return|throw)\b.*$/ 

export async function checkCorrectness(): Promise<Finding[]> {
  const out: Finding[] = []

  // 1. Swallowed errors
  const swallowed = await scanForPattern(PROJECT_ROOT, SRC_DIRS, SWALLOWED_RE)
  for (const m of swallowed) {
    out.push(
      buildFinding({
        priority: 'P1',
        dimension: 'correctness',
        title: 'Swallowed exception (empty catch)',
        description: 'An empty catch block discards an error with no logging or re-throw, hiding failures.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Failures become silent; root causes are hard to diagnose.',
        fixSummary: 'Log the error (with context) before the catch closes, or re-throw.',
        fixSteps: [
          'Add a contextual log line inside the catch (logError with the operation name).',
          'If the error is truly expected, document why and record a metric.',
          'Never leave a catch with no side effect.',
        ],
        effort: 'S',
        autoFixable: false,
      }),
    )
  }

  // 2. Raw `new Error` inside engines (B7)
  const rawErrors = await scanForPattern(PROJECT_ROOT, ['src/engines'], RAW_ERROR_RE)
  for (const m of rawErrors) {
    out.push(
      buildFinding({
        priority: 'P1',
        dimension: 'correctness',
        invariant: 'B7',
        title: 'Raw Error in engine (B7)',
        description: 'Engines must throw custom error classes from src/errors.ts, not generic Error.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Callers cannot discriminate error types; breaks the Result<T,E> pattern.',
        fixSummary: 'Replace with a domain error class from src/errors.ts.',
        fixSteps: [
          'Import the appropriate custom error from src/errors.ts.',
          'Throw that class instead of `new Error(...)`.',
          'Keep the message descriptive and include context.',
        ],
        effort: 'S',
        autoFixable: false,
        linkedUnit: '11.x',
      }),
    )
  }

  // 3. Dead code after return/throw (cheap heuristic: consecutive return/throw lines)
  const dead = await scanForPattern(PROJECT_ROOT, ['src'], DEAD_CODE_RE)
  // Pairwise: if two consecutive lines both start with return/throw, the first is suspicious
  // only when identical-ish; to avoid noise we flag a return immediately followed by another
  // return/throw on the next line.
  const byFile = new Map<string, typeof dead>()
  for (const m of dead) {
    const arr = byFile.get(m.file) ?? []
    arr.push(m)
    byFile.set(m.file, arr)
  }
  for (const [, arr] of byFile) {
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i]!.line + 1 === arr[i + 1]!.line) {
        const m = arr[i + 1]!
        out.push(
          buildFinding({
            priority: 'P1',
            dimension: 'correctness',
            title: 'Unreachable code after return/throw',
            description: 'A return/throw is immediately followed by another return/throw, so the second is never reached.',
            file: m.rel,
            line: m.line,
            evidence: m.text,
            impact: 'Dead code; signals a logic error or copy-paste mistake.',
            fixSummary: 'Remove the unreachable statement or fix the control flow.',
            fixSteps: [
              'Confirm the intended branch.',
              'Delete the unreachable line.',
            ],
            effort: 'S',
            autoFixable: false,
          }),
        )
        i++ // skip the next to avoid double-flagging
      }
    }
  }

  return out
}
