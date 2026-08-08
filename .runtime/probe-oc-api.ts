// .runtime/probe-oc-api.ts — inspect the live `opencode serve` HTTP API (v1.18.4)
// and find the correct /session payload shape.
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const RUNTIME = join(process.cwd(), '.runtime')
function opencodeServePort(): number | null {
  const logPath = join(RUNTIME, 'backend.log')
  const raw = readFileSync(logPath, 'utf8').replace(/\x1b\[[0-9;]*m/g, '')
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

const port = opencodeServePort()
if (!port) {
  console.log('FAIL: no opencode serve port in log')
  process.exit(1)
}
const base = `http://127.0.0.1:${port}`
const auth = `Basic ${Buffer.from('opencode:opencode-test-pw').toString('base64')}`
const H = { Authorization: auth, 'Content-Type': 'application/json' }

async function probe(label: string, path: string, init?: RequestInit): Promise<void> {
  try {
    const r = await fetch(`${base}${path}`, {
      ...(init ?? {}),
      headers: { ...H, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    })
    const text = await r.text()
    console.log(`\n### ${label}: ${init?.method ?? 'GET'} ${path} -> ${r.status}`)
    console.log(text.slice(0, 900))
  } catch (e) {
    console.log(`\n### ${label}: ${init?.method ?? 'GET'} ${path} -> ERROR ${e}`)
  }
}

async function main(): Promise<void> {
  await probe('openapi doc (search session)', '/doc')
  await probe('create session empty', '/session', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  await probe('create session model only', '/session', {
    method: 'POST',
    body: JSON.stringify({ model: 'opencode/deepseek-v4-flash-free' }),
  })
  await probe('create session no model', '/session', {
    method: 'POST',
    body: JSON.stringify({ cwd: process.cwd() }),
  })
  await probe('list sessions', '/session')
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
