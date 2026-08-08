// .runtime/probe-oc-real.ts — session w/ corrected model object + real AI message
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
  for (const model of [
    { id: 'deepseek-v4-flash-free', providerID: 'opencode' },
    { id: 'north-mini-code-free', providerID: 'opencode' },
  ]) {
    console.log(`\n=== TRY model ${JSON.stringify(model)} ===`)
    const cr = await fetch(`${base}/session`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(30_000),
    })
    const cbody = await cr.text()
    if (cr.status !== 200) {
      console.log(`create -> ${cr.status}: ${cbody.slice(0, 300)}`)
      continue
    }
    const sid = (JSON.parse(cbody) as { id: string }).id
    console.log(`create -> 200 session=${sid}`)

    const mr = await fetch(`${base}/session/${sid}/message`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ parts: [{ type: 'text', text: 'Reply with exactly: vivim-opencode-ok' }] }),
      signal: AbortSignal.timeout(120_000),
    })
    const mbody = await mr.text()
    console.log(`message -> ${mr.status}`)
    console.log(mbody.slice(0, 1200))
    break
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
