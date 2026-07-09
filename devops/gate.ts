// devops/gate.ts
// Run the quality gate: typecheck + lint + tests.
// Passes only when all three succeed. Structured result for the loop.
//
// Strict mode (`bun run devops gate --strict`) additionally fails when the
// repo-wide lint emits ANY error or warning that touches a file changed in
// the current unit. This stops warning debt from accumulating in files the
// agent is actively editing, without blocking on pre-existing debt elsewhere.

import { spawn, spawnSync } from 'node:child_process'
import { getChangedFiles } from './changed.ts'

interface GateStep {
  name: string
  code: number
  ok: boolean
  out: string
}

interface GateResult {
  pass: boolean
  steps: GateStep[]
  summary: string
  strict?: { ok: boolean; newIssues: string[] }
}

function run(cmd: string, args: string[]): Promise<GateStep> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: process.cwd() })
    let out = ''
    const sink = (d: Buffer) => {
      out += d.toString()
    }
    proc.stdout?.on('data', sink)
    proc.stderr?.on('data', sink)
    proc.on('close', (code) => {
      resolve({ name: args.join(' '), code: code ?? 1, ok: code === 0, out })
    })
  })
}

// Returns the list of lint diagnostics (error|warn) that fall on changed files.
function newIssuesInChangedFiles(): string[] {
  const changed = new Set(getChangedFiles())
  if (changed.size === 0) return []
  // biome exits non-zero when it finds issues, but still prints JSON to stdout.
  // Use spawnSync so we capture stdout regardless of the exit code.
  const res = spawnSync('bunx', ['@biomejs/biome', 'check', '--reporter=json', ...changed], {
    encoding: 'utf8',
  })
  const json = res.stdout ?? ''
  // biome may print a non-JSON prefix; extract the JSON object.
  const start = json.indexOf('{')
  if (start === -1) return []
  let parsed: {
    diagnostics?: Array<{
      category?: string
      severity?: string
      location?: { path?: { file?: string } }
    }>
  }
  try {
    parsed = JSON.parse(json.slice(start))
  } catch {
    return []
  }
  const issues: string[] = []
  for (const d of parsed.diagnostics ?? []) {
    const file = d.location?.path?.file
    if (file && changed.has(file.replace(/\\/g, '/'))) {
      issues.push(`${d.severity ?? 'issue'}: ${file} (${d.category ?? '?'})`)
    }
  }
  return issues
}

export async function runGate(strict = false): Promise<GateResult> {
  const steps: GateStep[] = []
  steps.push(await run('bun', ['run', 'typecheck']))
  steps.push(await run('bun', ['run', 'lint']))
  steps.push(await run('bun', ['test']))
  const pass = steps.every((s) => s.ok)

  let strictResult: GateResult['strict']
  if (strict) {
    const newIssues = newIssuesInChangedFiles()
    strictResult = { ok: newIssues.length === 0, newIssues }
  }

  const strictFailed = strictResult && !strictResult.ok
  const ok = pass && !strictFailed
  const summary = steps.map((s) => `${s.ok ? 'PASS' : 'FAIL'} ${s.name}`).join(' | ')
  const extra = strictFailed ? ' | STRICT FAIL new lint issues in changed files' : ''
  return { pass: ok, steps, summary: summary + extra, strict: strictResult }
}
