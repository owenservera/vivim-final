// .runtime/probe-oc-providers.ts — list providers + models, check env keys
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
  const r = await fetch(`${base}/provider`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15_000) })
  const j = (await r.json()) as {
    all: Array<{ id: string; name: string; source: string; env: string[]; models?: Record<string, { id: string; providerID: string; name?: string }> }>
  }
  console.log('PROVIDERS:')
  for (const p of j.all) {
    const ids = p.models ? Object.values(p.models).map((m) => m.id).slice(0, 12).join(', ') : '(no models)'
    console.log(`  ${p.id} [${p.source}] env=${p.env.join(',') || '-'} models=${ids}`)
  }
  const keys: Array<[string, boolean]> = []
  for (const k of ['ZHIPU_API_KEY', 'OPENCODE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'XAI_API_KEY', 'GOOGLE_API_KEY']) {
    keys.push([k, Boolean(process.env[k])])
  }
  console.log('\nPROCESS ENV (serve inherits supervisor inherits backend):')
  for (const [k, v] of keys) console.log(`  ${k}=${v ? 'SET' : 'unset'}`)
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
