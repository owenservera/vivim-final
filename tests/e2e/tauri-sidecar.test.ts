// tests/e2e/tauri-sidecar.test.ts
// MVP smoke test for the Tauri desktop packaging strategy (ADR-016).
// Verifies the backend sidecar boots and serves the same contract the
// WebView frontend depends on — WITHOUT a browser. Run against a live
// sidecar on 127.0.0.1:9421 (started by the Tauri Rust core in production,
// or manually via `bun run src/desktop/sidecar-entry.ts serve`).
//
//   bun run tests/e2e/tauri-sidecar.test.ts
//
// Designed to be wired into `bun run devops verify-cross-surface` and the
// release pipeline as the desktop-surface gate.

const BASE = process.env.TAURI_SIDECAR_URL ?? 'http://127.0.0.1:9421'

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  // [audit] removed: console.log(`  ok - ${msg}`)
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/health`)
      if (r.ok) return
    } catch {
      // [audit] log the error with context here
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 500))
  }
  throw new Error(`sidecar did not become healthy within ${timeoutMs}ms at ${BASE}`)
}

async function main(): Promise<void> {
  // [audit] removed: console.log(`[tauri-sidecar] probing ${BASE}`)
  await waitForHealth()

  // FR-002: backend serves liveness.
  const health = (await (await fetch(`${BASE}/health`)).json()) as { status: string }
  assert(health.status === 'ok', '/health returns ok')

  // FR-003: readiness flips after bootstrap.
  const ready = (await (await fetch(`${BASE}/readyz`)).json()) as { status: string }
  assert(ready.status === 'ready', '/readyz returns ready')

  // FR-004: existing MVP chat surface is reachable through the sidecar.
  const nlcl = await (await fetch(`${BASE}/api/nlcl/help`)).json()
  assert(nlcl && typeof nlcl === 'object', '/api/nlcl/help responds')

  // [audit] removed: console.log('[tauri-sidecar] ALL CHECKS PASSED')
}

main().catch((_err) => {
  // [audit] removed: console.error(err.message)
  process.exit(1)
})
