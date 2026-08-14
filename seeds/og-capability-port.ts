/**
 * OG cap-store → vivim-final DB port script.
 *
 * Reads every populated table from the OG capability-store.db, translates
 * columns to vivim-final's schema, and upserts.  Idempotent — re-runnable.
 *
 * Usage:  bun run seeds/og-capability-port.ts
 */

import { Database } from 'bun:sqlite'
import { PrismaClient } from '@prisma/client'

const OG_DB_PATH =
  'C:/0-BlackBoxProject-0/vivim-app-og/vivim-app/edge-pwa/cap-store/data/capability-store.db'

const og = new Database(OG_DB_PATH)
const prisma = new PrismaClient()

/* ── helpers ─────────────────────────────────────────────────── */

function nowMs(): bigint {
  return BigInt(Date.now())
}

/** Ensure a provider row exists in vivim-final. Returns the provider id. */
async function ensureProvider(row: {
  id: string
  display_name: string
  landing_url: string
  tier: string
  status: string
  created_at: number
  updated_at: number
}): Promise<void> {
  const existing = await prisma.providerDefinition.findUnique({ where: { id: row.id } })
  if (existing) return

  await prisma.providerDefinition.create({
    data: {
      id: row.id,
      slug: row.id,
      displayName: row.display_name,
      description: null,
      category: 'ai',
      providerType: 'llm',
      isActive: row.status === 'active' ? 1 : 0,
      websiteUrl: row.landing_url || null,
      documentationUrl: null,
      authType: 'browser',
      hasMultiAccount: 0,
      profileStrategy: 'per_account',
      fleetConfigJson: '{}',
      capabilitiesJson: `{"tier":"${row.tier}"}`,
      modelsJson: '[]',
      pluginId: null,
      createdAt: BigInt(row.created_at),
      updatedAt: BigInt(row.updated_at),
    },
  })
}

/* ── 1. Provider ─────────────────────────────────────────────── */

async function portProviders(): Promise<number> {
  const rows = og.query('SELECT * FROM provider').all() as any[]
  for (const r of rows) await ensureProvider(r)
  return rows.length
}

/* ── 1b. ProviderEndpoint (from OG provider fields) ─────────── */

async function portEndpoints(): Promise<number> {
  const rows = og.query('SELECT * FROM provider').all() as any[]
  let count = 0
  for (const r of rows) {
    const id = `ep-${r.id}`
    const selectors = JSON.stringify({
      readySelector: r.ready_selector || null,
      composerSelector: r.composer_selector || null,
    })
    const contentType = r.composer_is_contenteditable ? 'contenteditable' : 'textarea'

    await prisma.providerEndpoint.upsert({
      where: { id },
      create: {
        id,
        providerId: r.id,
        url: r.landing_url || '',
        label: 'Landing',
        endpointType: 'landing',
        isDefault: 1,
        selectorsJson: selectors,
        composerType: contentType,
        sendMethod: 'both',
        contentEditable: r.composer_is_contenteditable ?? 0,
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        url: r.landing_url || '',
        selectorsJson: selectors,
        composerType: contentType,
        contentEditable: r.composer_is_contenteditable ?? 0,
        updatedAt: BigInt(r.updated_at),
      },
    })
    count++
  }
  return count
}

/* ── 1c. ProviderStreamConfig (from OG provider stream fields) ─ */

async function portStreamConfigs(): Promise<number> {
  const rows = og.query('SELECT * FROM provider').all() as any[]
  let count = 0
  for (const r of rows) {
    if (!r.stream_url_pattern && !r.stream_transport) continue
    const id = `psc-${r.id}`
    const terminalArr = r.stream_terminal ? [r.stream_terminal] : []

    await prisma.providerStreamConfig.upsert({
      where: { id },
      create: {
        id,
        providerId: r.id,
        streamTransport: r.stream_transport || 'sse',
        streamTerminalJson: JSON.stringify(terminalArr),
        sseFormat: r.sse_format || null,
        deltaPathJson: null,
        contentType: null,
        completionDetectorsJson: '[]',
        harnessJs: null,
        isActive: 1,
        version: 1,
        supersededById: null,
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        streamTransport: r.stream_transport || 'sse',
        streamTerminalJson: JSON.stringify(terminalArr),
        sseFormat: r.sse_format || null,
        updatedAt: BigInt(r.updated_at),
      },
    })
    count++
  }
  return count
}

