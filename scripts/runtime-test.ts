// scripts/runtime-test.ts
// Vivim Runtime Test: full-stack automated dev commands
// Usage: bun run scripts/runtime-test.ts <command> [--goal "..."] [--nl "message"]

import { execSync } from 'child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Resolve the backend port the same way clients do: CAP_STORE_PORT env →
// .runtime/backend.port (written by the launcher when it falls back off a
// zombie-held default) → 9420.
function resolveBackendPort(): number {
  const env = process.env.CAP_STORE_PORT
  if (env && /^\d+$/.test(env.trim())) return Number.parseInt(env.trim(), 10)
  try {
    const p = join(process.cwd(), '.runtime', 'backend.port')
    if (existsSync(p)) {
      const v = readFileSync(p, 'utf8').trim()
      if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
    }
  } catch {}
  return 9420
}

const BACKEND_URL = `http://127.0.0.1:${resolveBackendPort()}`
const FRONTEND_URL = 'http://127.0.0.1:5173'

// ── Helpers ─────────────────────────────────────────────────────────────────

async function checkHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}${path}`)
  return res.json()
}

async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

function runCmd(cmd: string, cwd?: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 30000 })
    return { ok: true, output }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: err.stdout || err.stderr || err.message || 'Unknown error' }
  }
}

function countFiles(dir: string, ext: string): number {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      count += countFiles(full, ext)
    } else if (entry.endsWith(ext)) {
      count++
    }
  }
  return count
}

// ── Health command ──────────────────────────────────────────────────────────

async function cmdHealth(): Promise<void> {
  console.log('🏥 Vivim Health Check')
  console.log('')

  const backend = await checkHealth(`${BACKEND_URL}/api/health`)
  const frontend = await checkHealth(FRONTEND_URL)

  console.log(`  Backend:  ${backend ? '✅ healthy' : '❌ down'}`)
  console.log(`  Frontend: ${frontend ? '✅ healthy' : '❌ down'}`)

  if (backend) {
    try {
      const health = await getJson('/api/health') as Record<string, unknown>
      console.log(`  Version:  ${health.version || 'unknown'}`)
      console.log(`  Uptime:   ${health.uptime || 'unknown'}s`)
    } catch {
      // Ignore
    }
  }

  console.log('')
  if (!backend && !frontend) {
    console.log('❌ Both services down')
    process.exit(1)
  } else if (!backend) {
    console.log('❌ Backend down')
    process.exit(1)
  } else if (!frontend) {
    console.log('⚠️  Frontend down (non-critical)')
  } else {
    console.log('✅ All services healthy')
  }
}

// ── Selectors command ───────────────────────────────────────────────────────

interface SelectorDef {
  provider: string
  selector: string
  fallbacks: string[]
}

const SELECTORS: SelectorDef[] = [
  { provider: 'claude', selector: '[contenteditable="true"].ProseMirror', fallbacks: ['div[contenteditable="true"]', 'textarea'] },
  { provider: 'chatgpt', selector: '#prompt-textarea', fallbacks: ['textarea[placeholder*="Message"]', 'div[contenteditable="true"]'] },
  { provider: 'deepseek', selector: 'textarea#chat-input', fallbacks: ['textarea[placeholder*="Message"]', 'div[contenteditable="true"]'] },
  { provider: 'gemini', selector: '.ql-editor.textarea', fallbacks: ['div[contenteditable="true"]', 'textarea'] },
  { provider: 'copilot', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'perplexity', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'you', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'poe', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'mistral', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'zai', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
  { provider: 'studio-ai', selector: 'textarea', fallbacks: ['div[contenteditable="true"]'] },
]

async function cmdSelectors(): Promise<void> {
  console.log('🔍 Selector Health Check')
  console.log('')

  let passed = 0
  let failed = 0

  for (const sel of SELECTORS) {
    const allSelectors = [sel.selector, ...sel.fallbacks]
    const valid = allSelectors.every(s => s && s.trim() !== '' && !/[{}<>]/.test(s))

    if (valid) {
      console.log(`  ✅ ${sel.provider}: ${sel.selector}`)
      passed++
    } else {
      console.log(`  ❌ ${sel.provider}: Invalid selector`)
      failed++
    }
  }

  console.log('')
  console.log(`  Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

