// devops/audit-code/checks/performance.ts
// Performance dimension: N+1 loops (await inside a for-loop) and sync blocking
// I/O in the runtime source.

import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, readLines, scanForPattern } from '../scan.ts'

// `for`/`.forEach`/`.map` line immediately followed (within 2 lines) by an `await`
// on what looks like a DB / network call inside the loop body.
const LOOP_LINE_RE = /^\s*(?:for\s*\(|while\s*\(|\.forEach\s*\(|\.map\s*\()/
const AWAIT_IN_LOOP_RE = /^\s*await\s+(?:prisma|db|client|fetch|store)\b/i

export async function checkPerformance(): Promise<Finding[]> {
  const out: Finding[] = []

  // N+1: scan src; for each file read lines and detect loop line followed by await within 3 lines.
  const files = await scanForPattern(PROJECT_ROOT, ['src'], LOOP_LINE_RE)
  const byFile = new Map<string, typeof files>()
  for (const f of files) {
    const arr = byFile.get(f.file) ?? []
    arr.push(f)
    byFile.set(f.file, arr)
  }
  const fs = await import('node:fs/promises')
  for (const [file, loops] of byFile) {
    const text = await readLines(file)
    for (const loop of loops) {
      let found = false
      for (let j = loop.line; j < Math.min(loop.line + 4, text.length); j++) {
        if (AWAIT_IN_LOOP_RE.test(text[j]!)) {
          found = true
          break
        }
      }
      if (found) {
        out.push(
          buildFinding({
            priority: 'P2',
            dimension: 'performance',
            title: 'Possible N+1 query in loop',
            description: 'An `await` on a DB/network call appears inside a loop body, which serialises one round-trip per iteration.',
            file: loop.rel,
            line: loop.line,
            evidence: text[loop.line - 1]?.trim() ?? '',
            impact: 'Linear latency growth with collection size; can time out at scale.',
            fixSummary: 'Batch the operation (bulk query / Promise.all with a concurrency limit).',
            fixSteps: [
              'Collect the loop keys into an array.',
              'Issue a single bulk query or Promise.all over the batch.',
              'Re-map results back to the original order.',
            ],
            effort: 'M',
            autoFixable: false,
          }),
        )
      }
    }
  }

  // Synchronous blocking I/O in src runtime (readFileSync / writeFileSync).
  const sync = await scanForPattern(PROJECT_ROOT, ['src'], /\b(readFileSync|writeFileSync|existsSync)\s*\(/)
  for (const m of sync) {
    out.push(
      buildFinding({
        priority: 'P2',
        dimension: 'performance',
        title: 'Synchronous blocking I/O in runtime',
        description: 'Synchronous fs calls block the event loop and harm throughput.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Event-loop starvation under load.',
        fixSummary: 'Replace with the async counterpart (readFile/writeFile/exists).',
        fixSteps: ['Switch to the async fs API.', 'Await it at the call site.'],
        effort: 'S',
        autoFixable: false,
      }),
    )
  }

  return out
}
