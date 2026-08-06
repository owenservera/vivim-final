// devops/deep-scan/passes/async-correctness.ts
// P05 extra correctness heuristics: floated/unawaited async calls inside
// non-void functions and `!.` non-null assertions that can hide race/null bugs.
// Deterministic + local only.

import { buildFinding, type Finding } from '../../audit-code/findings.ts'
import { PROJECT_ROOT, scanForPattern } from '../../audit-code/scan.ts'

const FIRE_AND_FORGET_RE = /\bawait\s+(?:new\s+)?Promise\s*\(?|\.then\s*\(\s*[^)]*?\s*\)\s*;?\s*$/
const NON_NULL_RE = /[a-zA-Z0-9_)\]]\s*!\s*\./

export async function checkAsyncCorrectness(): Promise<Finding[]> {
  const out: Finding[] = []

  // Promise constructors inside engines (error-prone executor patterns).
  const fireForget = await scanForPattern(PROJECT_ROOT, ['src/engines'], FIRE_AND_FORGET_RE)
  for (const m of fireForget) {
    out.push(
      buildFinding({
        priority: 'P1',
        dimension: 'correctness',
        title: 'Unawaited / fire-and-forget async in engine',
        description: 'A promise may be created without being awaited or caught, producing unhandled rejections.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Unhandled promise rejections can crash or silently drop work.',
        fixSummary: 'Await the promise or attach .catch() and propagate errors.',
        fixSteps: ['Add await at the call site.', 'Attach a .catch() that logs + re-throws or notifies.'],
        effort: 'S',
        autoFixable: false,
      }),
    )
  }

  // Non-null assertion `!` following an expression (can mask a null/undefined
  // that later throws) — flag dense occurrences in engines.
  const nonNull = await scanForPattern(PROJECT_ROOT, ['src/engines'], NON_NULL_RE)
  const perFile = new Map<string, number>()
  for (const m of nonNull) {
    perFile.set(m.rel, (perFile.get(m.rel) ?? 0) + 1)
  }
  for (const [rel, count] of perFile) {
    if (count < 5) continue // only dense usage becomes a finding
    out.push(
      buildFinding({
        priority: 'P2',
        dimension: 'correctness',
        title: `High use of non-null assertions: ${rel} (${count})`,
        description: 'Frequent `!` assertions can mask null/undefined states that only fail at runtime.',
        file: rel,
        line: 1,
        evidence: `${count} non-null assertions`,
        impact: 'Latent null crashes; the assertion is unchecked by the type system.',
        fixSummary: 'Narrow types with runtime checks instead of `!`.',
        fixSteps: ['Identify the asserts with real null risk.', 'Use a type guard or narrowing before access.'],
        effort: 'M',
        autoFixable: false,
      }),
    )
  }

  return out
}