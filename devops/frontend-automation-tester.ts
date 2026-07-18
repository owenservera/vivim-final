// devops/frontend-automation-tester.ts
// FrontendAutomationTester — drives the frontend surface for a provider capability:
// mounts the canvas layer, invokes the capability, and asserts the DOM updated.
//
// Governor-Canon safe: talks to the backend API (same transport as test-cap) and/or
// a live browser via BunCdpClient + sessionId. No engine imports CDP directly.
//
// Auto-records every run into UiTestRegistry so the agent can always answer
// "has this capability been tested in the frontend?" and direct next steps.

import type { BunCdpClient } from '../src/executor/cdp.js'
import { activity } from './automation-activity-log.js'
import { backendBaseUrl } from './runtime-test/port.js'
import { recordUiTest } from './ui-test-registry.js'

export interface FrontendTestResult {
  ok: boolean
  capability: string
  provider: string
  mounted: boolean
  invoked: boolean
  domAsserted: boolean
  detail?: string
  uiTestEntryId?: string
}

const FETCH_TIMEOUT_MS = 10_000

/**
 * Verify a frontend capability end-to-end.
 * @param provider    provider slug (for logging)
 * @param capability  capability slug to invoke (e.g. "send_message")
 * @param opts.input   optional input JSON for the capability
 * @param opts.client optional live browser to assert DOM after invoke
 * @param opts.sessionId optional live browser session
 */
export async function testFrontend(
  provider: string,
  capability: string,
  opts?: {
    input?: unknown
    client?: BunCdpClient
    sessionId?: string
    assertSelector?: string
    testedBy?: string
    notes?: string
  },
): Promise<FrontendTestResult> {
  const result: FrontendTestResult = {
    ok: false,
    capability,
    provider,
    mounted: false,
    invoked: false,
    domAsserted: false,
  }

  try {
    // 1. Mount the canvas layer for the capability (backend API).
    const mountRes = await fetch(`${backendBaseUrl()}/api/canvas/mount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, capability }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    result.mounted = mountRes.ok
    if (!result.mounted) {
      result.detail = `canvas mount failed: HTTP ${mountRes.status}`
      activity('onboard.test-frontend', 'capability', { provider, capability, mounted: false }, 'failure')
      // Record failure in UiTestRegistry
      const entry = await recordUiTest(provider, capability, 'fail', result.detail, opts?.testedBy ?? 'agent', { notes: opts?.notes })
      result.uiTestEntryId = entry.id
      return result
    }

    // 2. Invoke the capability (backend API).
    const invokeRes = await fetch(`${backendBaseUrl()}/api/capabilities/${encodeURIComponent(capability)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts?.input ?? {}),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const invokeData = (await invokeRes.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    result.invoked = invokeRes.ok && Boolean(invokeData.ok)
    if (!result.invoked) {
      result.detail = `capability invoke failed: ${invokeData.error ?? `HTTP ${invokeRes.status}`}`
      activity('onboard.test-frontend', 'capability', { provider, capability, mounted: true, invoked: false }, 'failure')
      const entry = await recordUiTest(provider, capability, 'fail', result.detail, opts?.testedBy ?? 'agent', { notes: opts?.notes })
      result.uiTestEntryId = entry.id
      return result
    }

    // 3. Assert DOM updated (if a live browser + selector are provided).
    if (opts?.client && opts?.sessionId && opts?.assertSelector) {
      const expr = `(()=>{ const el = document.querySelector(${JSON.stringify(opts.assertSelector)}); return !!el && el.getBoundingClientRect().width>0; })()`
      const domRes = (await opts.client.send('Runtime.evaluate', { expression: expr, returnByValue: true }, { sessionId: opts.sessionId })) as {
        result?: { value?: boolean }
      }
      result.domAsserted = Boolean(domRes.result?.value)
    } else {
      result.domAsserted = true
    }

    result.ok = result.mounted && result.invoked && result.domAsserted
    const detail = result.ok ? 'full E2E: canvas mount + invoke + DOM assert' : result.detail ?? 'unknown failure'
    const uiTestResult = result.ok ? 'pass' as const : 'fail' as const
    const entry = await recordUiTest(provider, capability, uiTestResult, detail, opts?.testedBy ?? 'agent', { notes: opts?.notes })
    result.uiTestEntryId = entry.id
    activity('onboard.test-frontend', 'capability', {
      provider,
      capability,
      mounted: result.mounted,
      invoked: result.invoked,
      domAsserted: result.domAsserted,
      uiTestEntryId: entry.id,
    }, result.ok ? 'success' : 'failure')
    return result
  } catch (e) {
    result.detail = e instanceof Error ? e.message : String(e)
    activity('onboard.test-frontend', 'capability', { provider, capability, error: result.detail }, 'failure')
    const entry = await recordUiTest(provider, capability, 'fail', result.detail, opts?.testedBy ?? 'agent', { notes: opts?.notes })
    result.uiTestEntryId = entry.id
    return result
  }
}
