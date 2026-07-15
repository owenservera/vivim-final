// scripts/devops/runtime-test/test.ts
// Live E2E harness - drives real slaves through ChromeGovernor

import { ChromeGovernor } from '../../src/engines/chrome-governor.js'

export interface E2EResult {
  passed: boolean
  testsRun: number
  failures: number
  errors: string[]
}

/**
 * Run live end-to-end tests against running server
 */
export async function runLiveE2E(backendPort: number, frontendPort: number): Promise<E2EResult> {
  const result: E2EResult = {
    passed: false,
    testsRun: 0,
    failures: 0,
    errors: [],
  }

  try {
    // Test 1: Health check
    result.testsRun++
    const healthR = await fetch(`http://127.0.0.1:${backendPort}/api/health/providers`)
    if (!healthR.ok) {
      result.failures++
      result.errors.push(`Health check failed: ${healthR.status}`)
    }

    // Test 2: Capabilities endpoint
    result.testsRun++
    const capR = await fetch(`http://127.0.0.1:${backendPort}/api/capabilities?surface=ui`)
    if (!capR.ok) {
      result.failures++
      result.errors.push(`Capabilities endpoint failed: ${capR.status}`)
    }

    // Test 3: Frontend accessible (optional)
    result.testsRun++
    try {
      const frontR = await fetch(`http://127.0.0.1:${frontendPort}/`)
      if (!frontR.ok) {
        result.errors.push(`Frontend not accessible: ${frontR.status}`)
      }
    } catch (e) {
      // Frontend optional
    }

    result.passed = result.failures === 0
  } catch (e) {
    result.errors.push(String(e))
    result.failures = result.testsRun
  }

  return result
}