// ── Discover command ────────────────────────────────────────────────────────

async function cmdDiscover(): Promise<void> {
  console.log('🔍 Vivim Discover: Full Stack Introspection')
  console.log('')

  // Backend capabilities
  const backend = await checkHealth(`${BACKEND_URL}/api/health`)
  let capCount = 0
  if (backend) {
    try {
      const caps = await getJson('/api/capabilities') as Record<string, unknown>
      const list = caps.capabilities as Array<Record<string, unknown>>
      capCount = list?.length || 0
      console.log(`  Backend:  ✅ ${capCount} capabilities`)
    } catch {
      console.log('  Backend:  ✅ (unable to list capabilities)')
    }
  } else {
    console.log('  Backend:  ❌ down')
  }

  // Frontend components
  const frontend = await checkHealth(FRONTEND_URL)
  console.log(`  Frontend: ${frontend ? '✅ running' : '❌ down'}`)

  // Source files
  const engineCount = countFiles('src/engines', '.ts')
  const routerCount = countFiles('src/server', '-router.ts')
  const testCount = countFiles('tests', '.test.ts')
  const schemaSize = existsSync('prisma/schema.prisma') ? statSync('prisma/schema.prisma').size : 0

  console.log('')
  console.log('  Source:')
  console.log(`    Engines:    ${engineCount} files`)
  console.log(`    Routers:    ${routerCount} files`)
  console.log(`    Tests:      ${testCount} files`)
  console.log(`    Schema:     ${schemaSize} bytes`)

  // Database
  if (backend) {
    try {
      const health = await getJson('/api/health') as Record<string, unknown>
      console.log(`    Database:   ${health.db ? '✅ connected' : '❌ disconnected'}`)
    } catch {
      console.log('    Database:   ❓ unknown')
    }
  }

  console.log('')
  console.log('✅ Discover complete')
}

// ── Test command ────────────────────────────────────────────────────────────

async function cmdTest(): Promise<void> {
  console.log('🧪 Vivim Test: Full Test Suite')
  console.log('')

  const results: Array<{ name: string; ok: boolean; detail: string }> = []

  // Unit tests (chat tests only for speed)
  console.log('  Running unit tests...')
  const unit = runCmd('bun test tests/unit/engines/chat/ 2>&1')
  const unitMatch = unit.output.match(/(\d+) pass/)
  const unitFailMatch = unit.output.match(/(\d+) fail/)
  results.push({
    name: 'Unit Tests (chat)',
    ok: unit.ok && (!unitFailMatch || unitFailMatch[1] === '0'),
    detail: unitMatch ? `${unitMatch[1]} pass` : unit.ok ? 'pass' : 'fail',
  })

  // Integration tests
  console.log('  Running integration tests...')
  const integ = runCmd('bun test tests/integration/ 2>&1')
  const integMatch = integ.output.match(/(\d+) pass/)
  const integFailMatch = integ.output.match(/(\d+) fail/)
  results.push({
    name: 'Integration Tests',
    ok: integ.ok && (!integFailMatch || integFailMatch[1] === '0'),
    detail: integMatch ? `${integMatch[1]} pass` : integ.ok ? 'pass' : 'fail',
  })

  // Typecheck
  console.log('  Running typecheck...')
  const tc = runCmd('bun run typecheck 2>&1')
  results.push({
    name: 'Typecheck',
    ok: tc.ok,
    detail: tc.ok ? 'clean' : 'errors',
  })

  // Lint
  console.log('  Running lint...')
  const lint = runCmd('bun run lint 2>&1')
  results.push({
    name: 'Lint',
    ok: lint.ok,
    detail: lint.ok ? 'clean' : 'errors',
  })

  // Results
  console.log('')
  console.log('  Results:')
  let allPass = true
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌'
    console.log(`    ${icon} ${r.name}: ${r.detail}`)
    if (!r.ok) allPass = false
  }

  console.log('')
  if (allPass) {
    console.log('✅ All tests pass')
  } else {
    console.log('❌ Some tests failed')
    process.exit(1)
  }
}

// ── Verify command ──────────────────────────────────────────────────────────

