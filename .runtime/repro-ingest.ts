// Reproduce the /api/opencode/send path and inspect what the ingest stored.
const port = (await Bun.file('.runtime/backend.port').text()).trim()
const base = `http://localhost:${port}`

const ctl = new AbortController()
const t = setTimeout(() => ctl.abort(), 20000)
let sessionId: string
try {
  const r = await fetch(`${base}/api/opencode/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'opencode/deepseek-v4-flash-free', prompt: 'Reply with exactly: vivim-opencode-live-ok' }),
    signal: ctl.signal,
  })
  clearTimeout(t)
  const j = (await r.json()) as { ok: boolean; sessionId: string }
  console.log('SEND_STATUS', r.status, JSON.stringify(j))
  sessionId = j.sessionId
} catch (e) {
  clearTimeout(t)
  console.log('SEND_ERR', String(e))
  process.exit(1)
}

await new Promise((r) => setTimeout(r, 12000))

const { PrismaClient } = await import('@prisma/client')
const p = new PrismaClient({ datasources: { db: { url: 'file:C:/0-BlackBoxProject-0/vivim-final/prisma/dev.db' } } })
await p.$connect()
const ser = (v: unknown) => JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val))
const convs = await p.conversation.findMany({ where: { providerSessionId: sessionId } })
console.log('SESS', sessionId, 'CONVS', ser(convs.map((c) => c.id)))
for (const c of convs) {
  const msgs = await p.conversationMessage.findMany({ where: { conversationId: c.id } })
  console.log('MSGS', ser(msgs.map((m) => ({ role: m.role, content: (m.content ?? '').slice(0, 200), blocks: (m.blocksJson ?? '').slice(0, 120) }))))
}
await p.$disconnect()
