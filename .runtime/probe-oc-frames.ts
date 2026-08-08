// Live SSE frame capture for a real opencode session to inspect v1.18.4 delta semantics.
import { OpenCodeClient } from '../src/engines/opencode/opencode-client.js'

const port = Number((await Bun.file('.runtime/backend.port').text()).trim())
const pw = 'opencode-test-pw'

const client = new OpenCodeClient({ port: 1, password: pw, username: 'opencode' })
// We need the actual serve port — parse from backend.log supervisor line
const log = await Bun.file('.runtime/backend.log').text()
const m = log.match(/OpenCode serve supervisor started.*?port[^\d]*(\d+)/i) ?? log.match(/supervisor.*?(\d{4})/)
console.log('SUPERVISOR_MATCH', m?.[1])

// Supervisor port discovery via probing
async function findServePort(): Promise<number> {
  for (const p of [3480, 3510, 3520, 3530, 3540, 3550]) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/doc`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`opencode:${pw}`).toString('base64') },
        signal: AbortSignal.timeout(1500),
      })
      if (r.ok) return p
    } catch {
      // keep probing
    }
  }
  throw new Error('serve port not found')
}

const servePort = await findServePort()
console.log('SERVE_PORT', servePort)

const serve = new OpenCodeClient({ port: servePort, password: pw, username: 'opencode' })
const { sessionId } = await serve.createSession({ model: 'opencode/deepseek-v4-flash-free' })
console.log('SESSION', sessionId)

const frames: string[] = []
let textAccum = ''
const done = new Promise<void>((resolve) => {
  const timer = setTimeout(() => resolve(), 45000)
  void serve.subscribe(sessionId, (ev) => {
    const t = ev.properties?.field === 'text' ? ev.properties.delta : undefined
    frames.push(JSON.stringify(ev).slice(0, 400))
    if (typeof t === 'string') textAccum += t
    if (ev.type === 'session.idle' || ev.properties?.status?.type === 'idle') {
      clearTimeout(timer)
      resolve()
    }
  })
})

await serve.sendPrompt(sessionId, 'Reply with exactly: vivim-opencode-live-ok')
await done

console.log('ACCUM_TEXT', JSON.stringify(textAccum))
console.log('FRAME_COUNT', frames.length)
for (let i = 0; i < frames.length; i++) {
  console.log(`F${i}`, frames[i])
}
