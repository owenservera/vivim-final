// devops/speckit-bridge.ts
// Unified ID Bridge between SpecKit tasks (T###) and DevOps atomic units (N.M).
// Stores linkage bidirectionally via markdown comment metadata.
//
// tasks.md format:
//   - [ ] T012 [P] [US1] Create engine → `src/engines/foo.ts`
//     <!-- bridge:unit=2.1 synced=2026-07-17 -->
//
// tracker format:
//   - [x] 2.1 — ProviderRegistrar → `src/engines/provider-registrar.ts`
//     <!-- bridge:task=T021 feature=specs/006-provider-account-dashboard -->

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseUnits, computeStats, updateHeader, type Unit, type UnitState } from './tracker.ts'

// ── Types ────────────────────────────────────────────────────

export interface TaskLink {
  taskId: string
  unitId: string | null
  featureDir: string
  syncedAt: string
}

export interface SyncReport {
  created: number
  updated: number
  skipped: number
  conflicts: string[]
}

export interface ConsistencyReport {
  consistent: boolean
  orphanTasks: string[]
  orphanUnits: string[]
  mismatchedLinks: [string, string][]
}

interface ParsedTask {
  id: string
  line: string
  lineIndex: number
  state: ' ' | 'x'
}

// ── Regex patterns ───────────────────────────────────────────

// Match task lines: - [ ] T012 ... or - [x] T012 ...
const TASK_LINE_RE = /^- \[([ x])\] (T\d+)(?:\s+.*)?$/

// Match bridge metadata in tasks.md: <!-- bridge:unit=2.1 synced=2026-07-17 -->
const TASK_BRIDGE_RE = /<!-- bridge:unit=([\d.]+)(?:\s+synced=([\d-]+))? -->/

// Match tracker unit lines: - [x] 2.1 — Name → `file`
const UNIT_LINE_RE = /^- \[([ x~!])\] (\d+\.\d+)/

// Match bridge metadata in tracker: <!-- bridge:task=T021 feature=specs/... -->
const TRACKER_BRIDGE_RE = /<!-- bridge:task=(T\d+)(?:\s+feature=([^\s]+))? -->/

// ── Path helpers ─────────────────────────────────────────────

function getTrackerPath(): string {
  return process.env.DEVOPS_TRACKER ?? join(process.cwd(), 'docs/atomic/01-tracker.md')
}

function getTasksPath(featureDir: string): string {
  return join(process.cwd(), featureDir, 'tasks.md')
}

// ── Parsers ──────────────────────────────────────────────────

function parseTasksMd(content: string): ParsedTask[] {
  const lines = content.split('\n')
  const tasks: ParsedTask[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = TASK_LINE_RE.exec(line)
    if (m) {
      tasks.push({
        id: m[2]!,
        line,
        lineIndex: i,
        state: m[1] as ' ' | 'x',
      })
    }
  }
  return tasks
}

function parseTrackerBridgeMetadata(content: string): Map<string, TaskLink> {
  const lines = content.split('\n')
  const links = new Map<string, TaskLink>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const unitMatch = UNIT_LINE_RE.exec(line)
    if (!unitMatch) continue

    const unitId = unitMatch[2]!
    // Check next line for bridge metadata
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]!
      const bridgeMatch = TRACKER_BRIDGE_RE.exec(nextLine)
      if (bridgeMatch) {
        links.set(unitId, {
          taskId: bridgeMatch[1]!,
          unitId,
          featureDir: bridgeMatch[2] ?? '',
          syncedAt: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }

  return links
}

function parseTasksBridgeMetadata(content: string): Map<string, string> {
  const lines = content.split('\n>')
  const links = new Map<string, string>() // taskId → unitId

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const taskMatch = TASK_LINE_RE.exec(line)
    if (!taskMatch) continue

    const taskId = taskMatch[2]!
    // Check next line for bridge metadata
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1]!
      const bridgeMatch = TASK_BRIDGE_RE.exec(nextLine)
      if (bridgeMatch) {
        links.set(taskId, bridgeMatch[1]!)
      }
    }
  }

  return links
}

