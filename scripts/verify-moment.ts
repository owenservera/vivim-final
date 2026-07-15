#!/usr/bin/env bun
// scripts/verify-moment.ts
// Verifies user journey moments against live backend.
// Usage: bun scripts/verify-moment.ts [moment-id]
// If no ID given, verifies all moments.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getServerPort } from '../src/config.js'

interface MomentVerification {
  type: 'http' | 'composite' | 'manual'
  command?: string
  expected?: string | number
  min?: number
  steps?: Array<{
    name: string
    command: string
    expectField?: string
    expectValue?: unknown
    expectMinLength?: number
  }>
}

interface Moment {
  id: string
  name: string
  status: string
  verification?: MomentVerification
}

interface MomentsManifest {
  moments: Moment[]
}

const BASE = `http://localhost:${getServerPort()}`

async function runCommand(cmd: string): Promise<{ ok: boolean; output: string }> {
  try {
    // Replace curl commands with fetch calls for reliability
    if (cmd.startsWith('curl ')) {
      return await runCurl(cmd)
    }
    const proc = Bun.spawn(['powershell', '-Command', cmd], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10000,
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited
    return { ok: exitCode === 0, output: stdout || stderr }
  } catch (err) {
    return { ok: false, output: String(err) }
  }
}

async function runCurl(cmd: string): Promise<{ ok: boolean; output: string }> {
  // Parse curl command and convert to fetch
  const urlMatch = cmd.match(/curl\s+(?:-s\s+)?(?:-X\s+\w+\s+)?(?:-H\s+'[^']+'\s+)?(?:-d\s+'[^']+'\s+)?(https?:\/\/[^\s'"]+)/)
  const methodMatch = cmd.match(/-X\s+(\w+)/)
  const dataMatch = cmd.match(/-d\s+'([^']+)'/)

  if (!urlMatch) return { ok: false, output: 'Could not parse URL from command' }

  const url = urlMatch[1]
  const method = methodMatch?.[1] ?? 'GET'
  const body = dataMatch?.[1]

  try {
    const resp = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? body.replace(/\\\\/g, '\\') : undefined,
      signal: AbortSignal.timeout(5000),
    })
    const text = await resp.text()
    return { ok: resp.ok, output: text }
  } catch (err) {
    return { ok: false, output: String(err) }
  }
}

function checkOutput(output: string, verification: MomentVerification): { pass: boolean; reason: string } {
  try {
    const json = JSON.parse(output)

    if (verification.type === 'http') {
      if (verification.expected !== undefined) {
        const actual = json
        if (typeof verification.expected === 'number') {
          if (actual !== verification.expected) {
            return { pass: false, reason: `Expected ${verification.expected}, got ${actual}` }
          }
        } else if (actual !== verification.expected) {
          return { pass: false, reason: `Expected "${verification.expected}", got "${actual}"` }
        }
      }
      if (verification.min !== undefined) {
        if (typeof json === 'number' && json < verification.min) {
          return { pass: false, reason: `Expected >= ${verification.min}, got ${json}` }
        }
      }
      return { pass: true, reason: 'OK' }
    }

    if (verification.type === 'composite' && verification.steps) {
      for (const step of verification.steps) {
        if (step.expectField) {
          const field = json[step.expectField]
          if (step.expectValue !== undefined && field !== step.expectValue) {
            return { pass: false, reason: `Step "${step.name}": expected ${step.expectField}=${step.expectValue}, got ${field}` }
          }
          if (step.expectMinLength !== undefined && Array.isArray(field) && field.length < step.expectMinLength) {
            return { pass: false, reason: `Step "${step.name}": expected ${step.expectField}.length >= ${step.expectMinLength}, got ${field.length}` }
          }
        }
      }
      return { pass: true, reason: 'All steps passed' }
    }

    return { pass: true, reason: 'No specific checks defined' }
  } catch {
    return { pass: false, reason: `Failed to parse JSON: ${output.substring(0, 100)}` }
  }
}

async function verifyMoment(moment: Moment): Promise<{ id: string; name: string; pass: boolean; reason: string }> {
  if (!moment.verification) {
    return { id: moment.id, name: moment.name, pass: false, reason: 'No verification defined' }
  }

  if (moment.verification.type === 'manual') {
    return { id: moment.id, name: moment.name, pass: false, reason: 'Manual verification required' }
  }

  // For composite, run each step's command
  if (moment.verification.type === 'composite' && moment.verification.steps) {
    for (const step of moment.verification.steps) {
      const result = await runCommand(step.command)
      if (!result.ok) {
        return { id: moment.id, name: moment.name, pass: false, reason: `Step "${step.name}" failed: ${result.output.substring(0, 200)}` }
      }
      const check = checkOutput(result.output, { ...moment.verification, type: 'http', expected: step.expectValue, min: undefined })
      if (!check.pass) {
        return { id: moment.id, name: moment.name, pass: false, reason: `Step "${step.name}": ${check.reason}` }
      }
    }
    return { id: moment.id, name: moment.name, pass: true, reason: 'All steps passed' }
  }

  // Single command
  const result = await runCommand(moment.verification.command!)
  if (!result.ok) {
    return { id: moment.id, name: moment.name, pass: false, reason: `Command failed: ${result.output.substring(0, 200)}` }
  }
  const check = checkOutput(result.output, moment.verification)
  return { id: moment.id, name: moment.name, pass: check.pass, reason: check.reason }
}

async function main() {
  const targetId = process.argv[2]

  const manifestPath = resolve(import.meta.dir, '../docs/user-stories-moments/moments.json')
  const manifest: MomentsManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  const moments = targetId
    ? manifest.moments.filter((m) => m.id === targetId)
    : manifest.moments.filter((m) => m.verification && m.verification.type !== 'manual')

  if (moments.length === 0) {
    console.log(`No moments found${targetId ? ` matching "${targetId}"` : ''}`)
    process.exit(1)
  }

  console.log(`\nVerifying ${moments.length} moment(s)...\n`)

  const results = await Promise.all(moments.map(verifyMoment))

  let passed = 0
  let failed = 0
  for (const r of results) {
    const icon = r.pass ? '✓' : '✗'
    const color = r.pass ? '\x1b[32m' : '\x1b[31m'
    console.log(`${color}${icon}\x1b[0m ${r.id} ${r.name}: ${r.reason}`)
    if (r.pass) passed++
    else failed++
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)

  // Update manifest with verification timestamps
  if (!targetId) {
    const now = new Date().toISOString()
    for (const moment of manifest.moments) {
      const result = results.find((r) => r.id === moment.id)
      if (result?.pass) {
        moment.verifiedAt = now
        moment.status = 'verified'
      } else if (result && !result.pass && moment.status === 'verified') {
        moment.status = 'broken'
      }
    }
    manifest.lastVerified = now
    const { writeFileSync } = await import('node:fs')
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('Manifest updated.')
  }

  process.exit(failed > 0 ? 1 : 0)
}

main()
