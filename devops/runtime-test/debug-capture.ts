// devops/runtime-test/debug-capture.ts
// Unit 4.3 — Debug Capture
//
// AGENT-SAFE: always returns a result, never throws.

export interface DebugCapture {
  ok: boolean
  screenshot?: string
  console?: string[]
  error?: string
}

export async function captureDebug(
  sessionId?: string,
  governor?: { getPage?: (id: string) => unknown },
): Promise<DebugCapture> {
  if (!governor || !sessionId) return { ok: false, error: 'No session/governor' }

  try {
    const page = governor.getPage?.(sessionId) as {
      screenshot?: (opts: { encoding: string }) => Promise<string>
      evaluate?: (fn: () => string) => Promise<string>
    } | undefined
    if (!page) return { ok: false, error: 'No page' }

    const screenshot = await page.screenshot?.({ encoding: 'base64' })
    const c = await page.evaluate?.(() => JSON.stringify(window.console ?? []))

    return {
      ok: true,
      screenshot: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
      console: c ? JSON.parse(c) : [],
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}