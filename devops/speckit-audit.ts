// devops/speckit-audit.ts
// Audit all DevOps skills for SpecKit integration readiness.
// Produces a SkillReadinessReport with per-skill analysis, gap matrix,
// and priority ranking. Outputs both markdown and JSON.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ────────────────────────────────────────────────────

export type GapPriority = 'P0' | 'P1' | 'P2' | 'P3'
export type GapEffort = 'S' | 'M' | 'L'

export interface Gap {
  id: string
  skill: string
  description: string
  priority: GapPriority
  effort: GapEffort
  specKitOverlap?: string
}

export interface SkillAnalysis {
  name: string
  path: string
  referencesSpecKit: boolean
  duplicatesSpecKit: string[]
  needsSpecKitData: boolean
  gaps: Gap[]
}

export interface SkillReadinessReport {
  generatedAt: string
  skills: SkillAnalysis[]
  gapMatrix: Gap[]
  priorityTop5: Gap[]
}

// ── Skill definitions ────────────────────────────────────────

const SKILLS = [
  { name: 'devops', path: '.opencode/skill/devops/SKILL.md' },
  { name: 'devops-fullstack', path: '.opencode/skill/devops-fullstack/SKILL.md' },
  { name: 'devops-research', path: '.opencode/skill/devops-research/SKILL.md' },
  { name: 'devops-roadmap', path: '.opencode/skill/devops-roadmap/SKILL.md' },
  { name: 'devops-generators', path: '.opencode/skill/devops-generators/SKILL.md' },
  { name: 'source-audit', path: '.opencode/skill/source-audit/SKILL.md' },
  { name: 'arch-audit', path: '.opencode/skill/arch-audit/SKILL.md' },
  { name: 'vivi-frontend', path: '.opencode/skill/vivi-frontend/SKILL.md' },
  { name: 'vivim-testing', path: '.opencode/skill/vivim-testing/SKILL.md' },
  { name: 'prisma-workflow', path: '.opencode/skill/prisma-workflow/SKILL.md' },
  { name: 'vivim-build', path: '.opencode/skill/vivim-build/SKILL.md' },
  { name: 'vivim-runtime', path: '.opencode/skill/vivim-runtime/SKILL.md' },
] as const

// ── SpecKit capability definitions ───────────────────────────

const SPECKIT_CAPABILITIES = [
  {
    command: 'specify',
    whatItDoes: 'Creates spec.md with user stories + requirements',
    devOpsOverlap: 'devops-roadmap interview produces similar structure',
  },
  {
    command: 'clarify',
    whatItDoes: 'Resolves ambiguities in spec',
    devOpsOverlap: 'devops-research resolves ambiguities for CREATE units',
  },
  {
    command: 'plan',
    whatItDoes: 'Creates plan.md with technical design + research',
    devOpsOverlap: 'devops-research produces research.md; plan has constitution check',
  },
  {
    command: 'tasks',
    whatItDoes: 'Creates tasks.md with phased task breakdown',
    devOpsOverlap: 'devops tracker has atomic units with phases',
  },
  {
    command: 'analyze',
    whatItDoes: 'Read-only cross-artifact consistency',
    devOpsOverlap: 'source-audit + arch-audit do code analysis',
  },
  {
    command: 'checklist',
    whatItDoes: 'Requirement quality gate',
    devOpsOverlap: 'No DevOps equivalent',
  },
  {
    command: 'implement',
    whatItDoes: 'Executes tasks.md',
    devOpsOverlap: 'devops loop executes atomic units',
  },
  {
    command: 'converge',
    whatItDoes: 'Gap analysis vs spec/plan/tasks',
    devOpsOverlap: 'source-audit + arch-audit find gaps',
  },
  {
    command: 'taskstoissues',
    whatItDoes: 'Converts tasks → GitHub issues',
    devOpsOverlap: 'No DevOps equivalent',
  },
]

// ── Audit logic ──────────────────────────────────────────────

