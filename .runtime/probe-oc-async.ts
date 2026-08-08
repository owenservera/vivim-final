// .runtime/probe-oc-async.ts — executor's exact flow: create + prompt_async + /event SSE
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
  const cr = await fetch(`${base}/session`, {
    method: 'POST', headers: H, body: JSON.stringify({ model }),
    signal: AbortSignal.timeout(30_000),
  })
  const sid = (JSON.parse(await cr.text()) as { id: string }).id
  console.log(`session=${sid}`)

  const seen: string[] = []
  const ac = new AbortController()
  let resolveDone: () => void
  const doneP = new Promise<void>((r) => { resolveDone = r })

  const evRes = await fetch(`${base}/event?session=${sid}`, {
    headers: { Authorization: auth, Accept: 'text/event-stream' },
    signal: ac.signal,
  })
  const reader = evRes.body?.getReader()
  if (!reader) { console.log('NO SSE BODY'); return }
  const dec = new TextDecoder()
  let buf = ''
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
            const ev = JSON.parse(frame) as { type?: string; part?: { text?: string }; error?: string }
            seen.push(`${ev.type ?? '?'}:${ev.part?.text ?? ev.error ?? ''}`)
            if (ev.type === 'step_finish' || ev.type === 'done' || ev.type === 'error') {
              resolveDone()
            }
          } catch { /* not JSON */ }
        }
        nl = buf.indexOf('\n')
      }
    }
  })()

  // give subscribe a beat, then fire the prompt
  await new Promise((r) => setTimeout(r, 500))
  const pr = await fetch(`${base}/session/${sid}/prompt_async`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ parts: [{ type: 'text', text: 'Reply with exactly: async-ok' }] }),
    signal: AbortSignal.timeout(30_000),
  })
  console.log(`prompt_async -> ${pr.status}: ${(await pr.text()).slice(0, 200)}`)

  const timer = setTimeout(() => { try { ac.abort() } catch { /* noop */ } }, 120_000)
  await Promise.race([doneP, new Promise<void>((r) => { timer; setTimeout(r, 120_000) })])
  clearTimeout(timer)
  try { ac.abort() } catch { /* noop */ }

  console.log(`\nEVENTS (${seen.length}):`)
  for (const s of seen.slice(0, 40)) console.log(' ', s.slice(0, 160))
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
