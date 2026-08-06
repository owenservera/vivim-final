// devops/deep-scan/passes/hot-path.ts
// P06 extra performance heuristics: hot-path signals the base audit does not
// cover — deeply nested awaits in a chain (serialization risk) and unbounded
// buffer accumulation in loops. Deterministic + local only.

import { buildFinding, type Finding } from '../../audit-code/findings.ts'
import { PROJECT_ROOT, readLines, scanForPattern } from '../../audit-code/scan.ts'

// A loop line whose body appends to an array / string / buffer without a
// length cap (unbounded memory growth).
const LOOP_LINE_RE = /^\s*(?:for\s*\(|while\s*\(|\.forEach\s*\(|\.map\s*\()/
const PUSH_RE = /\.push\s*\(/

// Serialized awaits: 4+ consecutive lines starting with `await` (data pipeline
// that could run concurrently or be batched).
const AWAIT_LINE_RE = /^\s*await\s+/

export async function checkHotPathPerf(): Promise<Finding[]> {
  const out: Finding[] = []

  const loopMatches = await scanForPattern(PROJECT_ROOT, ['src'], LOOP_LINE_RE)
  const byFile = new Map<string, typeof loopMatches>()
  for (const m of loopMatches) {
    const arr = byFile.get(m.file) ?? []
    arr.push(m)
    byFile.set(m.file, arr)
  }

  for (const [file, loops] of byFile) {
    const lines = await readLines(file)
    for (const loop of loops) {
      // Look a bounded window after the loop line for a push/concat without cap.
      for (let j = loop.line; j < Math.min(loop.line + 6, lines.length); j++) {
        if (PUSH_RE.test(lines[j]!)) {
          out.push(
            buildFinding({
              priority: 'P2',
              dimension: 'performance',
              title: 'Unbounded buffer accumulation in loop',
              description: 'A loop appends to a collection with no cap; memory grows linearly with input size.',
              file: loop.rel,
              line: loop.line,
              evidence: lines[j]!.trim(),
              impact: 'Memory blow-up on large inputs.',
              fixSummary: 'Bound the buffer or stream results instead of accumulating.',
              fixSteps: ['Add a cap / early exit.', 'Stream or batch results.'],
              effort: 'S',
              autoFixable: false,
            }),
          )
          break
        }
      }
    }
  }

  // Serialized await chains (4+ consecutive awaits) — batching opportunity.
  const awaitMatches = await scanForPattern(PROJECT_ROOT, ['src'], AWAIT_LINE_RE)
  const byFileAwait = new Map<string, typeof awaitMatches>()
  for (const m of awaitMatches) {
    const arr = byFileAwait.get(m.file) ?? []
    arr.push(m)
    byFileAwait.set(m.file, arr)
  }
  for (const [, arr] of byFileAwait) {
    let run = 0
    let start = 0
    for (let i = 0; i <= arr.length; i++) {
      if (i < arr.length && arr[i]!.line === start + run + 1) {
        run += 1
        if (run === 1) start = arr[i]!.line - 1
      } else {
        if (run >= 4) {
          const m = arr[i - 1]!
          out.push(
            buildFinding({
              priority: 'P2',
              dimension: 'performance',
              title: 'Serialized await chain (4+ consecutive)',
              description: 'A run of consecutive awaits serializes round-trips that could be batched or run concurrently.',
              file: m.rel,
              line: m.line,
              evidence: `${run} consecutive await lines`,
              impact: 'Added latency proportional to chain length.',
              fixSummary: 'Batch the calls or use Promise.all with a concurrency limit.',
              fixSteps: ['Identify the awaited calls.', 'Combine into a bulk call or Promise.all.'],
              effort: 'M',
              autoFixable: false,
            }),
          )
        }
        run = i < arr.length ? 1 : 0
        start = i < arr.length ? arr[i]!.line - 1 : 0
      }
    }
  }

  return out
}
