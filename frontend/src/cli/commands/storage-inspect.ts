/**
 * cli/commands/storage-inspect.ts
 * --------------------------------------------------------------------
 * bun run storage:inspect — prints a human-readable storage report.
 */

import { STORE_NAMES, probeStorage } from '../../storage/health/probe'
import { getStorageProvider } from '../../storage/provider'

async function main() {
  const provider = getStorageProvider()
  const report = await probeStorage(provider)

  console.log('')
  console.log('  vivim storage inspection')
  console.log('  ────────────────────────────────────────────────')
  console.log(`  provider:          ${report.provider}`)
  console.log(
    `  migration:         ${report.migrationProgress.migrated}/${report.migrationProgress.total} (${report.migrationProgress.pct}%)`,
  )
  console.log(`  generated at:      ${report.generatedAt}`)
  console.log('')

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

  console.log(`  ${'store'.padEnd(nameW)}  ${'impl'.padEnd(implW)}  ready  count  error`)
  console.log(
    `  ${'─'.repeat(nameW)}  ${'─'.repeat(implW)}  ─────  ─────  ──────────────────────────────`,
  )

  for (const r of rows) {
    const ready = r.ready ? 'yes' : 'NO'
    const count = r.count === null ? '—' : String(r.count)
    const error = r.error ?? ''
    console.log(
      `  ${r.name.padEnd(nameW)}  ${r.impl.padEnd(implW)}  ${ready.padEnd(5)}  ${count.padEnd(5)}  ${error}`,
    )
  }

  console.log('')
  console.log(`  ${rows.length} stores probed.`)
  console.log('')

  const allReady = rows.every((r) => r.ready)
  if (!allReady) {
    console.error('  ⚠  Some stores are not ready. See errors above.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('storage:inspect failed:', err)
  process.exit(1)
})
