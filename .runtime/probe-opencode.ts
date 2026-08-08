// Probe opencode serve + ingest state via the backend API (bun, not PS pipeline).
import { PrismaClient } from '@prisma/client'

const port = (await Bun.file('.runtime/backend.port').text()).trim()
const base = `http://localhost:${port}`
const DB = process.env.DATABASE_URL ?? ''

async function jsonGet(path: string): Promise<unknown> {
  const r = await fetch(`${base}${path}`)
  return r.json()
}

console.log('=== backend port', port, '===')
console.log('health:', JSON.stringify(await jsonGet('/health')))

const caps = (await jsonGet('/api/capabilities?surface=cli')) as { capabilities?: Array<{ slug: string }> }
console.log('total cli caps:', caps.capabilities?.length ?? 0)
const opencodeCaps = (caps.capabilities ?? []).filter((c) => c.slug.includes('opencode') || c.slug.includes('agent'))
console.log('opencode/agent caps:', JSON.stringify(opencodeCaps.map((c) => c.slug)))

const sessions = (await jsonGet('/api/opencode/sessions')) as { ok: boolean; sessions?: unknown[]; text?: string }
console.log('backend /api/opencode/sessions:', JSON.stringify(sessions))

// Query DB directly for ingest landings
if (DB.startsWith('file:')) {
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } } as never)
  try {
    const agentSessions = await (prisma as unknown as { agentSession: { findMany: (a: never) => Promise<unknown[]> } }).agentSession.findMany({} as never)
    console.log('DB AgentSession rows:', (agentSessions as unknown[]).length)
    for (const a of agentSessions as Array<{ id: string; sessionId?: string; providerSessionId?: string; model?: string }>) {
      console.log('  agentSession:', JSON.stringify(a))
    }
  } catch (e) {
    console.log('agentSession query error:', e instanceof Error ? e.message : String(e))
  }
  try {
    const model = (prisma as unknown as { provider_model: { findMany: (a: never) => Promise<unknown[]> } }).provider_model
    if (model) {
      const rows = await model.findMany({} as never)
      const active = (rows as Array<{ slug?: string; isActive?: boolean }>).filter((r) => r.isActive)
      console.log('DB active opencode models:', (active as unknown[]).length, JSON.stringify((active as Array<{ slug?: string }>).map((r) => r.slug)))
    }
  } catch {
    // provider_model table may be named differently
  }
} else {
  console.log('DATABASE_URL is not a file url:', DB)
}
