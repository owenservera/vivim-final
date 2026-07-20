// devops/protocol-promote.ts
// Dev→Prod promotion engine for the Provider Protocol Data Layer.
//
// Design (the intended devops workflow):
//   - DEFAULT (prod): the system reads `src/__generated__/provider-protocol.ts`, which is a
//     pure compilation of the DB (PROVIDER_PROTOCOL_SOURCE=generated, the default).
//   - DEV: during testing/devops you flip PROVIDER_PROTOCOL_SOURCE=dev so the whole system
//     reads `provider-protocol.dev.ts` — an editable override clone where you track fixes
//     and test theories without touching the DB. The generator PRESERVES this file.
//   - PROMOTE: once an automated session proves the dev clone is better, run
//     `bun run devops protocol promote --provider=<slug>` to push the dev overrides back
//     into the DB (parser logic_code/hash, endpoint selectors) and regenerate prod, so
//     [dev] → DB → [prod].
//
// This module is the engine behind `devops protocol diff|promote`. It is DB-backed via the
// Prisma client (single source of truth), and reads the two static files for diffing.

import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ProviderProtocol } from '../src/engines/provider-protocol-generator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GENERATED_DIR = resolve(__dirname, '../src/__generated__')

export interface ProviderDelta {
  slug: string
  parserChanges: string[]
  endpointChanges: string[]
  changed: boolean
}

export interface PromoteResult {
  ok: boolean
  provider: string
  delta: ProviderDelta
  dbWrites: number
  regeneratedProd: boolean
  error?: string
}

function loadProtocol(file: 'provider-protocol.ts' | 'provider-protocol.dev.ts'): ProviderProtocol | null {
  const path = resolve(GENERATED_DIR, file)
  if (!existsSync(path)) return null
  const url = `file://${path}`
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loaded = require(url) as { default: ProviderProtocol }
  return loaded.default ?? null
}

export function hashLogicCode(code: string): string {
  let h1 = 0x811c9dc5
  for (let i = 0; i < code.length; i++) {
    h1 ^= code.charCodeAt(i)
    h1 = Math.imul(h1, 0x01000193)
  }
  let out = (h1 >>> 0).toString(16).padStart(8, '0')
  let acc = h1
  for (let i = 0; i < 7; i++) {
    acc = Math.imul(acc ^ (acc >>> 13), 0x9e3779b1)
    out += (acc >>> 0).toString(16).padStart(8, '0')
  }
  return out
}

export function computeProviderDelta(
  prod: ProviderProtocol | null,
  dev: ProviderProtocol | null,
  slug: string,
): ProviderDelta {
  const prodP = prod?.providers.find((p) => p.slug === slug) ?? null
  const devP = dev?.providers.find((p) => p.slug === slug) ?? null
  const parserChanges: string[] = []
  const endpointChanges: string[] = []

  if (!devP) {
    return { slug, parserChanges, endpointChanges, changed: false }
  }

  const prodParsers = new Map((prodP?.parsers ?? []).map((pr) => [pr.name, pr]))
  for (const dp of devP.parsers) {
    const pp = prodParsers.get(dp.name)
    if (!pp || pp.logicCode !== dp.logicCode || pp.version !== dp.version) {
      parserChanges.push(
        `${dp.name} (v${dp.version})` +
          (pp ? (pp.logicCode !== dp.logicCode ? ' logic changed' : ' version bump') : ' new'),
      )
    }
  }

  const devSel =
    JSON.stringify(devP.composerSelectors) + '|' + JSON.stringify(devP.sendButtonSelectors)
  const prodSel =
    JSON.stringify(prodP?.composerSelectors ?? []) + '|' + JSON.stringify(prodP?.sendButtonSelectors ?? [])
  if (devSel !== prodSel) endpointChanges.push('global selectors changed')
  const prodEps = new Map((prodP?.endpoints ?? []).map((e) => [e.label, e]))
  for (const de of devP.endpoints) {
    const pe = prodEps.get(de.label)
    if (
      pe &&
      (pe.composerSelector !== de.composerSelector ||
        pe.sendButtonSelector !== de.sendButtonSelector ||
        pe.composerType !== de.composerType ||
        pe.sendMethod !== de.sendMethod)
    ) {
      endpointChanges.push(`${de.label} endpoint config changed`)
    }
  }

  return {
    slug,
    parserChanges,
    endpointChanges,
    changed: parserChanges.length > 0 || endpointChanges.length > 0,
  }
}

