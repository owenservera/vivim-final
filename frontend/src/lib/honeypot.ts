// frontend/src/lib/honeypot.ts
// Honeypot field utilities for bot detection.
// A hidden field that bots fill but humans don't — silent 422 on submission.

export interface HoneypotConfig {
  /** The field name bots will auto-fill. */
  fieldName: string
  /** Time in ms — if submitted faster than this, likely a bot. */
  minTimeMs: number
}

const DEFAULT_CONFIG: HoneypotConfig = {
  fieldName: 'website_url',
  minTimeMs: 3000,
}

/**
 * Returns props to spread on the hidden input element.
 */
export function honeypotInputProps(config?: Partial<HoneypotConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  return {
    name: cfg.fieldName,
    type: 'text' as const,
    tabIndex: -1,
    autoComplete: 'off',
    'aria-hidden': 'true' as const,
    style: {
      position: 'absolute' as const,
      left: '-9999px',
      opacity: 0,
      height: 0,
      width: 0,
    },
  }
}

/**
 * Validate a honeypot submission.
 * Returns { ok: true } if the submission is legitimate.
 */
export function validateHoneypot(
  formData: Record<string, unknown>,
  submittedAtMs: number,
  config?: Partial<HoneypotConfig>
): { ok: boolean; reason?: string } {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Check if honeypot field was filled
  const honeypotValue = formData[cfg.fieldName]
  if (honeypotValue && String(honeypotValue).trim().length > 0) {
    return { ok: false, reason: 'honeypot_filled' }
  }

  // Check if submitted too quickly
  const elapsed = Date.now() - submittedAtMs
  if (elapsed < cfg.minTimeMs) {
    return { ok: false, reason: 'too_fast' }
  }

  return { ok: true }
}

/**
 * Returns the timestamp field props to embed in the form.
 * The form should set `data-submitted-at` on the form element.
 */
export function honeypotTimestampField() {
  return {
    name: '_submitted_at',
    type: 'hidden' as const,
    value: '', // Filled client-side
  }
}