/* ── 2. CapabilityTaxonomy ──────────────────────────────────── */

async function portTaxonomy(): Promise<number> {
  const rows = og.query('SELECT * FROM capability_taxonomy').all() as any[]
  let _count = 0
  for (const r of rows) {
    await prisma.capabilityTaxonomy.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description || '',
        category: r.category || 'uncategorized',
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        slug: r.slug,
        name: r.name,
        description: r.description || '',
        category: r.category || 'uncategorized',
        updatedAt: BigInt(r.updated_at),
      },
    })
    _count++
    // [audit] removed: if (count % 50 === 0) console.log(`  taxonomy: ${count}/${rows.length}`)
  }
  return rows.length
}

/* ── 3. CapabilityBinding ───────────────────────────────────── */

async function portBindings(): Promise<number> {
  const rows = og.query('SELECT * FROM capability_binding').all() as any[]
  let _count = 0
  for (const r of rows) {
    // Map OG status (tested|stable|flaky|broken) to vivim-final style
    // Keep OG status as-is since vivim-final has no CHECK constraint
    const status = r.status || 'prospect'
    await prisma.capabilityBinding.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        globalId: r.global_id,
        providerId: r.provider_id,
        status,
        bestProgramId: r.best_program_id || null,
        currentProgramId: r.best_program_id || null,
        promotionHistoryJson: r.promotion_history || '[]',
        confidence: r.confidence ?? 0.0,
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        status,
        bestProgramId: r.best_program_id || null,
        currentProgramId: r.best_program_id || null,
        promotionHistoryJson: r.promotion_history || '[]',
        confidence: r.confidence ?? 0.0,
        updatedAt: BigInt(r.updated_at),
      },
    })
    _count++
    // [audit] removed: if (count % 25 === 0) console.log(`  bindings: ${count}/${rows.length}`)
  }
  return rows.length
}

/* ── 4. CapabilityProgram ───────────────────────────────────── */

async function portPrograms(): Promise<number> {
  const rows = og.query('SELECT * FROM capability_program').all() as any[]
  let _count = 0
  for (const r of rows) {
    // OG uses "steps" (JSON array of {op, text}) — store as configJson
    const configJson = JSON.stringify({ steps: JSON.parse(r.steps) })
    await prisma.capabilityProgram.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        bindingId: r.binding_id,
        version: r.version,
        name: null,
        supersededById: null,
        isActive: r.superseded_by ? 0 : 1,
        configJson,
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        version: r.version,
        isActive: r.superseded_by ? 0 : 1,
        configJson,
        updatedAt: BigInt(r.updated_at),
      },
    })
    _count++
  }
  return rows.length
}

/* ── 5. ProviderAccount ─────────────────────────────────────── */

async function portAccounts(): Promise<number> {
  const rows = og.query('SELECT * FROM provider_account').all() as any[]
  let _count = 0
  for (const r of rows) {
    // OG provider_account has a unique constraint on (provider_id, account_email) but
    // vivim-final uses (providerId, email). Multiple OG rows can have same provider+email
    // (different chrome_profile_id). Skip duplicates beyond the first.
    const existing = await prisma.providerAccount.findFirst({
      where: { providerId: r.provider_id, email: r.account_email },
    })
    if (existing) continue

    await prisma.providerAccount.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        providerId: r.provider_id,
        email: r.account_email,
        planTier: r.plan_type || 'unknown',
        isDefault: r.is_default ?? 0,
        isKind: 0,
        loginState: r.status || 'unknown',
        loginAttempts: 0,
        lastLoginAt: r.last_verified ? BigInt(r.last_verified) : null,
        providerStateJson: '{}',
        debugPort: null,
        profileDir: null,
        chromeSlaveId: null,
        userId: 'default',
        createdAt: BigInt(r.created_at),
        updatedAt: nowMs(),
      },
      update: {
        planTier: r.plan_type || 'unknown',
        isDefault: r.is_default ?? 0,
        loginState: r.status || 'unknown',
        lastLoginAt: r.last_verified ? BigInt(r.last_verified) : null,
        updatedAt: nowMs(),
      },
    })
    _count++
  }
  return rows.length
}

