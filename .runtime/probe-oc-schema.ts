// .runtime/probe-oc-schema.ts — extract the /session + message request schemas
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
  const r = await fetch(`${base}/doc`, {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(15_000),
  })
  const doc = (await r.json()) as {
    components: { schemas: Record<string, unknown> }
    paths: Record<string, { post?: { requestBody?: { content?: { 'application/json'?: { schema?: { $ref?: string } } } } } }>
  }
  console.log('=== path list ===')
  for (const p of Object.keys(doc.paths ?? {})) console.log(' ', p)

  for (const path of ['/session', '/session/{id}/message', '/session/{id}/prompt_async']) {
    const op = doc.paths?.[path]?.post
    if (!op) {
      console.log(`\n### ${path}: no POST op`)
      continue
    }
    const schemaRef = op.requestBody?.content?.['application/json']?.schema
    console.log(`\n### ${path} requestBody schema: ${JSON.stringify(schemaRef)}`)
    if (schemaRef?.$ref) {
      const name = schemaRef.$ref.split('/').pop() ?? ''
      const s = doc.components?.schemas?.[name]
      console.log(`### schema '${name}': ${JSON.stringify(s, null, 1).slice(0, 2000)}`)
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
