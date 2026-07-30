// src/engines/reliability/classifier.ts
// FailureClassifier — classifies errors into failure classes.
// Phase 9: Replaces uniform failure counter with class-specific recovery.

import type { FailureClass } from '../actor/messages.js'

export interface ClassificationResult {
  failureClass: FailureClass
  confidence: number
  signals: string[]
}

/**
 * Classify an error or probe result into a failure class.
 */
export function classifyFailure(
  error: Error | unknown,
  context?: {
    exitCode?: number
    signal?: string
    hasTargetCrashed?: boolean
    isLoginUrl?: boolean
    cookieFileMissing?: boolean
    gpuProcessCrashed?: boolean
    rssThresholdMb?: number
    currentRssMb?: number
  },
): ClassificationResult {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const signals: string[] = []

  // OOM: high RSS + process exit
  if (
    context?.currentRssMb &&
    context?.rssThresholdMb &&
    context.currentRssMb > context.rssThresholdMb &&
    (context.exitCode === 137 || errorMessage.includes('MEMORY_EXCESS'))
  ) {
    signals.push('high_rss', 'exit_code_137')
    return { failureClass: 'OOM', confidence: 0.9, signals }
  }

  // RendererCrash: CDP Inspector.targetCrashed event before browser exit
  if (context?.hasTargetCrashed) {
    signals.push('target_crashed')
    return { failureClass: 'RendererCrash', confidence: 0.95, signals }
  }

  // BrowserCrash: process exit non-zero without renderer crash
  if (context?.exitCode && context.exitCode !== 0 && !context?.hasTargetCrashed) {
    signals.push('non_zero_exit', `exit_code_${context.exitCode}`)
    return { failureClass: 'BrowserCrash', confidence: 0.85, signals }
  }

  // AuthFailure: navigation landed on login URL
  if (context?.isLoginUrl) {
    signals.push('login_url_redirect')
    return { failureClass: 'AuthFailure', confidence: 0.9, signals }
  }

  // ProfileCorruption: cookie file missing after spawn
  if (context?.cookieFileMissing) {
    signals.push('cookie_file_missing')
    return { failureClass: 'ProfileCorruption', confidence: 0.8, signals }
  }

  // GpuFailure: GPU process crashed
  if (context?.gpuProcessCrashed) {
    signals.push('gpu_process_crashed')
    return { failureClass: 'GpuFailure', confidence: 0.85, signals }
  }

  // NavigationTimeout
  if (errorMessage.includes('timeout') && errorMessage.includes('navigation')) {
    signals.push('navigation_timeout')
    return { failureClass: 'NavigationTimeout', confidence: 0.8, signals }
  }

  // ProviderTimeout: selector wait failed
  if (errorMessage.includes('selector') && errorMessage.includes('timeout')) {
    signals.push('selector_timeout')
    return { failureClass: 'ProviderTimeout', confidence: 0.75, signals }
  }

  // CdpDisconnect: WebSocket close without process exit
  if (
    errorMessage.includes('websocket') ||
    errorMessage.includes('disconnect') ||
    errorMessage.includes('ECONNRESET')
  ) {
    signals.push('websocket_disconnect')
    return { failureClass: 'CdpDisconnect', confidence: 0.7, signals }
  }

  // Unknown fallback
  signals.push('no_pattern_match')
  return { failureClass: 'Unknown', confidence: 0.3, signals }
}
