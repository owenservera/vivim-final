// devops/runtime-test/test-cap.ts
// Unit — Execute a capability by slug with JSON input (deterministic test).
//
// AGENT-SAFE: bounded fetch timeout. Never hangs.
//
// More precise than the NL `test` command: drives the exact capability the agent
// just built via its slug, so a green result proves the capability (not just the
// NLCL resolver) works end-to-end.

import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 10_000

export interface TestCapResult {
  ok: boolean
  output?: unknown
  error?: string
}

export async function testCapability(slug: string, input: unknown): Promise<TestCapResult> {
  let body: unknown = input
  if (typeof input === 'string') {
    try {
      body = JSON.parse(input)
    } catch {
      body = { value: input }
    }
  }
  try {
    const res = await fetch(
      `${backendBaseUrl()}/api/capabilities/${encodeURIComponent(slug)}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    )
    const data = (await res.json()) as { ok?: boolean; output?: unknown; error?: string; text?: string }
    return { ok: Boolean(data.ok), output: data.output ?? data.text, error: data.error }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
