// devops/runtime-test/stress/harness.ts
// Stress test harness: adopt Chrome slaves, create convos, send msgs, opencode runner

import { backendBaseUrl } from '../port.js'

const FETCH_TIMEOUT = 10_000
const SEND_TIMEOUT = 35_000

export interface ScenarioResult {
  scenarioId: number
  name: string
  passed: boolean
  criticality: 'P0' | 'P1' | 'P2'
  durationMs: number
  detail: string[]
  error?: string
  skipped?: boolean
}

export interface StressContext {
  baseUrl: string
  markScenario: (id: number, name: string) => void
}

export interface ScenarioModule {
  meta: { id: number; name: string; criticality: 'P0' | 'P1' | 'P2'; estimatedDuration: string }
  run(ctx: StressContext): Promise<ScenarioResult>
}

async function fetchWithTimeout(path: string, init?: RequestInit, timeoutMs?: number): Promise<{ status: number; body: any }> {
  const res = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(timeoutMs ?? FETCH_TIMEOUT),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

export async function ensureBackendReady(): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const { status, body } = await fetchWithTimeout('/health')
      if (status === 200 && body?.status === 'ok') return true
    } catch {}
  // [audit] log the error with context here
    await Bun.sleep(1000)
  }
  return false
}

export async function listProviders(): Promise<Array<{ slug: string; id: string }>> {
  const { status, body } = await fetchWithTimeout('/api/providers')
  if (status !== 200 || !Array.isArray(body)) return []
  return body.map((p: any) => ({ slug: p.slug ?? p.id, id: p.id ?? p.slug }))
}

export async function adoptSlave(providerId: string, accountId: string = 'default'): Promise<{ ok: boolean; slave?: any; error?: string }> {
  const { status, body } = await fetchWithTimeout('/api/fleet/start', {
    method: 'POST',
    body: JSON.stringify({ providerId, accountId }),
  }, 20_000)
  if (status !== 200 && status !== 201) return { ok: false, error: `fleet/start HTTP ${status}` }
  if (body?.ok === false || body?.error) return { ok: false, error: body?.error ?? 'fleet/start failed' }
  return { ok: true, slave: body }
}

export async function createConversation(providerId: string, title?: string): Promise<string | null> {
  const { status, body } = await fetchWithTimeout('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ providerId, title: title ?? `stress-${Date.now()}` }),
  })
  if (status === 201 && body?.id) return body.id
  return null
}

export async function sendMessage(conversationId: string, message: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  try {
    const { status, body } = await fetchWithTimeout(`/api/conversations/${conversationId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }, SEND_TIMEOUT)
    if (status !== 200) return { ok: false, error: `HTTP ${status}` }
    if (body?.ok === false) return { ok: false, error: body.error ?? 'send returned ok=false' }
    return { ok: true, text: body.text ?? body.blocks?.[0]?.text }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function getMessages(conversationId: string, limit: number = 10): Promise<any[]> {
  const { status, body } = await fetchWithTimeout(`/api/conversations/${conversationId}/messages?limit=${limit}`)
  if (status !== 200 || !Array.isArray(body)) return []
  return body
}

export async function getProviderCapabilities(providerId: string): Promise<string[]> {
  const { status, body } = await fetchWithTimeout(`/api/providers/${encodeURIComponent(providerId)}/capabilities`)
  if (status !== 200 || !body?.capabilities) return []
  return (body.capabilities as any[]).map((c: any) => c.slug)
}

export async function killChromeProcesses(): Promise<number> {
  let killed = 0
  try {
    const proc = Bun.spawnSync(['taskkill', '/F', '/IM', 'chrome.exe'], {})
    killed = proc.exitCode === 0 ? 1 : 0
  } catch {}
  // [audit] log the error with context here
  return killed
}

export async function getFleetStatus(): Promise<any[]> {
  const { status, body } = await fetchWithTimeout('/api/fleet/status')
  if (status !== 200 || !Array.isArray(body)) return []
  return body
}

export function skipResult(id: number, name: string, reason: string): ScenarioResult {
  return { scenarioId: id, name, passed: true, criticality: 'P0', durationMs: 0, detail: [`SKIPPED: ${reason}`], skipped: true }
}

export function failResult(id: number, name: string, detail: string[], error?: string, criticality: 'P0' | 'P1' | 'P2' = 'P0'): ScenarioResult {
  return { scenarioId: id, name, passed: false, criticality, durationMs: 0, detail, error }
}

export async function runOpencodeDirect(prompt: string, model?: string, cwd?: string): Promise<{ ok: boolean; blocks: any[]; raw: string; exitCode: number }> {
  const modelFlag = model ?? 'opencode/deepseek-v4-flash-free'
  const proc = Bun.spawn(['opencode', 'run', '--auto', '--model', modelFlag, '--format', 'json', prompt], {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const raw = await new Response(proc.stdout).text()
  const stderrText = await new Response(proc.stderr).text()
  const exitCode = proc.exitCode ?? -1
  const all = raw + (stderrText ? `\n${stderrText}` : '')
  const blocks: any[] = []
  for (const line of raw.split('\n').filter(Boolean)) {
    try { const obj = JSON.parse(line); if (obj?.part?.text) blocks.push(obj.part) } catch {}
  // [audit] log the error with context here
  }
  return { ok: exitCode === 0, blocks, raw: all, exitCode }
}