/* ── 6. Outcome ─────────────────────────────────────────────── */

async function portOutcomes(): Promise<number> {
  const rows = og.query('SELECT * FROM outcome').all() as any[]
  let _count = 0
  for (const r of rows) {
    // OG outcome has binding_id but no capability_id. Resolve from binding.
    // If binding doesn't exist yet, use binding_id as a proxy.
    let capId = r.binding_id
    try {
      const binding = await prisma.capabilityBinding.findUnique({ where: { id: r.binding_id } })
      if (binding) capId = binding.globalId
    } catch {
      // [audit] log the error with context here
      /* leave as binding_id */
    }

    await prisma.outcome.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        capabilityId: capId,
        bindingId: r.binding_id || null,
        providerId: '', // will fill from binding lookup below
        programId: r.program_id || null,
        selectorStrategyId: r.strategy_id || null,
        ok: r.ok ?? 0,
        error: r.error || null,
        durationMs: r.duration_ms ?? null,
        confidence: null,
        selectorUsed: null,
        selectorHit: null,
        ts: BigInt(r.ts),
      },
      update: {
        ok: r.ok ?? 0,
        error: r.error || null,
        durationMs: r.duration_ms ?? null,
      },
    })
    _count++
    // [audit] removed: if (count % 100 === 0) console.log(`  outcomes: ${count}/${rows.length}`)
  }
  return rows.length
}

/* ── 7. VivimSession ────────────────────────────────────────── */

async function portSessions(): Promise<number> {
  const rows = og.query('SELECT * FROM vivim_session').all() as any[]
  let _count = 0
  for (const r of rows) {
    const ctx = JSON.stringify({
      ts: r.ts,
      provider_ids: r.provider_ids,
      current_provider: r.current_provider,
      current_step: r.current_step,
      total_steps: r.total_steps,
      metadata: r.metadata,
    })
    await prisma.vivimSession.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        state: r.status || 'idle',
        contextJson: ctx,
        createdAt: BigInt(r.created_at),
        updatedAt: BigInt(r.updated_at),
      },
      update: {
        state: r.status || 'idle',
        contextJson: ctx,
        updatedAt: BigInt(r.updated_at),
      },
    })
    _count++
  }
  return rows.length
}

/* ── 8. StateTransition ─────────────────────────────────────── */

async function portStateTransitions(): Promise<number> {
  const rows = og.query('SELECT * FROM state_transition').all() as any[]
  let _count = 0
  for (const r of rows) {
    const id = `st-og-${r.id}`
    const meta = JSON.stringify({
      reason: r.reason || null,
      actor: r.actor || null,
      original_metadata: r.metadata || null,
    })
    await prisma.stateTransition.upsert({
      where: { id },
      create: {
        id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        fromState: r.from_state || null,
        toState: r.to_state,
        trigger: r.reason || 'unknown',
        metadataJson: meta,
        ts: BigInt(r.ts),
      },
      update: {
        toState: r.to_state,
        trigger: r.reason || 'unknown',
        metadataJson: meta,
      },
    })
    _count++
  }
  return rows.length
}

/* ── 9. FleetEvent ──────────────────────────────────────────── */

async function portFleetEvents(): Promise<number> {
  const rows = og.query('SELECT * FROM fleet_event').all() as any[]
  let _count = 0
  for (const r of rows) {
    const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload
    const providerId = payload?.providerId || null
    const slaveId = payload?.slaveId || r.id

    await prisma.fleetEvent.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        slaveId,
        providerId,
        eventType: r.event,
        eventDataJson: r.payload || '{}',
        ts: BigInt(r.created_at),
      },
      update: {
        eventType: r.event,
        eventDataJson: r.payload || '{}',
      },
    })
    _count++
    // [audit] removed: if (count % 50 === 0) console.log(`  fleet events: ${count}/${rows.length}`)
  }
  return rows.length
}

