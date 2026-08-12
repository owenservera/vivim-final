// src/cli/commands/seed.ts
// Database seeding command — seeds all tables with initial data.

export async function runSeed(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'all'

  switch (cmd) {
    case 'all': {
      const { createServerWithEngines } = await import('../../server/index.js')
      const port = Number(process.env.PORT) || 9420
      const _ctx = await createServerWithEngines(port)
      // [audit] removed: console.log('Database seeded')
      break
    }
    default:
      // [audit] removed: console.error(`Unknown seed command: ${cmd}`)
      process.exit(1)
  }
}