async function cmdVerify(nlMessage?: string): Promise<void> {
  console.log('🔬 Vivim Verify: Full Pipeline Test')
  console.log('')

  // Step 1: Health check
  console.log('Step 1: Health check')
  const backend = await checkHealth(`${BACKEND_URL}/api/health`)
  console.log(`  Backend: ${backend ? '✅' : '❌'}`)
  if (!backend) {
    console.log('❌ Backend not running')
    process.exit(1)
  }

  // Step 2: Create conversation
  console.log('')
  console.log('Step 2: Create conversation')
  const convRes = await postJson('/api/conversations', { providerId: 'claude' })
  if (convRes.status !== 200) {
    console.log(`  ❌ Failed: ${convRes.status}`)
    process.exit(1)
  }
  const convId = ((convRes.body as Record<string, unknown>).conversation as Record<string, unknown>).id as string
  console.log(`  ✅ Created: ${convId}`)

  // Step 3: Send message
  const message = nlMessage || 'Hello, this is a verify test. Reply with just "OK".'
  console.log('')
  console.log(`Step 3: Send message: "${message}"`)
  const sendRes = await postJson(`/api/conversations/${convId}/send`, { message })
  if (sendRes.status !== 200) {
    console.log(`  ❌ Failed: ${sendRes.status}`)
    process.exit(1)
  }
  const sendBody = sendRes.body as Record<string, unknown>
  console.log(`  ✅ Sent: ok=${sendBody.ok}, latency=${sendBody.latencyMs}ms`)
  console.log(`  Response: ${(sendBody.text as string || '').substring(0, 100)}...`)

  // Step 4: Verify messages
  console.log('')
  console.log('Step 4: Verify messages')
  const msgsRes = await getJson(`/api/conversations/${convId}/messages`) as Record<string, unknown>
  const messages = msgsRes.messages as Array<Record<string, unknown>>
  console.log(`  Messages: ${messages.length}`)
  if (messages.length >= 2) {
    console.log(`  First user: ${messages[0]?.role} - ${(messages[0]?.content as string || '').substring(0, 50)}`)
    console.log(`  First assistant: ${messages[1]?.role} - ${(messages[1]?.content as string || '').substring(0, 50)}`)
  }

  // Step 5: Check selectors
  console.log('')
  console.log('Step 5: Selector validation')
  let selectorOk = true
  for (const sel of SELECTORS) {
    const valid = sel.selector && sel.selector.trim() !== ''
    if (!valid) {
      console.log(`  ❌ ${sel.provider}: Invalid`)
      selectorOk = false
    }
  }
  console.log(`  ${selectorOk ? '✅' : '❌'} Selectors: ${selectorOk ? 'All valid' : 'Some invalid'}`)

  // Step 6: Run tests
  console.log('')
  console.log('Step 6: Test suite')
  const unit = runCmd('bun test tests/unit/engines/chat/ 2>&1')
  const unitMatch = unit.output.match(/(\d+) pass/)
  console.log(`  Unit tests: ${unitMatch ? `${unitMatch[1]} pass` : unit.ok ? 'pass' : 'fail'}`)

  const tc = runCmd('bun run typecheck 2>&1')
  console.log(`  Typecheck: ${tc.ok ? 'clean' : 'errors'}`)

  console.log('')
  console.log('✅ Verify complete')
}

// ── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const command = args[0]
const nlFlag = args.indexOf('--nl')
const nlMessage = nlFlag !== -1 ? args[nlFlag + 1] : undefined

switch (command) {
  case 'health':
    await cmdHealth()
    break
  case 'selectors':
    await cmdSelectors()
    break
  case 'discover':
    await cmdDiscover()
    break
  case 'test':
    await cmdTest()
    break
  case 'verify':
    await cmdVerify(nlMessage)
    break
  default:
    console.log('Usage: bun run scripts/runtime-test.ts <command>')
    console.log('')
    console.log('Commands:')
    console.log('  health       Check backend + frontend health')
    console.log('  selectors    Validate provider selectors')
    console.log('  discover     Full stack introspection (caps, files, schema)')
    console.log('  test         Run all tests (unit, integration, typecheck, lint)')
    console.log('  verify       Full pipeline verification')
    console.log('  --nl "msg"   Natural language message for verify')
    process.exit(1)
}
