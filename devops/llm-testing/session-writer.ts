// devops/llm-testing/session-writer.ts
// Writes session traces (JSON) and reports (markdown) to disk.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getLogger } from '../../src/lib/logger.js'
import type { SessionTrace, SessionSummary, TestResult, TestSurface } from './types.js'

const log = getLogger('llm-testing:session-writer')

const BASE_DIR = join(process.cwd(), '.runtime', 'llm-testing')
const SESSIONS_DIR = join(BASE_DIR, 'sessions')
const SCREENSHOTS_DIR = join(SESSIONS_DIR, 'screenshots')
const REPORTS_DIR = join(BASE_DIR, 'reports')

export class SessionWriter {
  constructor() {
    this.ensureDirs()
  }

  writeSession(trace: SessionTrace): string {
    const path = join(SESSIONS_DIR, `${trace.sessionId}.json`)
    writeFileSync(path, JSON.stringify(trace, null, 2), 'utf8')
    log.info(`Session written: ${path}`)
    return path
  }

  writeReport(trace: SessionTrace): string {
    const md = this.generateMarkdown(trace)
    const path = join(REPORTS_DIR, `${trace.sessionId}.md`)
    writeFileSync(path, md, 'utf8')
    log.info(`Report written: ${path}`)
    return path
  }

  private ensureDirs() {
    for (const dir of [BASE_DIR, SESSIONS_DIR, SCREENSHOTS_DIR, REPORTS_DIR]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    }
  }

  private generateMarkdown(trace: SessionTrace): string {
    const { summary: s } = trace
    const lines: string[] = []

    lines.push(`# Test Session Report`)
    lines.push(``)
    lines.push(`**Session**: ${trace.sessionId}`)
    lines.push(`**Date**: ${trace.startedAt}`)
    lines.push(`**Mode**: ${trace.mode}`)
    lines.push(`**Duration**: ${this.formatDuration(trace)}`)
    lines.push(``)
    lines.push(`## Summary`)
    lines.push(``)
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Tests | ${s.total} |`)
    lines.push(`| Passed | ${s.passed} |`)
    lines.push(`| Failed | ${s.failed} |`)
    lines.push(`| Skipped | ${s.skipped} |`)
    lines.push(`| Errored | ${s.errored} |`)
    lines.push(``)

    lines.push(`## Coverage`)
    lines.push(``)
    lines.push(`| Surface | Before | After | Delta |`)
    lines.push(`|---------|--------|-------|-------|`)
    for (const [surface, delta] of Object.entries(s.coverageDelta)) {
      const d = ((delta.after - delta.before) * 100).toFixed(1)
      const sign = delta.after >= delta.before ? '+' : ''
      lines.push(`| ${surface} | ${(delta.before * 100).toFixed(1)}% | ${(delta.after * 100).toFixed(1)}% | ${sign}${d}% |`)
    }
    lines.push(``)

    const failed = trace.tests.filter((t) => t.status === 'fail' || t.status === 'error')
    if (failed.length > 0) {
      lines.push(`## Failed Tests`)
      lines.push(``)
      for (const t of failed) {
        lines.push(`### ${t.id} — ${t.surface}/${t.capability}`)
        lines.push(`- **Action**: ${t.action}`)
        lines.push(`- **Expected**: ${t.expected}`)
        lines.push(`- **Actual**: ${t.actual}`)
        if (t.error) lines.push(`- **Error**: ${t.error}`)
        if (t.fix) lines.push(`- **Fix**: ${t.fix}`)
        lines.push(``)
      }
    }

    if (s.newPatternsLearned > 0) {
      lines.push(`## Knowledge Updated`)
      lines.push(``)
      lines.push(`- New patterns: ${s.newPatternsLearned}`)
      lines.push(`- Errors encountered: ${s.errorsEncountered}`)
      lines.push(``)
    }

    return lines.join('\n')
  }

  private formatDuration(trace: SessionTrace): string {
    const ms = new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime()
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000)
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`
  }
}