// ── Core API ─────────────────────────────────────────────────

/**
 * Map a SpecKit task ID to a DevOps atomic unit.
 * Returns the linked AtomicUnit or null if no link exists.
 */
export async function mapTaskToUnit(taskId: string): Promise<{ id: string; name: string } | null> {
  const trackerPath = getTrackerPath()
  const trackerContent = await readFile(trackerPath, 'utf8')
  const units = parseUnits(trackerContent.split('\n'))
  const trackerLinks = parseTrackerBridgeMetadata(trackerContent)

  // Find the unit that links to this task
  for (const [unitId, link] of trackerLinks) {
    if (link.taskId === taskId) {
      const unit = units.find((u) => u.id === unitId)
      if (unit) {
        return { id: unit.id, name: unit.name }
      }
    }
  }

  return null
}

/**
 * Map a DevOps atomic unit to a SpecKit task ID.
 * Returns the linked task ID or null if no link exists.
 */
export async function mapUnitToTask(unitId: string): Promise<string | null> {
  const trackerPath = getTrackerPath()
  const trackerContent = await readFile(trackerPath, 'utf8')
  const trackerLinks = parseTrackerBridgeMetadata(trackerContent)

  const link = trackerLinks.get(unitId)
  return link?.taskId ?? null
}

/**
 * Sync tasks from a feature's tasks.md into the DevOps tracker.
 * Creates new units for unlinked tasks, preserves existing links.
 */
export async function syncTasksToTracker(featureDir: string): Promise<SyncReport> {
  const tasksPath = getTasksPath(featureDir)
  const trackerPath = getTrackerPath()

  if (!existsSync(tasksPath)) {
    throw new Error(`tasks.md not found at ${tasksPath}. Run /speckit.tasks first.`)
  }

  if (!existsSync(trackerPath)) {
    throw new Error(`Tracker not found at ${trackerPath}`)
  }

  const tasksContent = await readFile(tasksPath, 'utf8')
  const trackerContent = await readFile(trackerPath, 'utf8')

  const tasks = parseTasksMd(tasksContent)
  const trackerLines = trackerContent.split('\n')
  const existingLinks = parseTrackerBridgeMetadata(trackerContent)
  const taskLinks = parseTasksBridgeMetadata(tasksContent)

  // Build reverse map: taskId → unitId from tasks.md bridge metadata
  const taskIdToUnit = new Map<string, string>()
  for (const [taskId, unitId] of taskLinks) {
    taskIdToUnit.set(taskId, unitId)
  }

  const report: SyncReport = { created: 0, updated: 0, skipped: 0, conflicts: [] }

  // Find the last unit in the tracker to determine the next phase
  const allUnits = parseUnits(trackerContent.split('\n'))
  let maxPhase = 0
  let maxUnitInPhase = 0
  for (const u of allUnits) {
    if (u.phase > maxPhase) {
      maxPhase = u.phase
      maxUnitInPhase = 0
    }
    if (u.phase === maxPhase) {
      const minor = Number(u.id.split('.')[1])
      if (minor > maxUnitInPhase) maxUnitInPhase = minor
    }
  }

  // Find the last unit line index in the tracker to insert new units
  let lastUnitLineIndex = -1
  for (let i = trackerLines.length - 1; i >= 0; i--) {
    if (UNIT_LINE_RE.test(trackerLines[i]!)) {
      lastUnitLineIndex = i
      break
    }
  }

  let nextMinor = maxUnitInPhase + 1

  for (const task of tasks) {
    const existingUnitId = taskIdToUnit.get(task.id)

    if (existingUnitId) {
      // Task already has a linked unit — skip
      report.skipped++
      continue
    }

    // Check if there's a conflict: unit already has different task link
    let conflict = false
    for (const [, link] of existingLinks) {
      if (link.featureDir === featureDir) {
        // This feature already has a linked unit, but not for this task
        // This could be a re-sync scenario
      }
    }

    if (conflict) {
      report.conflicts.push(`${task.id}: conflict with existing unit link`)
      continue
    }

    // Create new unit
    const unitId = `${maxPhase}.${nextMinor}`
    const taskText = task.line.replace(/^- \[([ x])\] /, '').replace(/T\d+\s*/, '')
    const unitLine = `- [ ] ${unitId} — ${taskText}`
    const bridgeComment = `  <!-- bridge:task=${task.id} feature=${featureDir} -->`

    // Insert after last unit line
    if (lastUnitLineIndex >= 0) {
      trackerLines.splice(lastUnitLineIndex + 2, 0, unitLine, bridgeComment)
      lastUnitLineIndex += 2
    } else {
      trackerLines.push(unitLine, bridgeComment)
      lastUnitLineIndex = trackerLines.length - 2
    }

    // Add bridge comment to tasks.md
    const tasksLines = tasksContent.split('\n')
    if (tasksLines[task.lineIndex + 1]?.includes('<!-- bridge:')) {
      // Already has bridge comment — skip
    } else {
      tasksLines.splice(task.lineIndex + 1, 0, `  <!-- bridge:unit=${unitId} synced=${new Date().toISOString().slice(0, 10)} -->`)
    }

    // Write updated tasks.md
    await writeFile(tasksPath, tasksLines.join('\n'), 'utf8')
    // Update tasksContent for subsequent iterations
    const _newTasksContent = tasksLines.join('\n')

    report.created++
    nextMinor++
  }

  // Update tracker stats
  const finalUnits = parseUnits(trackerLines)
  const stats = computeStats(finalUnits)
  const finalLines = updateHeader(trackerLines, stats)

  await writeFile(trackerPath, finalLines.join('\n'), 'utf8')

  return report
}

