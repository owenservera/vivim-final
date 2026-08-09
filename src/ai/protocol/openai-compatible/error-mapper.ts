/**
 * VIVIM AI Gateway — OpenAI-Compatible Error Mapper
 * @module ai/protocol/openai-compatible/error-mapper
 *
 * Maps OpenAI API errors → VivimAIError. Never lets a provider-native
 * exception cross the adapter boundary.
 */

import { AI_ERRORS, type VivimAIError } from '../../core/errors.js'
import type { ProviderId } from '../../core/types.js'

export function mapOpenAIError(err: unknown, providerId: ProviderId): VivimAIError {
  // Network / fetch errors
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return AI_ERRORS.providerUnavailable(providerId, err)
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return AI_ERRORS.cancelled('Request aborted')
  }

  // HTTP response errors (string body)
  if (typeof err === 'string') {
    return parseOpenAIErrorBody(err, providerId)
  }
  if (err instanceof Error && 'status' in err) {
    const status = (err as { status: number }).status
    const body = (err as { body?: string }).body ?? err.message
    return parseOpenAIErrorBody(body, providerId, status)
  }
  if (err instanceof Error) {
    return AI_ERRORS.protocolError(err.message, err)
  }

  return AI_ERRORS.unknown(String(err), err)
}

function parseOpenAIErrorBody(body: string, providerId: ProviderId, status?: number): VivimAIError {
  try {
    const json = JSON.parse(body)
    const apiError = json?.error
    if (apiError) {
      const code: string = apiError.code ?? apiError.type ?? 'unknown'
      const message: string = apiError.message ?? body

      // Map common OpenAI error codes
      if (code === 'invalid_api_key' || status === 401) {
        return AI_ERRORS.invalidRequest(`Authentication failed: ${message}`)
      }
      if (code === 'rate_limit_exceeded' || status === 429) {
        return AI_ERRORS.providerUnavailable(providerId, new Error(`Rate limited: ${message}`))
      }
      if (code === 'context_length_exceeded') {
        return AI_ERRORS.contextTooLarge(0, 0)
      }
      if (status === 404) {
        return AI_ERRORS.modelUnavailable(providerId as never)
      }
      if (status && status >= 500) {
        return AI_ERRORS.runtimeCrash(providerId, new Error(message))
      }
      return AI_ERRORS.protocolError(`${code}: ${message}`)
    }
  } catch {
    // Not JSON
  }

  if (status === 401) return AI_ERRORS.invalidRequest('Authentication failed (HTTP 401)')
  if (status === 429) return AI_ERRORS.providerUnavailable(providerId, new Error('Rate limited'))
  if (status && status >= 500) return AI_ERRORS.runtimeCrash(providerId, new Error(body))
  return AI_ERRORS.protocolError(body || `HTTP ${status ?? 'unknown'}`)
}

/** Wrap a fetch Response into an error if not ok. */
export async function assertOkResponse(response: Response, providerId: ProviderId): Promise<void> {
  if (response.ok) return
  const body = await response.text().catch(() => '')
  throw mapOpenAIError(
    { status: response.status, body, message: `HTTP ${response.status}` } as unknown as Error,
    providerId,
  )
}
