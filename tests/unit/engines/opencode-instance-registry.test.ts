// tests/unit/engines/opencode-instance-registry.test.ts
// OpenCodeInstanceRegistry — durable ledger + live classifier (managed vs external).

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OpenCodeInstanceRegistry } from '../../../src/engines/opencode/opencode-instance-registry.js'

function makeRegistry(
  processes: Array<{ pid: number; commandLine: string }>,
  owners: Record<number, number> = {},
): OpenCodeInstanceRegistry {
  return new OpenCodeInstanceRegistry({
    ledgerPath: join(mkdtempSync(join(tmpdir(), 'oc-reg-')), 'instances.jsonl'),
    listProcesses: () => processes,
    ownerOfPort: (port) => owners[port] ?? null,
  })
}

describe('OpenCodeInstanceRegistry', () => {
  test('records spawn/ready/exit/stop to a durable JSONL ledger', () => {
    const r = makeRegistry([])
    const id = r.recordSpawn({ pid: 1001, port: 23863, parentPid: 9001, binary: 'opencode', cwd: '/x' })
    r.recordReady(id, 1001, 23863)
    r.recordExit(id, 1, 1001, 23863)

    const ledger = r.readLedger()
    expect(ledger).toHaveLength(3)
    expect(ledger[0].kind).toBe('spawn')
    expect(ledger[0].instanceId).toBe(id)
    expect(ledger[0].pid).toBe(1001)
    expect(ledger[0].port).toBe(23863)
    expect(ledger[0].parentPid).toBe(9001)
    expect(ledger[1].kind).toBe('ready')
    expect(ledger[2].kind).toBe('exit')
    expect(ledger[2].code).toBe(1)
  })

  test('classifies vivim-managed serve as managed and user TUI as external', () => {
    // vivim's serve instance: spawned pid 1001 owns port 23863
    const r = makeRegistry(
      [
        { pid: 1001, commandLine: '"opencode.exe" serve --port 23863 --hostname 127.0.0.1' },
        { pid: 4444, commandLine: 'opencode' },
        { pid: 5555, commandLine: 'opencode run --model x --format json hello' },
      ],
      { 23863: 1001 },
    )
    const id = r.recordSpawn({ pid: 1001, port: 23863, parentPid: 9001 })
    r.recordReady(id, 1001, 23863)

    const live = r.classifyLive()
    const managed = live.filter((p) => p.managed)
    const external = live.filter((p) => !p.managed)
    expect(managed).toHaveLength(1)
    expect(managed[0].pid).toBe(1001)
    expect(managed[0].kind).toBe('serve')
    expect(managed[0].instanceId).toBe(id)
    // The user's interactive TUI and one-shot runs are external (never killed).
    expect(external.some((p) => p.pid === 4444 && p.kind === 'other')).toBe(true)
    expect(external.some((p) => p.pid === 5555 && p.kind === 'run')).toBe(true)
  })

  test('resolves a re-exec owner PID (chocolatey shim pattern)', () => {
    // Spawn pid 1001 is the shim; the real serve listener is 6666 on the port.
    const r = makeRegistry(
      [
        { pid: 1001, commandLine: '"opencode.exe" serve --port 23863 --hostname 127.0.0.1' },
        { pid: 6666, commandLine: '"opencode.exe" serve --port 23863 --hostname 127.0.0.1' },
      ],
      { 23863: 6666 },
    )
    const id = r.recordSpawn({ pid: 1001, port: 23863, parentPid: 9001 })
    r.recordReady(id, 1001, 23863)

    const live = r.classifyLive()
    // Both the direct child (1001) and the resolved socket owner (6666) are managed.
    expect(live.filter((p) => p.managed).map((p) => p.pid).sort()).toEqual([1001, 6666])
  })

  test('ledger survives across registry instances (durable file)', () => {
    const ledgerPath = join(mkdtempSync(join(tmpdir(), 'oc-reg-')), 'instances.jsonl')
    const r1 = new OpenCodeInstanceRegistry({ ledgerPath, listProcesses: () => [], ownerOfPort: () => null })
    const id = r1.recordSpawn({ pid: 1001, port: 23863, parentPid: 9001 })
    r1.recordReady(id, 1001, 23863)

    const r2 = new OpenCodeInstanceRegistry({ ledgerPath, listProcesses: () => [], ownerOfPort: () => null })
    expect(r2.readLedger()).toHaveLength(2)
    expect(r2.liveInstances()).toHaveLength(1)
    expect(r2.liveInstances()[0].instanceId).toBe(id)
    expect(r2.liveInstances()[0].pid).toBe(1001)

    // cleanup
    try {
      rmSync(ledgerPath, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  })

  test('missing ledger file returns empty lists (best-effort reads)', () => {
    const r = makeRegistry([])
    expect(r.readLedger()).toEqual([])
    expect(r.liveInstances()).toEqual([])
    expect(r.classifyLive()).toEqual([])
    expect(r.managedServe()).toBeNull()
  })
})
