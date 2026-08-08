// .runtime/probe-oc-model.ts — find valid model object + prove a real message
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

async function probe(label: string, path: string, init?: RequestInit): Promise<{ status: number; body: string }> {
  const r = await fetch(`${base}${path}`, {
    ...(init ?? {}),
    headers: { ...H, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(90_000),
  })
  const text = await r.text()
  console.log(`\n### ${label} -> ${r.status}`)
  console.log(text.slice(0, 600))
  return { status: r.status, body: text }
}

async function main(): Promise<void> {
  await probe('list providers', '/provider', { method: 'GET' })

  // try model object shapes
  const shapes = [
    { id: 'opencode/deepseek-v4-flash-free', providerID: 'opencode' },
    { id: 'deepseek-v4-flash-free', providerID: 'opencode' },
    { id: 'opencode/deepseek-v4-flash-free', providerID: 'opencode-go' },
  ]
  let sid: string | null = null
  for (const model of shapes) {
    const r = await probe(`create session model=${JSON.stringify(model)}`, '/session', {
      method: 'POST',
      body: JSON.stringify({ model }),
    })
    if (r.status === 200) {
      try {
        sid = (JSON.parse(r.body) as { id: string }).id
        console.log(`   -> session ${sid}`)
        break
      } catch { }
    }
  }

  if (sid) {
    await probe('sendMessage (blocking)', `/session/${sid}/message`, {
      method: 'POST',
      body: JSON.stringify({ parts: [{ type: 'text', text: 'Reply with exactly: vivim-opencode-ok' }] }),
    })
  } else {
    console.log('\nNO session created — cannot test message')
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
