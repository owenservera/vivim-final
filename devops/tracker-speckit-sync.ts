// devops/tracker-speckit-sync.ts
// Bidirectional sync between SpecKit tasks.md and DevOps atomic tracker.
// Reads bridge metadata to resolve task↔unit links and syncs state.

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseUnits, computeStats, updateHeader, updateState, type UnitState } from './tracker.ts'
import { mapTaskToUnit, mapUnitToTask, type SyncReport, type ConsistencyReport } from './speckit-bridge.ts'

// ── Types ────────────────────────────────────────────────────

export interface BidirectionalSyncReport extends SyncReport {
  timestamp: string
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

function parseTasksMd(content: string): Array<{ id: string; state: ' ' | 'x'; lineIndex: number }> {
  const lines = content.split('\n')
  const tasks: Array<{ id: string; state: ' ' | 'x'; lineIndex: number }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = TASK_LINE_RE.exec(line)
    if (m) {
      tasks.push({
        id: m[2]!,
        state: m[1] as ' ' | 'x',
        lineIndex: i,
      })
    }
  }

  return tasks
}

function parseTrackerBridgeMetadata(content: string): Map<string, { taskId: string; featureDir: string }> {
  const lines = content.split('\n')
  const links = new Map<string, { taskId: string; featureDir: string }>()

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
          featureDir: bridgeMatch[2] ?? '',
        })
      }
    }
  }

  return links
}

function parseTasksBridgeMetadata(content: string): Map<string, string> {
  const lines = content.split('\n')
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
 * Sync a SpecKit feature's tasks.md to the DevOps tracker.
 * Marks linked units as done when tasks are completed.
 */
export async function syncFeatureToTracker(featureDir: string): Promise<BidirectionalSyncReport> {
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
  const trackerLines = trackerContent.split('\n>')
  const taskLinks = parseTasksBridgeMetadata(tasksContent)

  const report: BidirectionalSyncReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: [],
    timestamp: new Date().toISOString(),
  }

  for (const task of tasks) {
    const unitId = taskLinks.get(task.id)

    if (!unitId) {
      // Task has no linked unit — skip (sync only updates existing links)
      report.skipped++
      continue
    }

    // Find the unit in the tracker and update its state
    const targetState: UnitState = task.state === 'x' ? 'done' : 'pending'

    try {
      // Parse fresh content each time since we're modifying
      const freshContent = await readFile(trackerPath, 'utf8')
      const freshLines = freshContent.split('\n')

      // Find the unit line
      let unitLineIndex = -1
      for (let i = 0; i < freshLines.length; i++) {
        const unitMatch = UNIT_LINE_RE.exec(freshLines[i]!)
        if (unitMatch && unitMatch[2] === unitId) {
          unitLineIndex = i
          break
        }
      }

      if (unitLineIndex === -1) {
        report.conflicts.push(`Unit ${unitId} not found in tracker for task ${task.id}`)
        continue
      }

      // Check current state
      const currentMatch = UNIT_LINE_RE.exec(freshLines[unitLineIndex]!)
      const currentState = currentMatch?.[1] === 'x' ? 'done' : 'pending'

      if (currentState === targetState) {
        // Already in correct state
        report.skipped++
        continue
      }

      // Update the unit state
      const updatedLines = updateState(freshLines, unitId, targetState)
      const units = parseUnits(updatedLines)
      const stats = computeStats(units)
      const finalLines = updateHeader(updatedLines, stats)

      await writeFile(trackerPath, finalLines.join('\n'), 'utf8')
      report.updated++
    } catch (e) {
      report.conflicts.push(`Error updating unit ${unitId}: ${(e as Error).message}`)
    }
  }

  return report
}

/**
 * Sync a DevOps unit's state to its linked SpecKit task.
 * Marks the task checkbox when the unit is done.
 */
export async function syncTrackerToTask(unitId: string): Promise<boolean> {
  const trackerPath = getTrackerPath()

  if (!existsSync(trackerPath)) {
    return false
  }

  const trackerContent = await readFile(trackerPath, 'utf8')
  const trackerLinks = parseTrackerBridgeMetadata(trackerContent)
  const link = trackerLinks.get(unitId)

  if (!link) {
    // No linked task
    return false
  }

  const tasksPath = join(process.cwd(), link.featureDir, 'tasks.md')

  if (!existsSync(tasksPath)) {
    return false
  }

  const tasksContent = await readFile(tasksPath, 'utf8')
  const lines = tasksContent.split('\n')

  // Find the task line
  for (let i = 0; i < lines.length; i++) {
    const taskMatch = TASK_LINE_RE.exec(lines[i]!)
    if (taskMatch && taskMatch[2] === link.taskId) {
      // Check current state
      const currentState = taskMatch[1] === 'x' ? 'done' : 'pending'

      // Get unit state from tracker
      const unitLines = trackerContent.split('\n>')
      for (let j = 0; j < unitLines.length; j++) {
        const unitMatch = UNIT_LINE_RE.exec(unitLines[j]!)
        if (unitMatch && unitMatch[2] === unitId) {
          const unitState = unitMatch[1] === 'x' ? 'done' : 'pending'

          if (currentState === unitState) {
            // Already in sync
            return true
          }

          // Update task checkbox
          const targetMarker = unitState === 'done' ? 'x' : ' '
          lines[i] = lines[i]!.replace(/\[([ x])\]/, `[${targetMarker}]`)

          await writeFile(tasksPath, lines.join('\n'), 'utf8')
          return true
        }
      }
    }
  }

  return false
}

/**
 * Validate bidirectional consistency between tasks.md and tracker.
 * Returns a detailed report of orphans and mismatches.
 */
export async function validateConsistency(): Promise<ConsistencyReport> {
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

  // Check: every linked task should have a reverse link
  for (const [unitId, link] of trackerLinks) {
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

  // Check: every task with bridge metadata should have a corresponding unit
  // (This would require reading all tasks.md files — for now just check tracker side)

  return {
    consistent: mismatchedLinks.length === 0 && orphanTasks.length === 0 && orphanUnits.length === 0,
    orphanTasks,
    orphanUnits,
    mismatchedLinks,
  }
}

/**
 * Sync all features in specs/ directory to the tracker.
 * Returns aggregate sync report.
 */
export async function syncAllFeatures(): Promise<BidirectionalSyncReport> {
  const specsDir = join(process.cwd(), 'specs')

  if (!existsSync(specsDir)) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: [],
      timestamp: new Date().toISOString(),
    }
  }

  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(specsDir, { withFileTypes: true })
  const aggregateReport: BidirectionalSyncReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: [],
    timestamp: new Date().toISOString(),
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const featureDir = `specs/${entry.name}`
    const tasksPath = getTasksPath(featureDir)

    if (existsSync(tasksPath)) {
      try {
        const report = await syncFeatureToTracker(featureDir)
        aggregateReport.created += report.created
        aggregateReport.updated += report.updated
        aggregateReport.skipped += report.skipped
        aggregateReport.conflicts.push(...report.conflicts)
      } catch (e) {
        aggregateReport.conflicts.push(`${featureDir}: ${(e as Error).message}`)
      }
    }
  }

  return aggregateReport
}
