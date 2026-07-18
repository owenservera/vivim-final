// tests/unit/engines/harness-command-registry.test.ts
// 017-harness-command-registry — HarnessCommandRegistry (semver) + FeedbackCoordinator.
import { describe, expect, it } from 'bun:test'
import { HarnessCommandRegistry } from '../../../src/engines/harness-command-registry.js'
import { HarnessFeedbackCoordinator } from '../../../src/engines/harness-feedback-coordinator.js'
import { HarnessCommandNotFoundError } from '../../../src/errors.js'
import type {
  GovernorStore,
  HarnessCommandRow,
} from '../../../src/storage/contracts/governor-store.js'

function makeStore(rows: HarnessCommandRow[]): GovernorStore {
  const map = new Map<string, HarnessCommandRow[]>()
  for (const r of rows) {
    const key = r.commandId
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(r)
  }
  return {
    getHarnessCommand: (cmd: string, ver: string) =>
      Promise.resolve(rows.find((r) => r.commandId === cmd && r.version === ver) ?? null),
    listHarnessCommands: (cmd: string) => Promise.resolve(map.get(cmd) ?? []),
    upsertHarnessCommand: (_cmd: HarnessCommandRow) => Promise.resolve(),
    getProviderFleetConfig: (_slug: string) => Promise.resolve(null),
  } as unknown as GovernorStore
}

const base = (commandId: string, version: string): HarnessCommandRow => ({
  id: `${commandId}@${version}`,
  commandId,
  version,
  kind: 'action',
  paramsSchemaJson: '{"type":"object","properties":{"x":{"type":"string"}},"required":["x"]}',
  adaptorRef: 'ChromeGovernor.executeHarnessPlan',
  description: commandId,
  createdAt: 0,
  updatedAt: 0,
})

describe('HarnessCommandRegistry version resolution', () => {
  it('resolves @latest using SEMVER order (1.10.0 > 1.9.0)', async () => {
    const store = makeStore([
      base('harness.x', '1.9.0'),
      base('harness.x', '1.10.0'),
      base('harness.x', '1.2.0'),
    ])
    const reg = new HarnessCommandRegistry(store)
    const resolved = await reg.resolve('harness.x@latest')
    expect(resolved.version).toBe('1.10.0')
  })

  it('throws HarnessCommandNotFoundError for unknown command', async () => {
    const reg = new HarnessCommandRegistry(makeStore([]))
    await expect(reg.resolve('nope@latest')).rejects.toBeInstanceOf(HarnessCommandNotFoundError)
  })

  it('resolves an explicit version', async () => {
    const reg = new HarnessCommandRegistry(makeStore([base('harness.y', '2.0.0')]))
    const resolved = await reg.resolve('harness.y@2.0.0')
    expect(resolved.version).toBe('2.0.0')
  })
})

describe('HarnessFeedbackCoordinator backoff + diff', () => {
  it('converges and does NOT repeat the same prompt across rounds', async () => {
    const coord = new HarnessFeedbackCoordinator({ maxRounds: 3 })
    const seen = new Set<string>()
    const outcome = await coord.run(
      'Produce JSON',
      (prompt) => {
        seen.add(prompt)
        return Promise.resolve('{"ok":true}')
      },
      (content) => content.includes('ok'),
    )
    expect(outcome.ok).toBe(true)
    expect(seen.size).toBe(1) // only one round ran (accepted immediately)
  })

  it('escalates strategy each round and only differs on retry (defect fix)', async () => {
    const coord = new HarnessFeedbackCoordinator({ maxRounds: 3 })
    const strategies: string[] = []
    const prompts: string[] = []
    await coord.run(
      'Produce JSON',
      (prompt, strategy) => {
        strategies.push(strategy)
        prompts.push(prompt)
        return Promise.resolve('partial') // never accepted
      },
      () => false,
    )
    expect(strategies).toEqual(['initial', 'repair', 'elaborate'])
    // Prompts must be DIFFERENT each round (no verbatim repeat).
    expect(new Set(prompts).size).toBe(3)
    expect(prompts[1]).toContain('Prior output')
  })
})
