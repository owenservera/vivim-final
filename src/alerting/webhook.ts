/**
 * @module alerting/webhook
 *
 * Fire-and-forget webhook delivery with a hard 10-second timeout.
 *
 * @example
 * ```ts
 * const { delivered, responseCode } = await sendWebhook(
 *   'https://hooks.slack.com/services/xxx',
 *   { text: 'Alert: rate-limit exceeded', level: 'warning' },
 * );
 * ```
 */

/**
 * Deliver a JSON payload to a webhook endpoint.
 *
 * Uses `fetch` with a 10-second `AbortSignal.timeout` so the caller
 * is never blocked indefinitely by a slow or unresponsive endpoint.
 *
 * @param url     - The fully-qualified webhook URL.
 * @param payload - Arbitrary JSON-serializable object to send as the body.
 * @returns An object indicating whether delivery succeeded and the HTTP
 *          status code (or `null` on network error / timeout).
 */
export async function sendWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<{ delivered: boolean; responseCode: number | null }> {
  try {
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(10_000)

    // Combine external abort with our timeout.
    const combinedSignal = AbortSignal.any?.([controller.signal, timeout]) ?? timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: combinedSignal,
    })

    // Treat 2xx as delivered.
    const delivered = response.status >= 200 && response.status < 300
    return { delivered, responseCode: response.status }
  } catch (err: unknown) {
    // Timeout, DNS failure, network error, etc.
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { delivered: false, responseCode: null }
    }
    return { delivered: false, responseCode: null }
  }
}
