// devops/speckit-converge-bridge.ts
// Unified converge pipeline: spec gap analysis + code audit + architecture audit.
// Produces a single combined report and appends P0/P1 findings as convergence tasks.

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ────────────────────────────────────────────────────

export type FindingPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface SpecGap {
  type: 'missing' | 'partial' | 'contradicts' | 'unrequested'
  description: string
  tracedTo?: string
}

export interface CodeFinding {
  id: string
  priority: FindingPriority
  title: string
  file: string
  line: number
  fix: string
}

export interface ArchFinding {
  id: string
  priority: FindingPriority
  dimension: string
  title: string
  modules: string[]
  fix: string
}

export interface ConvergeReport {
  featureDir: string
  specGaps: SpecGap[]
  codeFindings: CodeFinding[]
  archFindings: ArchFinding[]
  tasksAppended: number
  timestamp: string
  errors: string[]
}

// ── Command execution ────────────────────────────────────────

function execCommand(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })

    proc.on('error', () => {
      resolve({ exitCode: 1, stdout: '', stderr: `Failed to execute: ${command}` })
    })
  })
}

// ── Spec gap analysis ────────────────────────────────────────

async function analyzeSpecGaps(featureDir: string): Promise<SpecGap[]> {
  const gaps: SpecGap[] = []

  const specPath = join(process.cwd(), featureDir, 'spec.md')
  const planPath = join(process.cwd(), featureDir, 'plan.md')
  const tasksPath = join(process.cwd(), featureDir, 'tasks.md')

  // Check if spec exists
  if (!existsSync(specPath)) {
    gaps.push({
      type: 'missing',
      description: 'spec.md not found — run /speckit.specify first',
    })
    return gaps
  }

  // Check if plan exists
  if (!existsSync(planPath)) {
    gaps.push({
      type: 'missing',
      description: 'plan.md not found — run /speckit.plan first',
      tracedTo: 'spec.md',
    })
  }

  // Check if tasks exist
  if (!existsSync(tasksPath)) {
    gaps.push({
      type: 'missing',
      description: 'tasks.md not found — run /speckit.tasks first',
      tracedTo: 'plan.md',
    })
  }

  // Parse spec for user stories
  if (existsSync(specPath)) {
    const specContent = await readFile(specPath, 'utf8')
    const userStoryMatches = specContent.match(/### US\d+/g) ?? []
    const taskContent = existsSync(tasksPath) ? await readFile(tasksPath, 'utf8') : ''
    const taskCount = (taskContent.match(/^- \[ \] T\d+/g) ?? []).length

    // Simple heuristic: if spec has many user stories but few tasks, there's a gap
    if (userStoryMatches.length > 5 && taskCount < userStoryMatches.length) {
      gaps.push({
        type: 'partial',
        description: `Spec has ${userStoryMatches.length} user stories but only ${taskCount} pending tasks`,
        tracedTo: 'spec.md',
      })
    }
  }

  return gaps
}

// ── Code audit ───────────────────────────────────────────────

async function runCodeAudit(): Promise<{ findings: CodeFinding[]; error?: string }> {
  try {
    const result = await execCommand('bun', ['run', 'devops', 'audit-code', 'standard', '--json'])

    if (result.exitCode !== 0 && !result.stdout) {
      return { findings: [], error: result.stderr || 'Audit code failed' }
    }

    // Parse JSON output
    try {
      // Extract JSON from output (may have non-JSON prefix)
      const jsonStart = result.stdout.indexOf('{')
      if (jsonStart === -1) {
        return { findings: [], error: 'No JSON output from audit-code' }
      }

      const parsed = JSON.parse(result.stdout.slice(jsonStart))
      const findings: CodeFinding[] = []

      // Map audit findings to CodeFinding format
      if (parsed.findings && Array.isArray(parsed.findings)) {
        for (const f of parsed.findings) {
          findings.push({
            id: f.id ?? `AU-${String(findings.length + 1).padStart(4, '0')}`,
            priority: f.severity ?? 'P2',
            title: f.title ?? f.message ?? 'Unknown finding',
            file: f.file ?? f.location?.file ?? '',
            line: f.line ?? f.location?.line ?? 0,
            fix: f.suggestion ?? f.fix ?? 'Review and fix',
          })
        }
      }

      return { findings }
    } catch {
      return { findings: [], error: 'Failed to parse audit-code output' }
    }
  } catch (e) {
    return { findings: [], error: `Audit code error: ${(e as Error).message}` }
  }
}

// ── Architecture audit ───────────────────────────────────────

async function runArchAudit(): Promise<{ findings: ArchFinding[]; error?: string }> {
  try {
    const result = await execCommand('bun', ['run', 'devops', 'audit-arch', 'surface', '--json'])

    if (result.exitCode !== 0 && !result.stdout) {
      return { findings: [], error: result.stderr || 'Audit arch failed' }
    }

    // Parse JSON output
    try {
      const jsonStart = result.stdout.indexOf('{')
      if (jsonStart === -1) {
        return { findings: [], error: 'No JSON output from audit-arch' }
      }

      const parsed = JSON.parse(result.stdout.slice(jsonStart))
      const findings: ArchFinding[] = []

      if (parsed.findings && Array.isArray(parsed.findings)) {
        for (const f of parsed.findings) {
          findings.push({
            id: f.id ?? `AR-${String(findings.length + 1).padStart(4, '0')}`,
            priority: f.severity ?? 'P2',
            dimension: f.dimension ?? 'unknown',
            title: f.title ?? f.message ?? 'Unknown finding',
            modules: f.modules ?? [],
            fix: f.suggestion ?? f.fix ?? 'Review and fix',
          })
        }
      }

      return { findings }
    } catch {
      return { findings: [], error: 'Failed to parse audit-arch output' }
    }
  } catch (e) {
    return { findings: [], error: `Audit arch error: ${(e as Error).message}` }
  }
}

// ── Task appending ───────────────────────────────────────────

function findHighestTaskId(tasksContent: string): number {
  const matches = tasksContent.match(/T(\d+)/g) ?? []
  let max = 0
  for (const m of matches) {
    const num = Number(m.slice(1))
    if (num > max) max = num
  }
  return max
}

function appendTasksToMd(
  tasksContent: string,
  codeFindings: CodeFinding[],
  archFindings: ArchFinding[],
): { content: string; appended: number } {
  const lines = tasksContent.split('\n')
  let nextTaskId = findHighestTaskId(tasksContent) + 1
  let appended = 0

  // Find if convergence phase already exists
  let convergencePhaseIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes('## Phase') && lines[i]!.includes('Convergence')) {
      convergencePhaseIndex = i
      break
    }
  }

  // Build new tasks
  const newTasks: string[] = []

  // P0/P1 code findings
  const highPriorityCode = codeFindings.filter((f) => f.priority === 'P0' || f.priority === 'P1')
  if (highPriorityCode.length > 0) {
    newTasks.push('')
    newTasks.push('### Code Quality (from audit-code)')
    newTasks.push('')
    for (const finding of highPriorityCode) {
      const taskId = `T${String(nextTaskId++).padStart(3, '0')}`
      newTasks.push(`- [ ] ${taskId} [P] Fix ${finding.priority}: ${finding.title} → \`${finding.file}:${finding.line}\` — ${finding.fix}`)
      newTasks.push(`  <!-- source=audit-code id=${finding.id} priority=${finding.priority} -->`)
      appended++
    }
  }

  // P0/P1 architecture findings
  const highPriorityArch = archFindings.filter((f) => f.priority === 'P0' || f.priority === 'P1')
  if (highPriorityArch.length > 0) {
    newTasks.push('')
    newTasks.push('### Architecture (from audit-arch)')
    newTasks.push('')
    for (const finding of highPriorityArch) {
      const taskId = `T${String(nextTaskId++).padStart(3, '0')}`
      newTasks.push(`- [ ] ${taskId} Fix ${finding.priority}: ${finding.title} — ${finding.fix}`)
      newTasks.push(`  <!-- source=audit-arch id=${finding.id} priority=${finding.priority} -->`)
      appended++
    }
  }

  if (newTasks.length === 0) {
    return { content: tasksContent, appended: 0 }
  }

  // Find end of file or append after last phase
  const insertIndex = lines.length

  // Build convergence section
  const convergenceSection = [
    '',
    '---',
    '',
    `## Phase ${Math.floor(lines.length / 50) + 1}: Convergence`,
    ...newTasks,
    '',
  ]

  lines.splice(insertIndex, 0, ...convergenceSection)

  return { content: lines.join('\n'), appended }
}

