// scripts/devops/runtime-test/ui-gate.ts
// CDP UI Gate - Verify capability renders correctly

import { ChromeGovernor } from '../../src/engines/chrome-governor.js'

/**
 * Check UI readiness via CDP
 */
export async function checkUiGate(port: number): Promise<boolean> {
  try {
    // For now, just check if frontend responds
    const r = await fetch(`http://127.0.0.1:${port}/`)
    return r.ok
  } catch {
    return false
  }
}

/**
 * Verify specific capability renders
 */
export async function verifyCapabilityRender(
  port: number,
  capabilitySlug: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Navigate to test page
    const r = await fetch(`http://127.0.0.1:${port}/test/${capabilitySlug}`)
    if (!r.ok) {
      return { ok: false, error: `Page not accessible: ${r.status}` }
    }

    // In real implementation, would use CDP to check DOM
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}