function detectSpecKitReferences(content: string): boolean {
  const patterns = [/speckit/i, /spec\.md/i, /plan\.md/i, /tasks\.md/i, /constitution/i, /\.specify\//i]
  return patterns.some((p) => p.test(content))
}

function detectDuplications(content: string, skillName: string): string[] {
  const duplications: string[] = []

  // Check for gate functionality overlap
  if (/\bgate\b/i.test(content) && /typecheck|lint|test/i.test(content)) {
    duplications.push('Gates (partial overlap with tasks template gates)')
  }

  // Check for research overlap
  if (/\bresearch\b/i.test(content) && /brief|research\.md/i.test(content)) {
    duplications.push('Research (overlap with plan Phase 0)')
  }

  // Check for audit overlap
  if (/\baudit\b/i.test(content) && /quality|code.*review|finding/i.test(content)) {
    duplications.push('Audit (overlap with converge analysis)')
  }

  // Check for tracker overlap
  if (/\btracker\b/i.test(content) && /atomic|unit/i.test(content)) {
    duplications.push('Tracker (overlap with tasks.md)')
  }

  // Check for implementation loop overlap
  if (/\bloop\b/i.test(content) && /implement|execute|build/i.test(content)) {
    duplications.push('Implementation loop (overlap with speckit implement)')
  }

  return duplications
}

function detectNeedsSpecKitData(content: string): boolean {
  // Skills that need spec/plan/tasks data as input
  const needsDataPatterns = [
    /input.*spec/i,
    /requires.*plan/i,
    /reads.*tasks/i,
    /consumes.*spec/i,
    /depends.*plan/i,
  ]
  return needsDataPatterns.some((p) => p.test(content))
}

function generateGaps(skillName: string, content: string): Gap[] {
  const gaps: Gap[] = []
  let gapId = 1

  // P0: No spec awareness in implementation path
  if (/\b(loop|implement|build)\b/i.test(content) && !/spec\.md|specify/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'No spec awareness in implementation path',
      priority: 'P0',
      effort: 'M',
      specKitOverlap: 'speckit implement',
    })
  }

  // P1: Missing bridge module import
  if (!/speckit-bridge|bridge.*module/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'No bridge module import for task↔unit mapping',
      priority: 'P1',
      effort: 'S',
    })
  }

  // P1: No unified gate reference
  if (/\bgate\b/i.test(content) && !/unified-gate/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'Uses legacy gate instead of unified gate',
      priority: 'P1',
      effort: 'S',
      specKitOverlap: 'unified-gate',
    })
  }

  // P2: No decision table reference
  if (!/decision.*table|when.*to.*use/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'Missing decision table for SpecKit vs DevOps routing',
      priority: 'P2',
      effort: 'S',
    })
  }

  // P2: No converge pipeline reference
  if (/\b(audit|converge|gap)\b/i.test(content) && !/speckit-converge/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'Missing converge pipeline integration',
      priority: 'P2',
      effort: 'M',
      specKitOverlap: 'speckit converge',
    })
  }

  // P3: No SpecKit Integration section in SKILL.md
  if (!/## SpecKit Integration|## Integration/i.test(content)) {
    gaps.push({
      id: `${skillName}-G${String(gapId++).padStart(2, '0')}`,
      skill: skillName,
      description: 'Missing SpecKit Integration section in SKILL.md',
      priority: 'P3',
      effort: 'S',
    })
  }

  return gaps
}

// ── Main audit function ──────────────────────────────────────

