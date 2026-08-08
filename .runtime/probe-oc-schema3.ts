// .runtime/probe-oc-schema3.ts — dump schemas for the /api/* agentic surface + TextPartInput
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
  const doc = (await r.json()) as { components: { schemas: Record<string, unknown> }; paths: Record<string, Record<string, { requestBody?: { content?: { 'application/json'?: { schema?: unknown } } } }>> }
  const resolve = (schema: unknown): unknown => {
    if (schema && typeof schema === 'object' && '$ref' in schema) {
      const name = String((schema as { $ref: string }).$ref.split('/').pop())
      return doc.components?.schemas?.[name]
    }
    return schema
  }
  for (const name of ['TextPartInput', 'FilePartInput', 'OutputFormat', 'SessionInfo', 'SessionInfoList']) {
    const s = doc.components?.schemas?.[name]
    console.log(`\n### schema ${name}: ${s ? JSON.stringify(s, null, 1).slice(0, 1200) : 'MISSING'}`)
  }
  for (const path of ['/api/session', '/api/session/{sessionID}/prompt', '/api/session/{sessionID}/wait', '/api/session/active']) {
    const ops = doc.paths?.[path] ?? {}
    for (const method of Object.keys(ops)) {
      const op = ops[method] as { requestBody?: { content?: { 'application/json'?: { schema?: unknown } } } }
      const schema = op?.requestBody?.content?.['application/json']?.schema
      console.log(`\n### ${method.toUpperCase()} ${path} requestBody:`)
      console.log(schema ? JSON.stringify(resolve(schema), null, 1).slice(0, 2000) : '  (none)')
    }
  }
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
