/**
 * cli/commands/storage-inspect.ts
 * --------------------------------------------------------------------
 * bun run storage:inspect — prints a human-readable storage report.
 */

import { probeStorage, STORE_NAMES } from '../../storage/health/probe'
import { getStorageProvider } from '../../storage/provider'

async function main() {
  const provider = getStorageProvider()
  const report = await probeStorage(provider)

  const rows = STORE_NAMES.map((name) => ({
    name,
    ...report.stores[name],
  }))

  rows.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? 1 : -1
    return a.name.localeCompare(b.name)
  })

  const nameW = Math.max(...rows.map((r) => r.name.length), 20)
  const implW = Math.max(...rows.map((r) => r.impl.length), 24)

  for (const r of rows) {
    const ready = r.ready ? 'yes' : 'NO'
    const count = r.count === null ? '—' : String(r.count)
    const error = r.error ?? ''
  }

  const allReady = rows.every((r) => r.ready)
  if (!allReady) {
    process.exit(1)
  }
}

main().catch((err) => {
  process.exit(1)
})
