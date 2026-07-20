// src/cli/provider-harness.ts
// Unit 32.1 — Provider Test Harness.
// Iterates every provider manifest from the in-repo canonical module
// (seeds/providers/manifests.ts), registers it through ProviderRegistrar, and
// runs a golden scenario (definition present, capabilities present, endpoints
// present). Emits a per-provider pass/fail matrix. The harness is the test:
// it discovers N providers and fails (non-zero) on any provider regression.

import { resolve } from 'node:path'
import { PROVIDER_MANIFESTS } from '../../seeds/providers/manifests.js'
import { ProviderRegistrar } from '../engines/provider-registrar.js'
import { type ProviderManifest, ProviderManifestSchema } from '../schema/provider-manifest.js'
import type { ProviderStore } from '../storage/contracts/provider-store.js'

export interface HarnessCheck {
  name: string
  ok: boolean
  detail?: string
}

export interface HarnessRow {
  slug: string
  displayName: string
  providerType: string
  isLocal: boolean
  registered: boolean
  checks: HarnessCheck[]
  passed: boolean
}

export interface HarnessReport {
  total: number
  passed: number
  failed: number
  rows: HarnessRow[]
}

export interface ProviderHarnessOptions {
  store: ProviderStore
  seedsDir?: string
}

export async function runProviderHarness(opts: ProviderHarnessOptions): Promise<HarnessReport> {
  const seedsDir = opts.seedsDir ?? resolve(import.meta.dir, '../../seeds/providers')
  const registrar = new ProviderRegistrar(opts.store, undefined, undefined, seedsDir)
  const rows: HarnessRow[] = []

  // In-repo canonical manifests (seeds/providers/manifests.ts) — zero filesystem reads.
  for (const raw of PROVIDER_MANIFESTS) {
    let manifest: ProviderManifest
    try {
      manifest = ProviderManifestSchema.parse(raw)
    } catch (err) {
      rows.push({
        slug: '(manifest)',
        displayName: '(manifest)',
        providerType: '?',
        isLocal: false,
        registered: false,
        checks: [{ name: 'manifest-parse', ok: false, detail: String(err) }],
        passed: false,
      })
      continue
    }

    const checks: HarnessCheck[] = []
    let registered = false
    try {
      await registrar.register(manifest)
      registered = true
      checks.push({ name: 'register', ok: true, detail: manifest.provider.slug })
    } catch (err) {
      checks.push({ name: 'register', ok: false, detail: String(err) })
    }

    const def = await opts.store.getDefinitionBySlug(manifest.provider.slug)
    checks.push({ name: 'definition-present', ok: !!def })

    // The `system` provider is a built-in meta-provider with no external
    // endpoints/capabilities by design — exempt it from those checks.
    const isSystem = manifest.provider.provider_type === 'system'

    if (def) {
      const caps = JSON.parse(def.capabilities_json) as unknown[]
      checks.push({
        name: 'capabilities-present',
        ok: isSystem ? true : caps.length > 0,
        detail: isSystem ? 'system provider (exempt)' : `${caps.length} capability(ies)`,
      })
    }

    const endpointCount = manifest.endpoints?.length ?? 0
    checks.push({
      name: 'endpoints-present',
      ok: isSystem ? true : endpointCount > 0,
      detail: isSystem ? 'system provider (exempt)' : `${endpointCount} endpoint(s)`,
    })

    const isLocal = manifest.provider.provider_type === 'local'
    const passed = registered && checks.every((c) => c.ok)
    rows.push({
      slug: manifest.provider.slug,
      displayName: manifest.provider.display_name,
      providerType: manifest.provider.provider_type,
      isLocal,
      registered,
      checks,
      passed,
    })
  }

  const passed = rows.filter((r) => r.passed).length
  return { total: rows.length, passed, failed: rows.length - passed, rows }
}

export function formatHarnessMatrix(report: HarnessReport): string {
  const lines: string[] = []
  lines.push('Provider smoke matrix')
  lines.push('─'.repeat(60))
  for (const r of report.rows) {
    const tag = r.isLocal ? 'local ' : 'cloud '
    const mark = r.passed ? 'PASS' : 'FAIL'
    lines.push(`[${mark}] ${tag} ${r.slug} (${r.providerType})`)
    for (const c of r.checks) {
      if (!c.ok) lines.push(`        - ${c.name}: ${c.detail ?? 'failed'}`)
    }
  }
  lines.push('─'.repeat(60))
  lines.push(`Total ${report.total} | Passed ${report.passed} | Failed ${report.failed}`)
  return lines.join('\n')
}