// ── Report generation ────────────────────────────────────────

function generateConvergeReport(report: ConvergeReport): string {
  const lines: string[] = []

  lines.push(`# Converge Report: ${report.featureDir}`)
  lines.push('')
  lines.push(`Generated: ${report.timestamp}`)
  lines.push('')

  // Summary
  const totalFindings = report.specGaps.length + report.codeFindings.length + report.archFindings.length
  const p0Count = [...report.codeFindings, ...report.archFindings].filter((f) => f.priority === 'P0').length
  const p1Count = [...report.codeFindings, ...report.archFindings].filter((f) => f.priority === 'P1').length

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Total findings: ${totalFindings}`)
  lines.push(`- P0 findings: ${p0Count}`)
  lines.push(`- P1 findings: ${p1Count}`)
  lines.push(`- Tasks appended: ${report.tasksAppended}`)
  lines.push('')

  // Spec gaps
  if (report.specGaps.length > 0) {
    lines.push('## Spec Gaps')
    lines.push('')
    for (const gap of report.specGaps) {
      lines.push(`- [${gap.type}] ${gap.description}${gap.tracedTo ? ` (traced to ${gap.tracedTo})` : ''}`)
    }
    lines.push('')
  }

  // Code findings (P0/P1 first)
  const sortedCode = [...report.codeFindings].sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4)
  })

  if (sortedCode.length > 0) {
    lines.push('## Code Findings')
    lines.push('')
    for (const f of sortedCode) {
      lines.push(`### ${f.priority}: ${f.title}`)
      lines.push(`- **File:** ${f.file}:${f.line}`)
      lines.push(`- **Fix:** ${f.fix}`)
      lines.push(`- **ID:** ${f.id}`)
      lines.push('')
    }
  }

  // Architecture findings
  const sortedArch = [...report.archFindings].sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 }
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4)
  })

  if (sortedArch.length > 0) {
    lines.push('## Architecture Findings')
    lines.push('')
    for (const f of sortedArch) {
      lines.push(`### ${f.priority}: ${f.title}`)
      lines.push(`- **Dimension:** ${f.dimension}`)
      lines.push(`- **Modules:** ${f.modules.join(', ')}`)
      lines.push(`- **Fix:** ${f.fix}`)
      lines.push(`- **ID:** ${f.id}`)
      lines.push('')
    }
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const err of report.errors) {
      lines.push(`- ${err}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Main converge function ───────────────────────────────────

export async function unifiedConverge(featureDir: string): Promise<ConvergeReport> {
  const report: ConvergeReport = {
    featureDir,
    specGaps: [],
    codeFindings: [],
    archFindings: [],
    tasksAppended: 0,
    timestamp: new Date().toISOString(),
    errors: [],
  }

  // 1. Run spec gap analysis
  try {
    report.specGaps = await analyzeSpecGaps(featureDir)
  } catch (e) {
    report.errors.push(`Spec analysis failed: ${(e as Error).message}`)
  }

  // 2. Run code audit
  const codeResult = await runCodeAudit()
  report.codeFindings = codeResult.findings
  if (codeResult.error) {
    report.errors.push(`Code audit: ${codeResult.error}`)
  }

  // 3. Run architecture audit
  const archResult = await runArchAudit()
  report.archFindings = archResult.findings
  if (archResult.error) {
    report.errors.push(`Arch audit: ${archResult.error}`)
  }

  // 4. Append P0/P1 findings as tasks
  const tasksPath = join(process.cwd(), featureDir, 'tasks.md')
  if (existsSync(tasksPath)) {
    try {
      const tasksContent = await readFile(tasksPath, 'utf8')
      const { content: newContent, appended } = appendTasksToMd(
        tasksContent,
        report.codeFindings,
        report.archFindings,
      )

      if (appended > 0) {
        await writeFile(tasksPath, newContent, 'utf8')
        report.tasksAppended = appended
      }
    } catch (e) {
      report.errors.push(`Task append failed: ${(e as Error).message}`)
    }
  } else {
    report.errors.push('tasks.md not found — cannot append convergence tasks')
  }

  // 5. Write consolidated report
  const auditsDir = join(process.cwd(), 'docs', 'audits')
  if (!existsSync(auditsDir)) {
    await mkdir(auditsDir, { recursive: true })
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const featureName = featureDir.split('/').pop() ?? 'unknown'
  const reportPath = join(auditsDir, `CONVERGE-${featureName}-${dateStr}.md`)

  await writeFile(reportPath, generateConvergeReport(report), 'utf8')

  return report
}
