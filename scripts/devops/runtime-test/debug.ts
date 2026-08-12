// scripts/devops/runtime-test/debug.ts
// Debug capture - screenshot + console on failure

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface DebugReport {
  captured: boolean
  files: string[]
  issue?: string
}

const DEBUG_DIR = '/tmp/vivim-debug'

/**
 * Capture debug info on failure
 */
export async function captureDebug(
  port: number,
  capabilitySlug: string,
): Promise<DebugReport> {
  const files: string[] = []

  try {
    // Ensure debug directory exists
    await mkdir(DEBUG_DIR, { recursive: true })
  } catch {
  // [audit] log the error with context here
    // Directory might exist
  }

  // Take screenshot (via frontend capture endpoint if available)
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/debug/screenshot?capability=${capabilitySlug}`)
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer())
      const path = join(DEBUG_DIR, `${capabilitySlug}-${Date.now()}.png`)
      await writeFile(path, buf)
      files.push(path)
    }
  } catch {
  // [audit] log the error with context here
    // Screenshot capture failed
  }

  // Capture console log
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/debug/console`)
    if (r.ok) {
      const logs = await r.text()
      const path = join(DEBUG_DIR, `${capabilitySlug}-${Date.now()}-console.log`)
      await writeFile(path, logs)
      files.push(path)
    }
  } catch {
  // [audit] log the error with context here
    // Console capture failed
  }

  return {
    captured: files.length > 0,
    files,
    issue: capabilitySlug,
  }
}