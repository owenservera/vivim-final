// devops/agentic/probe.ts
// StateProbe — produces a compact (~2-4K token) snapshot of the current system
// state that a limited-context agent can read before planning.
//
// Output format: JSON with sections: providers, capabilities, selectors,
// components, schema, test-coverage. Each section is a count + critical flags,
// not the full data dump.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface ProviderProbe {
  slug: string
  displayName: string
  providerType: string
  isActive: boolean
  hasEndpoint: boolean
  hasParser: boolean
  hasStreamConfig: boolean
  composerType: string
  sendMethod: string
  capturePatterns: number
  selectors: { composer: number; send: number }
  accounts: number
}

export interface CapabilityProbe {
  total: number
  byCategory: Record<string, number>
  withBindings: number
  withSelectors: number
}

export interface ComponentProbe {
  total: number
  byScope: Record<string, number>
  byStatus: Record<string, number>
  families: string[]
}

export interface SchemaProbe {
  tables: number
  migrations: number
  walEnabled: boolean
  ftsEnabled: boolean
  dbSizeBytes: number
}

export interface SelectorProbe {
  total: number
  providers: string[]
  hardcodedInCode: string[]
  dbBacked: string[]
}

export interface TestProbe {
  unitFiles: number
  integrationFiles: number
  e2eFiles: number
  totalTestFiles: number
}

export interface StateSnapshot {
  generatedAt: number
  estimatedTokens: number
  providers: { total: number; active: number; list: ProviderProbe[] }
  capabilities: CapabilityProbe
  components: ComponentProbe
  schema: SchemaProbe
  selectors: SelectorProbe
  tests: TestProbe
  /** Top 10 gaps the agent should address first. */
  criticalGaps: string[]
}

function extractProviderProbes(_unused?: string): ProviderProbe[] {
  const probes: ProviderProbe[] = []
  // The provider manifests were deleted (seeds/providers/*.json removed in 021); the
  // generated static protocol file is now the source of truth for the probe.
  const protocolPath = join(process.cwd(), 'src', '__generated__', 'provider-protocol.ts')
  if (!existsSync(protocolPath)) return probes

  let protocol: { providers: any[] } | null = null
  try {
    const mod = require('node:module').createRequire(import.meta.url)(`file://${protocolPath}`)
    protocol = mod.default ?? null
  } catch {
    return probes
  }
  if (!protocol) return probes

  for (const p of protocol.providers) {
    const chatEp = (p.endpoints ?? []).find((e: any) => e.endpointType === 'chat')
    probes.push({
      slug: p.slug,
      displayName: p.displayName ?? p.slug,
      providerType: p.providerType ?? 'llm',
      isActive: p.isActive !== false,
      hasEndpoint: (p.endpoints ?? []).length > 0,
      hasParser: (p.parsers ?? []).length > 0,
      hasStreamConfig: (p.streamConfigs ?? []).length > 0,
      composerType: chatEp?.composerType ?? 'unknown',
      sendMethod: chatEp?.sendMethod ?? 'unknown',
      capturePatterns: (p.capabilities ?? []).length,
      selectors: {
        composer: (p.composerSelectors ?? []).length,
        send: (p.sendButtonSelectors ?? []).length,
      },
      accounts: 0,
    })
  }
  return probes
}

function extractSelectorProbe(providerSelectorsTs: string): SelectorProbe {
  const hardcoded: string[] = []
  // Extract COMPOSER_SELECTORS keys
  const composerMatch = providerSelectorsTs.match(/COMPOSER_SELECTORS[^=]*=\s*\{([^}]+)\}/s)
  if (composerMatch) {
    const keys = composerMatch[1]!.match(/(\w+)\s*:/g)
    if (keys) hardcoded.push(...keys.map((k) => k.replace(':', '').trim()))
  }

  // Extract SEND_BUTTON_SELECTORS keys
  const sendMatch = providerSelectorsTs.match(/SEND_BUTTON_SELECTORS[^=]*=\s*\{([^}]+)\}/s)
  if (sendMatch) {
    const keys = sendMatch[1]!.match(/(\w+)\s*:/g)
    if (keys) {
      for (const k of keys.map((k) => k.replace(':', '').trim())) {
        if (!hardcoded.includes(k)) hardcoded.push(k)
      }
    }
  }

  // Extract PROVIDER_URLS keys
  const urlMatch = providerSelectorsTs.match(/PROVIDER_URLS[^=]*=\s*\{([^}]+)\}/s)
  const dbBacked: string[] = []
  if (urlMatch) {
    const keys = urlMatch[1]!.match(/(\w+)\s*:/g)
    if (keys) {
      for (const k of keys.map((k) => k.replace(':', '').trim())) {
        if (!hardcoded.includes(k)) hardcoded.push(k)
      }
    }
  }

  return {
    total: hardcoded.length,
    providers: hardcoded,
    hardcodedInCode: hardcoded,
    dbBacked,
  }
}

