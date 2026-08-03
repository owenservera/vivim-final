// src/cli/commands/migrate.ts
// Database migration command — runs pending migrations.

export async function runMigrate(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'all'

  switch (cmd) {
    case 'all': {
      const { createServerWithEngines } = await import('../../server/index.js')
      const port = Number(process.env.PORT) || 9420
      const _ctx = await createServerWithEngines(port)
      console.log('Database migrated')
      break
    }
    default:
      console.error(`Unknown migrate command: ${cmd}`)
      process.exit(1)
  }
}
