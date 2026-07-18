// devops/ui-test-registry.ts
// UiTestRegistry — persistent registry tracking which capabilities have been
// tested in the UI frontend, with timestamps, results, and notes.
//
// Purpose: answer "has this capability been verified in the frontend?" and
// "what hasn't been tested yet?" so the agent can direct the human (or itself)
// to the next step. Every `onboard test-frontend` / `verify` call auto-records.
//
// Persisted to `.runtime/ui-test-registry.json` (no DB migration needed).
// Queryable via `bun run devops ui-test list`, `bun run devops ui-test status`.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type UiTestResult = 'pass' | 'fail' | 'blocked'
export type UiTestMethod = 'auto' | 'manual'

export interface UiTestEntry {
  /** Capability slug, e.g. "send_message" */
  capability: string
  /** Provider slug, e.g. "gemini" */
  provider: string
  /** ISO timestamp */
  testedAt: string
  result: UiTestResult
  method: UiTestMethod
  /** What was tested (e.g. "full E2E: canvas mount + invoke + DOM assert") */
  detail: string
  /** Who/What ran the test ("agent" | "human" | automation mode name) */
  testedBy: string
  /** Optional free-form notes */
  notes?: string
  /** Unique auto-generated entry id */
  id: string
}

export interface UiTestRegistryData {
  /** All recorded test entries, newest first */
  entries: UiTestEntry[]
  /** Per-(provider, capability) latest result map for quick lookup */
  latestByKey: Record<string, { result: UiTestResult; testedAt: string; id: string }>
  updatedAt: string
}

const REGISTRY_PATH = '.runtime/ui-test-registry.json'

let _cache: UiTestRegistryData | null = null

function entryId(): string {
  return `utr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function keyOf(provider: string, capability: string): string {
  return `${provider}::${capability}`
}

export async function loadRegistry(): Promise<UiTestRegistryData> {
  if (_cache) return _cache
  if (!existsSync(REGISTRY_PATH)) {
    _cache = { entries: [], latestByKey: {}, updatedAt: new Date().toISOString() }
    return _cache
  }
  try {
    const raw = await readFile(REGISTRY_PATH, 'utf8')
    _cache = JSON.parse(raw) as UiTestRegistryData
    return _cache
  } catch {
    _cache = { entries: [], latestByKey: {}, updatedAt: new Date().toISOString() }
    return _cache
  }
}

export async function saveRegistry(): Promise<void> {
  if (!_cache) return
  _cache.updatedAt = new Date().toISOString()
  await mkdir(dirname(REGISTRY_PATH), { recursive: true })
  await writeFile(REGISTRY_PATH, JSON.stringify(_cache, null, 2), 'utf8')
}

/**
 * Record a UI frontend test result. Auto-called by frontend-automation-tester.ts
 * after every `testFrontend` run. Also usable standalone.
 */
export async function recordUiTest(
  provider: string,
  capability: string,
  result: UiTestResult,
  detail: string,
  testedBy: string,
  opts?: { method?: UiTestMethod; notes?: string },
): Promise<UiTestEntry> {
  const reg = await loadRegistry()
  const entry: UiTestEntry = {
    id: entryId(),
    capability,
    provider,
    testedAt: new Date().toISOString(),
    result,
    method: opts?.method ?? 'auto',
    detail,
    testedBy,
    notes: opts?.notes,
  }
  reg.entries.unshift(entry)
  reg.latestByKey[keyOf(provider, capability)] = {
    result,
    testedAt: entry.testedAt,
    id: entry.id,
  }
  await saveRegistry()
  return entry
}

/**
 * Get the latest test result for a (provider, capability) pair.
 * Returns null if never tested.
 */
export async function getLatestTest(
  provider: string,
  capability: string,
): Promise<UiTestEntry | null> {
  const reg = await loadRegistry()
  const k = keyOf(provider, capability)
  const latest = reg.latestByKey[k]
  if (!latest) return null
  return reg.entries.find((e) => e.id === latest.id) ?? null
}

/**
 * List all capabilities for a provider that have NEVER been UI-tested, or
 * whose last test failed.
 */
export async function getUntestedOrFailed(
  provider: string,
  knownCapabilities: string[],
): Promise<{ untested: string[]; lastFailed: Array<{ capability: string; notes?: string }> }> {
  const reg = await loadRegistry()
  const untested: string[] = []
  const lastFailed: Array<{ capability: string; notes?: string }> = []
  for (const cap of knownCapabilities) {
    const k = keyOf(provider, cap)
    const latest = reg.latestByKey[k]
    if (!latest) {
      untested.push(cap)
    } else if (latest.result === 'fail' || latest.result === 'blocked') {
      lastFailed.push({ capability: cap, notes: reg.entries.find((e) => e.id === latest.id)?.notes })
    }
  }
  return { untested, lastFailed }
}

/**
 * Get a human-readable summary of UI test status for a provider.
 * Used by provider-status.ts and preflight output.
 */
export async function getUiTestStatus(provider: string): Promise<{
  testedCount: number
  lastTested: string | null
  allPassed: boolean
  summary: string
}> {
  const reg = await loadRegistry()
  const providerEntries = reg.entries.filter((e) => e.provider === provider)
  if (providerEntries.length === 0) {
    return { testedCount: 0, lastTested: null, allPassed: false, summary: 'No UI tests recorded' }
  }
  const latestByCap = new Map<string, UiTestEntry>()
  for (const e of providerEntries) {
    const k = keyOf(e.provider, e.capability)
    if (!latestByCap.has(k)) latestByCap.set(k, e)
  }
  const allPassed = Array.from(latestByCap.values()).every((e) => e.result === 'pass')
  const first = providerEntries[0]
  const lastTested = first
    ? providerEntries.reduce(
        (latest, e) => (e.testedAt > latest ? e.testedAt : latest),
        first.testedAt,
      )
    : null
  return {
    testedCount: providerEntries.length,
    lastTested: lastTested ?? null,
    allPassed,
    summary: `${providerEntries.length} tests (${allPassed ? 'all pass' : 'some failing'}), last: ${lastTested}`,
  }
}