export async function promoteProvider(
  db: { prisma: { providerParser: any; providerEndpoint: any; providerDefinition: any } },
  slug: string,
  dev: ProviderProtocol | null,
): Promise<PromoteResult> {
  const devP = dev?.providers.find((p) => p.slug === slug) ?? null
  if (!devP) {
    return {
      ok: false,
      provider: slug,
      delta: { slug, parserChanges: [], endpointChanges: [], changed: false },
      dbWrites: 0,
      regeneratedProd: false,
      error: `provider ${slug} not found in dev protocol`,
    }
  }

  const def = await db.prisma.providerDefinition.findFirst({ where: { slug } })
  if (!def) {
    return {
      ok: false,
      provider: slug,
      delta: { slug, parserChanges: [], endpointChanges: [], changed: false },
      dbWrites: 0,
      regeneratedProd: false,
      error: `provider ${slug} not found in DB`,
    }
  }
  const providerId = def.id
  let writes = 0

  for (const dp of devP.parsers) {
    const existing = await db.prisma.providerParser.findFirst({
      where: { providerId, parserName: dp.name },
    })
    if (existing && (existing.parserLogicCode !== dp.logicCode || existing.parserVersion !== dp.version)) {
      await db.prisma.providerParser.update({
        where: { id: existing.id },
        data: {
          parserLogicCode: dp.logicCode,
          parserHash: dp.hash || hashLogicCode(dp.logicCode),
          parserVersion: dp.version,
          isActive: dp.isActive ? 1 : 0,
        },
      })
      writes++
    }
  }

  const chatEp = devP.endpoints.find((e) => e.endpointType === 'chat')
  if (chatEp) {
    const existing = await db.prisma.providerEndpoint.findFirst({
      where: { providerId, endpointType: 'chat' },
    })
    const selectorsJson = JSON.stringify({
      composer: devP.composerSelectors?.[0] ?? '',
      send_button: devP.sendButtonSelectors?.[0] ?? '',
    })
    if (existing && (existing.selectorsJson !== selectorsJson || existing.composerType !== chatEp.composerType)) {
      await db.prisma.providerEndpoint.update({
        where: { id: existing.id },
        data: {
          selectorsJson,
          composerType: chatEp.composerType,
          sendMethod: chatEp.sendMethod,
          contentEditable: chatEp.contentEditable ? 1 : 0,
        },
      })
      writes++
    }
  }

  // Regenerate prod from the now-updated DB (dev → DB → prod), resyncing dev from new prod.
  const { ProviderProtocolGenerator } = await import('../src/engines/provider-protocol-generator.js')
  const { CapStoreDb } = await import('../src/storage/db.js')
  const capDb = db as CapStoreDb
  const gen = new ProviderProtocolGenerator(capDb)
  await gen.generate({ overwriteDev: true })

  const delta = computeProviderDelta(null, dev, slug)
  return {
    ok: true,
    provider: slug,
    delta: { ...delta, changed: writes > 0 },
    dbWrites: writes,
    regeneratedProd: true,
  }
}

export function listDevDeltas(
  prod: ProviderProtocol | null,
  dev: ProviderProtocol | null,
): ProviderDelta[] {
  const slugs = new Set<string>()
  for (const p of prod?.providers ?? []) slugs.add(p.slug)
  for (const p of dev?.providers ?? []) slugs.add(p.slug)
  return Array.from(slugs).map((s) => computeProviderDelta(prod, dev, s))
}

export { loadProtocol }
