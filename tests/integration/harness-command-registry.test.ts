// tests/integration/harness-command-registry.test.ts
// 017-harness-command-registry — integration: seed manifest -> registry -> repair.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { HarnessCommandRegistry } from '../../src/engines/harness-command-registry.js'
import { HarnessRepairEngine } from '../../src/engines/harness-repair-engine.js'
import { repairString } from '../../src/schema/repair-metadata.js'
import type {
  GovernorStore,
  HarnessCommandRow,
} from '../../src/storage/contracts/governor-store.js'
import type {
  HarnessRepairStore,
  RepairSessionRow,
} from '../../src/storage/contracts/harness-repair-store.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadManifestRows(): HarnessCommandRow[] {
  const manifestPath = join(__dirname, '../../seeds/harness/commands.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commands: Array<{
      commandId: string
      version: string
      kind: string
      adaptorRef: string
      description: string
      paramsSchema: unknown
    }>
  }
  return manifest.commands.map((c) => ({
    id: `${c.commandId}@${c.version}`,
    commandId: c.commandId,
    version: c.version,
    kind: c.kind,
    paramsSchemaJson: JSON.stringify(c.paramsSchema ?? {}),
    adaptorRef: c.adaptorRef,
    description: c.description,
    createdAt: 0,
    updatedAt: 0,
  }))
}

function inMemoryGovernor(rows: HarnessCommandRow[]): GovernorStore {
  const byKey = new Map<string, HarnessCommandRow>()
  const byCmd = new Map<string, HarnessCommandRow[]>()
  for (const r of rows) {
    byKey.set(`${r.commandId}@${r.version}`, r)
    if (!byCmd.has(r.commandId)) byCmd.set(r.commandId, [])
    byCmd.get(r.commandId)?.push(r)
  }
  return {
    getHarnessCommand: (cmd: string, ver: string) =>
      Promise.resolve(byKey.get(`${cmd}@${ver}`) ?? null),
    listHarnessCommands: (cmd: string) => Promise.resolve(byCmd.get(cmd) ?? []),
    upsertHarnessCommand: (_cmd: HarnessCommandRow) => Promise.resolve(),
    getProviderFleetConfig: (_slug: string) => Promise.resolve(null),
  } as unknown as GovernorStore
}

function inMemoryRepairStore(): HarnessRepairStore & { sessions: RepairSessionRow[] } {
  const sessions: RepairSessionRow[] = []
  return {
    sessions,
    saveRepairSession: (row) => {
      sessions.push(row)
      return Promise.resolve()
    },
    getRepairSession: () => Promise.resolve(null),
  }
}

describe('harness registry + repair integration', () => {
  it('resolves a seeded command and validates params against its schema', async () => {
    const rows = loadManifestRows()
    const reg = new HarnessCommandRegistry(inMemoryGovernor(rows))
    const cmd = await reg.resolve('harness.navigation@latest')
    expect(cmd.commandId).toBe('harness.navigation')
    const ok = reg.validateParams(cmd, { action: 'navigate', url: 'https://x.ai' })
    expect(ok.success).toBe(true)
    const bad = reg.validateParams(cmd, { url: 'https://x.ai' }) // missing required `action`
    expect(bad.success).toBe(false)
  })

  it('repair engine + registry cooperate on a malformed payload', async () => {
    const rows = loadManifestRows()
    const reg = new HarnessCommandRegistry(inMemoryGovernor(rows))
    const cmd = await reg.resolve('harness.selector@latest')
    const engine = new HarnessRepairEngine(inMemoryRepairStore())
    const res = await engine.repair({
      content: '```json\n{"action":"click","selector":"#go","timeoutMs":5000,}\n```',
      schema: cmd.paramsSchema,
    })
    expect(res.ok).toBe(true)
    expect(res.repairs).toContain('removed_trailing_comma')
  })

  it('repairString-applied schema survives the repair pipeline', async () => {
    const engine = new HarnessRepairEngine(inMemoryRepairStore())
    const res = await engine.repair({
      content: JSON.stringify({ label: "O'Brien" }),
      schema: z.object({ label: repairString() }),
    })
    expect(res.ok).toBe(true)
    expect((res.data as { label: string }).label).toBe("O'Brien")
  })
})