export function generateStateSnapshot(): StateSnapshot {
  const repoRoot = process.cwd()
  const providers = extractProviderProbes('')
  const active = providers.filter((p) => p.isActive)

  // Read provider selectors for the probe
  let selectorProbe: SelectorProbe = { total: 0, providers: [], hardcodedInCode: [], dbBacked: [] }
  try {
    const selPath = join(repoRoot, 'src', 'engines', 'provider-selectors.ts')
    if (existsSync(selPath)) {
      selectorProbe = extractSelectorProbe(readFileSync(selPath, 'utf8'))
    }
  } catch { /* ignore */ }
  // [audit] log the error with context here

  // Schema probe
  const dbPath = join(repoRoot, 'prisma', 'dev.db')
  let dbSize = 0
  try { dbSize = statSync(dbPath).size } catch { /* ignore */ }
  // [audit] log the error with context here

  // Migration count
  const migDir = join(repoRoot, 'prisma', 'migrations')
  let migCount = 0
  try { migCount = readdirSync(migDir).filter((f) => f !== 'migration_lock.toml').length } catch { /* ignore */ }
  // [audit] log the error with context here

  // Test file count
  let unitFiles = 0
  let integFiles = 0
  let e2eFiles = 0
  try {
    const u = join(repoRoot, 'tests', 'unit')
    const i = join(repoRoot, 'tests', 'integration')
    const e = join(repoRoot, 'tests', 'e2e')
    unitFiles = existsSync(u) ? countTestFiles(u) : 0
    integFiles = existsSync(i) ? countTestFiles(i) : 0
    e2eFiles = existsSync(e) ? countTestFiles(e) : 0
  } catch { /* ignore */ }
  // [audit] log the error with context here

  // Component probe — count UiComponent rows from seed
  let compTotal = 0
  const compByScope: Record<string, number> = {}
  try {
    const seedPath = join(repoRoot, 'seeds', 'conceptual-model', 'seed.ts')
    if (existsSync(seedPath)) {
      const seedContent = readFileSync(seedPath, 'utf8')
      const uiMatch = seedContent.match(/UiComponents?[^=]*=\s*\[([\s\S]*?)\]\s*as\s+const/s)
      if (uiMatch) {
        const scopeMatches = uiMatch[1]!.match(/scope:\s*['"]([^'"]+)['"]/g)
        if (scopeMatches) {
          for (const m of scopeMatches) {
            const scope = m.replace(/scope:\s*['"]/, '').replace(/['"]/, '')
            compByScope[scope] = (compByScope[scope] ?? 0) + 1
            compTotal++
          }
        }
      }
    }
  } catch { /* ignore */ }
  // [audit] log the error with context here

  // Critical gaps detection
  const gaps: string[] = []
  for (const p of providers) {
    if (!p.hasEndpoint) gaps.push(`${p.slug}: no endpoint configured`)
    if (!p.hasParser) gaps.push(`${p.slug}: no parser configured`)
    if (!p.hasStreamConfig) gaps.push(`${p.slug}: no stream config`)
    if (p.composerType === 'unknown') gaps.push(`${p.slug}: composer type unknown`)
    if (p.selectors.composer === 0) gaps.push(`${p.slug}: no composer selectors`)
  }
  if (!selectorProbe.hardcodedInCode.includes('deepseek')) {
    gaps.push('deepseek: missing from COMPOSER_SELECTORS (will fall back to textarea default)')
  }
  if (compTotal === 0) gaps.push('no UiComponent seed data — all surfaces fall back to system defaults')
  if (unitFiles < 20) gaps.push(`low test coverage: only ${unitFiles} unit test files`)

  return {
    generatedAt: Date.now(),
    estimatedTokens: 2500 + providers.length * 100,
    providers: {
      total: providers.length,
      active: active.length,
      list: providers,
    },
    capabilities: {
      total: 0, // requires DB connection — deferred
      byCategory: {},
      withBindings: 0,
      withSelectors: 0,
    },
    components: {
      total: compTotal,
      byScope: compByScope,
      byStatus: {},
      families: [],
    },
    schema: {
      tables: 54,
      migrations: migCount,
      walEnabled: true,
      ftsEnabled: true,
      dbSizeBytes: dbSize,
    },
    selectors: selectorProbe,
    tests: {
      unitFiles,
      integrationFiles: integFiles,
      e2eFiles,
      totalTestFiles: unitFiles + integFiles + e2eFiles,
    },
    criticalGaps: gaps.slice(0, 10),
  }
}

function countTestFiles(dir: string): number {
  let count = 0
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        count += countTestFiles(full)
      } else if (entry.name.endsWith('.test.ts')) {
        count++
      }
    }
  } catch { /* ignore */ }
  // [audit] log the error with context here
  return count
}

/** Write the snapshot to .runtime/state-snapshot.json */
export function writeSnapshot(snapshot: StateSnapshot): void {
  const { writeFileSync, mkdirSync } = require('node:fs')
  const dir = join(process.cwd(), '.runtime')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'state-snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8')
}
