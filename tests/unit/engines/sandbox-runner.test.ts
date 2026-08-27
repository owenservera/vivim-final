import { describe, expect, it } from 'bun:test'
import type { SandboxPermissions } from '../../../src/engines/sandbox-runner.js'
import { SandboxRunner } from '../../../src/engines/sandbox-runner.js'
import type {
  SandboxAuditRow,
  SandboxAuditStore,
} from '../../../src/storage/contracts/sandbox-audit-store.js'

function makeStore(): { store: SandboxAuditStore; rows: SandboxAuditRow[] } {
  const rows: SandboxAuditRow[] = []
  return {
    rows,
    store: {
      async create(row) {
        rows.push(row)
      },
      async list(limit = 100) {
        return rows.slice(0, limit)
      },
    },
  }
}

const ALLOW_ALL: SandboxPermissions = {
  canFetch: ['*'],
  canReadFile: ['*'],
  canWriteFile: ['*'],
  canUseClipboard: false,
}

describe('SandboxRunner', () => {
  it('executes trusted handler code and returns output', async () => {
    const { store, rows } = makeStore()
    const runner = new SandboxRunner(store)
    const res = await runner.run('return (input.a + input.b);', { a: 2, b: 3 }, ALLOW_ALL)
    expect(res.ok).toBe(true)
    expect(res.output).toBe(5)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.ok).toBe(true)
  })

  it('exposes NO process / require / fetch and blocks the constructor escape', async () => {
    const { store } = makeStore()
    const runner = new SandboxRunner(store)
    const res = await runner.run(
      [
        'const escape = (() => {',
        "  try { return globalThis.constructor.constructor('return process')(); }",
        "  catch (e) { return 'blocked'; }",
        '})();',
        'return JSON.stringify({',
        '  process: typeof process,',
        '  require: typeof require,',
        '  fetch: typeof fetch,',
        '  globalProcess: typeof globalThis.process,',
        '  escape: escape',
        '});',
      ].join('\n'),
      {},
      ALLOW_ALL,
    )
    expect(res.ok).toBe(true)
    const seen = JSON.parse(res.output as string)
    expect(seen.process).toBe('undefined')
    expect(seen.require).toBe('undefined')
    expect(seen.fetch).toBe('undefined')
    expect(seen.globalProcess).toBe('undefined')
    // null-prototype sandbox: globalThis has no .constructor to escape through
    expect(seen.escape).toBe('blocked')
  })

  it('aborts handlers exceeding the CPU budget', async () => {
    const { store, rows } = makeStore()
    const runner = new SandboxRunner(store)
    const res = await runner.run(
      'while (true) {}', // infinite loop
      {},
      ALLOW_ALL,
      { budget: { cpuMs: 50 } },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/budget|exceeded|timeout/i)
    expect(rows[0]?.ok).toBe(false)
    expect(rows[0]?.error).not.toBeNull()
  })

  it('aborts and audits when the memory budget is breached', async () => {
    const { store, rows } = makeStore()
    // Inject a probe that always reports a breach so the test is deterministic.
    const runner = new SandboxRunner(store, {
      memoryProbe: () => ({ heapUsed: 999_999_999_999 }),
    })
    const res = await runner.run('return 1;', {}, ALLOW_ALL, {
      budget: { memoryBytes: 1 },
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/memory/i)
    expect(rows[0]?.ok).toBe(false)
  })

  it('records the error message when handler code throws', async () => {
    const { store, rows } = makeStore()
    const runner = new SandboxRunner(store)
    const res = await runner.run("throw new Error('boom');", {}, ALLOW_ALL)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/boom/)
    expect(rows[0]?.ok).toBe(false)
    expect(rows[0]?.error).toMatch(/boom/)
  })

  it('guards the clipboard even when canUseClipboard is false', async () => {
    const { store } = makeStore()
    const runner = new SandboxRunner(store)
    const res = await runner.run(
      'return typeof navigator;',
      {},
      { ...ALLOW_ALL, canUseClipboard: false },
    )
    // navigator is only exposed when explicitly granted
    expect(res.output).toBe('undefined')
  })
})
