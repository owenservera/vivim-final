// Live debugging driver: spawns the MCP server with VIVIM_BROWSER_VISIBLE=1 so
// the shared Chrome launches headed, navigates to a target URL, and keeps the
// server + browser alive so a human can watch and interact.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const target = process.argv[2] ?? 'https://www.google.com/search?q=vivim+local+ai'
const mode = process.argv[3] ?? 'navigate' // navigate | google_search

const child = spawn('bun', ['run', 'src/mcp/browser-mcp.ts'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, VIVIM_LOG_STDERR: '1', VIVIM_BROWSER_VISIBLE: '1' },
})

child.stderr.on('data', (d) => process.stderr.write(d))

const rl = createInterface({ input: child.stdout })
const pending = new Map<string, (msg: unknown) => void>()
let nextId = 0

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line)
    if (msg.id !== undefined && pending.has(String(msg.id))) {
      pending.get(String(msg.id))!(msg)
      pending.delete(String(msg.id))
    }
  } catch {
    /* protocol line */
  }
})

function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const id = `req-${++nextId}`
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timeout: true }), 60_000)
    pending.set(id, (m) => {
      clearTimeout(timer)
      resolve(m)
    })
    child.stdin.write(
      JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) +
        '\n',
    )
  })
}

async function main() {
  await new Promise((r) => setTimeout(r, 1200))

  let result: unknown
  if (mode === 'google_search') {
    result = await call('google_search', { query: target, numResults: 5 })
  } else {
    result = await call('browser_open', { url: target })
  }
  const r = result as { result?: { content?: Array<{ text?: string }> }; error?: { message?: string } }
  const text = r.result?.content?.[0]?.text ?? r.error?.message ?? JSON.stringify(result)
  console.log(`\n=== ${mode.toUpperCase()} RESULT (${text.length} chars) ===`)
  console.log(text.slice(0, 2000))
  console.log('\n=== Browser is OPEN (headed). Inspect/interact, then Ctrl+C. ===')

  // keep session warm + visible until Ctrl+C
  const poll = setInterval(() => {
    call('browser_status').catch(() => {})
  }, 10_000)

  process.on('SIGINT', async () => {
    clearInterval(poll)
    console.log('\n[driver] exiting — tearing down server + Chrome')
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'exit' }) + '\n')
    setTimeout(() => {
      child.kill()
      process.exit(0)
    }, 2000)
  })
}

main().catch((e) => {
  console.error('failed:', e.message)
  child.kill()
  process.exit(1)
})
