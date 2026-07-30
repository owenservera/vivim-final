// src/engines/providers/plugin.ts
// ProviderPlugin interface — standardized provider configuration.
// Phase 8: Convert per-provider logic into a plugin interface.

import type { FailureClass, RecoveryStrategy } from '../actor/messages.js'

export interface ProviderPlugin {
  id: string
  name: string

  urls: {
    login: string
    app: string
    loggedInPattern: RegExp
  }

  selectors: {
    composer: string[]
    sendButton: string[]
    fallback: 'heuristic'
  }

  composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror'

  typing: TypingStrategy

  antiDetection: AntiDetectionScript[]

  login: {
    detect: (url: string) => boolean
    recover: (session: unknown) => Promise<void>
  }

  recovery: RecoveryProfile

  capabilities: ProviderCapability[]
}

export interface TypingStrategy {
  type: 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
  options?: {
    delayMs?: number
    humanLike?: boolean
    clearFirst?: boolean
  }
}

export interface AntiDetectionScript {
  name: string
  script: string
  runAt: 'document_start' | 'document_end' | 'document_idle'
}

export interface RecoveryProfile {
  failureClasses: FailureClass[]
  strategies: Record<FailureClass, RecoveryStrategy>
  maxRetries: Record<FailureClass, number>
}

export interface ProviderCapability {
  id: string
  action: string
  surfaces: string[]
}

/**
 * Base class for provider plugins with default implementations.
 */
export abstract class BaseProviderPlugin implements ProviderPlugin {
  abstract id: string
  abstract name: string
  abstract urls: ProviderPlugin['urls']
  abstract selectors: ProviderPlugin['selectors']
  abstract composerType: ProviderPlugin['composerType']

  typing: TypingStrategy = { type: 'textarea' }
  antiDetection: AntiDetectionScript[] = []
  capabilities: ProviderCapability[] = []

  login = {
    detect: (url: string) => this.urls.loggedInPattern.test(url),
    recover: async (_session: unknown) => {
      // Default: no-op
    },
  }

  recovery: RecoveryProfile = {
    failureClasses: ['BrowserCrash', 'CdpDisconnect'],
    strategies: {
      OOM: 'kill_disable_gpu',
      RendererCrash: 'renavigate_only',
      BrowserCrash: 'ensure_running',
      NavigationTimeout: 'reload_clear_cookies',
      ProviderTimeout: 'reload_reinject_antidetection',
      AuthFailure: 'visible_relaunch',
      ProfileCorruption: 'reallocate_profile',
      CdpDisconnect: 'force_reconnect',
      GpuFailure: 'kill_disable_gpu',
      Unknown: 'circuit_breaker',
    },
    maxRetries: {
      OOM: 2,
      RendererCrash: 5,
      BrowserCrash: 3,
      NavigationTimeout: 3,
      ProviderTimeout: 3,
      AuthFailure: 1,
      ProfileCorruption: 2,
      CdpDisconnect: 5,
      GpuFailure: 2,
      Unknown: 3,
    },
  }
}
