// devops/runtime-test/test-harness.ts
// Unit 4.1 — Live E2E Test Harness
//
// AGENT-SAFE: fetch has timeout per step. Never hangs.

import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 10_000

export interface TestSpec {
  description: string
  steps: Array<{ nl: string; expect?: string }>
}

export async function runLiveTest(spec: TestSpec): Promise<{ ok: boolean; failures: string[] }> {
  const failures: string[] = []
  for (const step of spec.steps) {
    try {
      const res = await fetch(`${backendBaseUrl()}/api/nlcl/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: step.nl }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      const data = (await res.json()) as { ok: boolean; text?: string }
      if (!data.ok && step.expect) {
        failures.push(`${step.nl}: ${data.text ?? 'failed'}`)
      }
    } catch (err) {
      failures.push(`${step.nl}: ${String(err)}`)
    }
  }
  return { ok: failures.length === 0, failures }
}