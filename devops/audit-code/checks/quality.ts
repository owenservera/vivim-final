// devops/audit-code/checks/quality.ts
// Quality dimension: `any` types in engines (D2) and leftover console logging.

import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, scanForPattern } from '../scan.ts'

const ANY_RE = /\bany\b/
const CONSOLE_RE = /\bconsole\.(log|debug|info)\s*\(/

export async function checkQuality(): Promise<Finding[]> {
  const out: Finding[] = []

  // `any` in engine code (D2 -> P2). Exclude type-import lines and comments.
  const anys = await scanForPattern(PROJECT_ROOT, ['src/engines'], ANY_RE)
  for (const m of anys) {
    if (m.text.includes('//') && m.text.trim().startsWith('//')) continue
    if (/import\s+type/.test(m.text)) continue
    out.push(
      buildFinding({
        priority: 'P2',
        dimension: 'quality',
        invariant: 'D2',
        title: '`any` type used in engine',
        description: 'Engines should avoid `any`; use `unknown` + narrowing or a concrete type.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Loses type safety; hides bugs at compile time.',
        fixSummary: 'Replace `any` with a precise type or `unknown` + type guard.',
        fixSteps: [
          'Identify the value’s real shape.',
          'Replace `any` with that type, or `unknown` + a runtime guard.',
        ],
        effort: 'S',
        autoFixable: false,
      }),
    )
  }

  // Leftover console.log in source (P3 hygiene).
  const logs = await scanForPattern(PROJECT_ROOT, ['src'], CONSOLE_RE)
  for (const m of logs) {
    out.push(
      buildFinding({
        priority: 'P3',
        dimension: 'quality',
        title: 'Leftover console output in source',
        description: 'Debug console.log/debug/info should be removed or routed through the logger.',
        file: m.rel,
        line: m.line,
        evidence: m.text,
        impact: 'Log noise; may leak internals in production.',
        fixSummary: 'Remove the statement or use the structured logger.',
        fixSteps: ['Delete or replace with logger.<level>().'],
        effort: 'S',
        autoFixable: true,
        patchSuggestion: '// remove this line',
      }),
    )
  }

  return out
}
