// .runtime/probe-oc-events.ts — print FULL frames for delta/idle/status/error events
import { readFileSync } from 'fs'
import { join } from 'path'

const RUNTIME = join(process.cwd(), '.runtime')
function port(): number | null {
  const raw = readFileSync(join(RUNTIME, 'backend.log'), 'utf8').replace(/\x1b\[[0-9;]*m/g, '')
  const lines = raw.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('OpenCode serve supervisor started')) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const m = lines[j].match(/port:\s*(\d+)/)
        if (m) return Number(m[1])
      }
    }
  }
  return null
}

const base = `http://127.0.0.1:${port()}`
const auth = `Basic ${Buffer.from('opencode:opencode-test-pw').toString('base64')}`
const H = { Authorization: auth, 'Content-Type': 'application/json' }

async function main(): Promise<void> {
  const model = { id: 'deepseek-v4-flash-free', providerID: 'opencode' }
  const cr = await fetch(`${base}/session`, { method: 'POST', headers: H, body: JSON.stringify({ model }), signal: AbortSignal.timeout(30_000) })
  const sid = (JSON.parse(await cr.text()) as { id: string }).id
  console.log(`session=${sid}`)

  const ac = new AbortController()
  let doneRes: () => void
  const doneP = new Promise<void>((r) => { doneRes = r })
  const evRes = await fetch(`${base}/event?session=${sid}`, { headers: { Authorization: auth, Accept: 'text/event-stream' }, signal: ac.signal })
  const reader = evRes.body?.getReader()
  if (!reader) return
  const dec = new TextDecoder()
  let buf = ''
  const interesting = 0
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl = buf.indexOf('\n')
      while (nl >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (line && !line.startsWith(':')) {
          const frame = line.startsWith('data:') ? line.slice(5).trim() : line
          try {
            const ev = JSON.parse(frame) as Record<string, unknown>
            const t = String(ev.type ?? '')
            if (/delta|idle|status|error|finish/.test(t)) {
              console.log(`\n<<< ${t} >>>`)
              console.log(JSON.stringify(ev).slice(0, 900))
            }
            if (t === 'session.idle' || t === 'error') doneRes()
          } catch { /* skip */ }
        }
        nl = buf.indexOf('\n')
      }
    }
  })()

  await new Promise((r) => setTimeout(r, 500))
  const pr = await fetch(`${base}/session/${sid}/prompt_async`, { method: 'POST', headers: H, body: JSON.stringify({ parts: [{ type: 'text', text: 'Reply with exactly: EVENT-PROBE-OK' }] }), signal: AbortSignal.timeout(30_000) })
  console.log(`prompt_async -> ${pr.status}`)

  await Promise.race([doneP, new Promise<void>((r) => setTimeout(r, 90_000))])
  try { ac.abort() } catch { /* noop */ }
  await new Promise((r) => setTimeout(r, 300))
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
