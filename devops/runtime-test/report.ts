// devops/runtime-test/report.ts
// Unit — Persist + recall the last LoopReport so the agent can inspect loop outcomes
// across turns (the loop runs in a child process; its JSON would otherwise be lost).
//
// AGENT-SAFE: file IO only, never hangs.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const REPORT_PATH = '.runtime/loop-report.json'

export function saveLoopReport(report: unknown): void {
  try {
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8')
  } catch {
    // best-effort persistence; never throw
  }
}

export function readLoopReport(): { found: boolean; report?: unknown; error?: string } {
  try {
    if (!existsSync(REPORT_PATH)) return { found: false }
    const text = readFileSync(REPORT_PATH, 'utf8')
    return { found: true, report: JSON.parse(text) }
  } catch (err) {
    return { found: false, error: String(err) }
  }
}
