// seeds/harness/commands.seed.ts
// Idempotent seeder for the harness command registry (017-harness-command-registry).
// Authoritative data source: commands.json (mirrors AGENTS.md seed convention).
// Run via: bun run src/engines/... or at server boot through the seed pipeline.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { newId } from '../../src/ids.js'
import type { CapStoreDb } from '../../src/storage/db.js'
import { GovernorStoreImpl } from '../../src/storage/impl/governor-store-impl.js'

interface CommandManifestEntry {
  commandId: string
  version: string
  kind: string
  adaptorRef?: string
  description?: string
  paramsSchema: unknown
}

interface CommandManifest {
  version: string
  commands: CommandManifestEntry[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function seedHarnessCommands(db: CapStoreDb): Promise<number> {
  const manifestPath = join(__dirname, 'commands.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CommandManifest
  const store = new GovernorStoreImpl(db)
  const now = Date.now()
  let count = 0

  for (const cmd of manifest.commands) {
    await store.upsertHarnessCommand({
      id: newId(),
      commandId: cmd.commandId,
      version: cmd.version,
      kind: cmd.kind,
      paramsSchemaJson: JSON.stringify(cmd.paramsSchema ?? {}),
      adaptorRef: cmd.adaptorRef ?? 'ChromeGovernor.executeHarnessPlan',
      description: cmd.description ?? '',
      createdAt: now,
      updatedAt: now,
    })
    count++
  }
  return count
}