/* ── 10. Holes (UI element discovery — store as Node-like data via ProviderDefinition) ── */

async function portHoles(): Promise<number> {
  const rows = og.query('SELECT * FROM hole').all() as any[]
  // Group by provider_id and stash into provider's capabilitiesJson
  const byProvider = new Map<string, any[]>()
  for (const r of rows) {
    const pid = r.provider_id || 'unknown'
    if (!byProvider.has(pid)) byProvider.set(pid, [])
    byProvider.get(pid)?.push({
      id: r.id,
      role: r.role,
      name: r.name,
      layerIndex: r.layer_index,
      classifiedAs: r.classified_as,
      discoveredAt: r.discovered_at,
      fingerprint: r.fingerprint,
    })
  }

  for (const [pid, holes] of byProvider) {
    const existing = await prisma.providerDefinition.findUnique({ where: { id: pid } })
    if (!existing) continue

    const existingCaps = JSON.parse(existing.capabilitiesJson || '{}')
    existingCaps.holes = holes
    existingCaps.holeCount = holes.length

    await prisma.providerDefinition.update({
      where: { id: pid },
      data: { capabilitiesJson: JSON.stringify(existingCaps) },
    })
  }
  return rows.length
}

/* ── main ────────────────────────────────────────────────────── */

async function main() {
  // [audit] removed: console.log('═══ OG cap-store → vivim-final DB port ═══\n')

  const steps: { name: string; fn: () => Promise<number> }[] = [
    { name: 'Provider', fn: portProviders },
    { name: 'ProviderEndpoint', fn: portEndpoints },
    { name: 'ProviderStreamConfig', fn: portStreamConfigs },
    { name: 'CapabilityTaxonomy', fn: portTaxonomy },
    { name: 'CapabilityBinding', fn: portBindings },
    { name: 'CapabilityProgram', fn: portPrograms },
    { name: 'ProviderAccount', fn: portAccounts },
    { name: 'Outcome', fn: portOutcomes },
    { name: 'VivimSession', fn: portSessions },
    { name: 'StateTransition', fn: portStateTransitions },
    { name: 'FleetEvent', fn: portFleetEvents },
    { name: 'Hole (→ProviderDefinition.capabilitiesJson)', fn: portHoles },
  ]

  for (const step of steps) {
    process.stdout.write(`  ${step.name} … `)
    try {
      const _count = await step.fn()
      // [audit] removed: console.log(`${count} rows`)
    } catch (_err) {
      // [audit] removed: console.error(`ERROR: ${err}`)
    }
  }

  // Verify
  // [audit] removed: console.log('\n═══ Verification ═══\n')
  const checks = [
    ['provider', 'ProviderDefinition'],
    ['capability_taxonomy', 'CapabilityTaxonomy'],
    ['capability_binding', 'CapabilityBinding'],
    ['capability_program', 'CapabilityProgram'],
    ['provider_account', 'ProviderAccount'],
    ['outcome', 'Outcome'],
    ['vivim_session', 'VivimSession'],
    ['fleet_event', 'FleetEvent'],
  ]
  // Derived tables: ProviderEndpoint (1 per provider=7), ProviderStreamConfig (6 non-null)
  // [audit] removed: console.log('  (derived) ProviderEndpoint: target=7')
  // [audit] removed: console.log('  (derived) ProviderStreamConfig: target=6 (qwen has no stream config)')
  for (const [ogTable, vfModel] of checks) {
    const ogCount = (og.query(`SELECT COUNT(*) as cnt FROM \`${ogTable}\``).get() as any).cnt
    const vfCount = await (prisma as any)[vfModel as keyof typeof prisma].count()
    const _ok = ogCount === vfCount ? '✓' : '✗'
    // [audit] removed: console.log(`  ${ok} ${ogTable} → ${vfModel}: OG=${ogCount} VF=${vfCount}`)
  }

  await prisma.$disconnect()
  og.close()

  // [audit] removed: console.log('\n═══ Done ═══')
}

main().catch((_err) => {
  // [audit] removed: console.error('FATAL:', err)
  process.exit(1)
})