export async function runSkillAudit(): Promise<SkillReadinessReport> {
  const skills: SkillAnalysis[] = []
  const allGaps: Gap[] = []

  for (const skill of SKILLS) {
    const fullPath = join(process.cwd(), skill.path)
    let content = ''

    if (existsSync(fullPath)) {
      content = await readFile(fullPath, 'utf8')
    }

    const referencesSpecKit = detectSpecKitReferences(content)
    const duplicatesSpecKit = detectDuplications(content, skill.name)
    const needsSpecKitData = detectNeedsSpecKitData(content)
    const gaps = generateGaps(skill.name, content)

    skills.push({
      name: skill.name,
      path: skill.path,
      referencesSpecKit,
      duplicatesSpecKit,
      needsSpecKitData,
      gaps,
    })

    allGaps.push(...gaps)
  }

  // Sort gaps by priority (P0 first) then effort (S first)
  const priorityOrder: Record<GapPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const effortOrder: Record<GapEffort, number> = { S: 0, M: 1, L: 2 }

  allGaps.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return effortOrder[a.effort] - effortOrder[b.effort]
  })

  const priorityTop5 = allGaps.slice(0, 5)

  return {
    generatedAt: new Date().toISOString(),
    skills,
    gapMatrix: allGaps,
    priorityTop5,
  }
}

// ── Report generators ────────────────────────────────────────

function generateMarkdownReport(report: SkillReadinessReport): string {
  const lines: string[] = []

  lines.push('# DevOps Skills → SpecKit Integration Readiness')
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push('')

  // Executive Summary
  const withSpecKit = report.skills.filter((s) => s.referencesSpecKit).length
  const withDuplication = report.skills.filter((s) => s.duplicatesSpecKit.length > 0).length
  lines.push('## Executive Summary')
  lines.push(`- ${report.skills.length} skills audited`)
  lines.push(`- ${withSpecKit} reference SpecKit (currently: ${withSpecKit})`)
  lines.push(`- ${withDuplication} duplicate SpecKit functionality`)
  if (report.priorityTop5.length > 0) {
    lines.push(`- Top gap: ${report.priorityTop5[0]!.description} (${report.priorityTop5[0]!.skill})`)
  }
  lines.push('')

  // Per-Skill Analysis
  lines.push('## Per-Skill Analysis')
  lines.push('')
  for (const skill of report.skills) {
    lines.push(`### ${skill.name}`)
    lines.push(`- **References SpecKit:** ${skill.referencesSpecKit ? 'Yes' : 'No'}`)
    if (skill.duplicatesSpecKit.length > 0) {
      lines.push(`- **Duplicates:** ${skill.duplicatesSpecKit.join('; ')}`)
    }
    lines.push(`- **Needs SpecKit Data:** ${skill.needsSpecKitData ? 'Yes' : 'No'}`)
    if (skill.gaps.length > 0) {
      lines.push('- **Gaps:**')
      for (const gap of skill.gaps) {
        lines.push(`  - ${gap.priority}/${gap.effort}: ${gap.description}`)
      }
    }
    lines.push('')
  }

  // Gap Priority Matrix
  lines.push('## Gap Priority Matrix')
  lines.push('| Priority | Skill | Gap | Effort |')
  lines.push('|----------|-------|-----|--------|')
  for (const gap of report.gapMatrix) {
    lines.push(`| ${gap.priority} | ${gap.skill} | ${gap.description} | ${gap.effort} |`)
  }
  lines.push('')

  // Top 5 Integration Points
  lines.push('## Top 5 Integration Points')
  for (let i = 0; i < report.priorityTop5.length; i++) {
    const gap = report.priorityTop5[i]!
    lines.push(`${i + 1}. **${gap.skill}** (${gap.priority}/${gap.effort}): ${gap.description}`)
  }
  lines.push('')

  return lines.join('\n')
}

// ── CLI entry ────────────────────────────────────────────────

export async function runSpeckitAudit(args: string[]): Promise<void> {
  const report = await runSkillAudit()

  const outputDir = join(process.cwd(), 'docs', 'integration')
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  // Write markdown report
  const mdPath = join(outputDir, 'skill-readiness.md')
  await writeFile(mdPath, generateMarkdownReport(report), 'utf8')

  // Write JSON report
  const jsonPath = join(outputDir, 'skill-readiness.json')
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(`Skill audit complete: ${report.skills.length} skills analyzed`)
  console.log(`Gap matrix: ${report.gapMatrix.length} gaps identified`)
  console.log(`Reports written to: ${outputDir}`)
  console.log(`  - ${mdPath}`)
  console.log(`  - ${jsonPath}`)
}
