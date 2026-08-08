// .runtime/probe-oc-paths.ts — list all /doc paths + find event/permission endpoints
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

async function main(): Promise<void> {
  const r = await fetch(`${base}/doc`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15_000) })
  const doc = (await r.json()) as { paths: Record<string, Record<string, unknown>> }
  for (const [path, ops] of Object.entries(doc.paths)) {
    const methods = Object.keys(ops).join(',').toUpperCase()
    if (path.includes('event') || path.includes('permission') || path.includes('permissions') || path.includes('reply')) {
      console.log(`${methods} ${path}`)
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
