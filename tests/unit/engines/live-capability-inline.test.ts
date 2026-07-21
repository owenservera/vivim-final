// tests/unit/engines/live-capability-inline.test.ts
// LiveCapabilityRegistry inline handler sandbox (Unit 2.8).

import { describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import {
  type LiveCapabilityRecord,
  LiveCapabilityRegistry,
  type LiveCapabilitySpec,
  type LiveCapabilityStore,
} from '../../../src/engines/live-capability-registry.js'
import { SandboxRunner } from '../../../src/engines/sandbox-runner.js'
import type {
  SandboxAuditRow,
  SandboxAuditStore,
} from '../../../src/storage/contracts/sandbox-audit-store.js'

function makeStore(): LiveCapabilityStore & { rows: LiveCapabilityRecord[] } {
  const rows: LiveCapabilityRecord[] = []
  return {
    rows,
    async create(record) {
      rows.push(record)
    },
    async listActive() {
      return rows.filter((r) => r.isActive)
    },
    async get(id) {
      return rows.find((r) => r.id === id) ?? null
    },
    async revoke(id) {
      const r = rows.find((x) => x.id === id)
      if (r) r.isActive = false
    },
  }
}

function makeAuditSpy(): SandboxAuditStore & { rows: SandboxAuditRow[] } {
  const rows: SandboxAuditRow[] = []
  return {
    rows,
    async create(row) {
      rows.push(row)
    },
    async list() {
      return rows
    },
  }
}

function inlineSpec(code: string): LiveCapabilitySpec {
  return {
    slug: `inline_${rows()}`,
    name: 'inline',
    description: 'inline handler',
    handlerSpec: { kind: 'inline', code },
    inputSchema: { type: 'object' },
    surfaces: ['cli'],
    registeredBy: 'tester',
  }
}
let _n = 0
function rows(): number {
  return _n++
}

const ctx = { metadata: {} } as const

describe('LiveCapabilityRegistry — inline handler sandbox', () => {
  it('executes an inline handler inside SandboxRunner (never new Function)', async () => {
    const audit = makeAuditSpy()
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      CapabilityEventBus.getInstance(),
      new SandboxRunner(audit),
    )

    const id = await reg.registerLive(inlineSpec('return { doubled: input.value * 2 }'))
    const out = (await reg.execute(`live:${id}`, { value: 21 }, ctx)) as { doubled: number }

    expect(out.doubled).toBe(42)
    // sandbox.run was invoked exactly once (one audit row written per run).
    expect(audit.rows.length).toBe(1)
    expect(audit.rows[0]?.ok).toBe(true)
  })

  it('rejects a handler that touches a forbidden global and still writes an audit row', async () => {
    const audit = makeAuditSpy()
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      CapabilityEventBus.getInstance(),
      new SandboxRunner(audit),
    )

    const id = await reg.registerLive(inlineSpec('return process.pid'))
    await expect(reg.execute(`live:${id}`, {}, ctx)).rejects.toThrow()

    expect(audit.rows.length).toBe(1)
    expect(audit.rows[0]?.ok).toBe(false)
  })

  it('aborts a budget-exceeding handler and surfaces the error', async () => {
    const audit = makeAuditSpy()
    const sandbox = new SandboxRunner(audit, {
      defaultBudget: { cpuMs: 150, memoryBytes: 64 * 1024 * 1024 },
    })
    const reg = new LiveCapabilityRegistry(makeStore(), CapabilityEventBus.getInstance(), sandbox)

    const id = await reg.registerLive(inlineSpec('while (true) {}'))
    await expect(reg.execute(`live:${id}`, {}, ctx)).rejects.toThrow()

    expect(audit.rows[0]?.ok).toBe(false)
  })
})