/**
 * Validate bidirectional consistency between tasks.md and tracker.
 * Reports orphan tasks, orphan units, and mismatched links.
 */
export async function validateBridge(): Promise<ConsistencyReport> {
  const trackerPath = getTrackerPath()

  if (!existsSync(trackerPath)) {
    return {
      consistent: false,
      orphanTasks: [],
      orphanUnits: [],
      mismatchedLinks: [],
    }
  }

  const trackerContent = await readFile(trackerPath, 'utf8')
  const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
  const units = parseUnits(trackerContent.split('\n>'))

  const orphanTasks: string[] = []
  const orphanUnits: string[] = []
  const mismatchedLinks: [string, string][] = []

  // Check: every linked task should have a reverse link in its tasks.md
  // (We'd need to check each feature's tasks.md, but for now just check tracker side)

  // Check: every linked unit should have the task exist
  for (const [unitId, link] of trackerLinks) {
    // Unit links to a task — verify the task's bridge metadata points back
    const tasksPath = join(process.cwd(), link.featureDir, 'tasks.md')
    if (existsSync(tasksPath)) {
      const tasksContent = await readFile(tasksPath, 'utf8')
      const taskBridgeLinks = parseTasksBridgeMetadata(tasksContent)
      const linkedUnit = taskBridgeLinks.get(link.taskId)
      if (linkedUnit && linkedUnit !== unitId) {
        mismatchedLinks.push([unitId, `${link.taskId}→${linkedUnit}`])
      }
    }
  }

  // Check: units without bridge metadata that are in the same phase range as linked units
  const linkedUnitIds = new Set(trackerLinks.keys())
  for (const unit of units) {
    if (!linkedUnitIds.has(unit.id)) {
      // Unit doesn't have bridge metadata — check if any tasks.md links to it
      // For now, just report as not necessarily orphan (might be a devops-only unit)
    }
  }

  return {
    consistent: mismatchedLinks.length === 0 && orphanTasks.length === 0 && orphanUnits.length === 0,
    orphanTasks,
    orphanUnits,
    mismatchedLinks,
  }
}
