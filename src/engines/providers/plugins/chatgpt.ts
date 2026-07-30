// src/engines/providers/plugins/chatgpt.ts
// ChatGPT provider plugin.
// Phase 8: Migrated from scattered provider-selectors.ts, composer-typing.ts.

import { BaseProviderPlugin } from '../plugin.js'
import type { ProviderPlugin } from '../plugin.js'

export class ChatGPTPlugin extends BaseProviderPlugin implements ProviderPlugin {
  id = 'chatgpt'
  name = 'ChatGPT'

  urls = {
    login: 'https://chatgpt.com/auth/login',
    app: 'https://chatgpt.com/',
    loggedInPattern: /chatgpt\.com\/(chat|c\/)/,
  }

  selectors = {
    composer: [
      '#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      'div[contenteditable="true"][data-testid="prompt-textarea"]',
    ],
    sendButton: [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'form button[type="submit"]',
    ],
    fallback: 'heuristic' as const,
  }

  composerType = 'textarea' as const

  typing = {
    type: 'textarea' as const,
    options: {
      delayMs: 50,
      humanLike: true,
      clearFirst: true,
    },
  }

  antiDetection = [
    {
      name: 'chatgpt-override',
      script: `
        // Override navigator properties for ChatGPT
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      `,
      runAt: 'document_start' as const,
    },
  ]

  capabilities = [
    { id: 'chatgpt_send', action: 'send_message', surfaces: ['cli', 'ui', 'api'] },
    { id: 'chatgpt_select_model', action: 'select_model', surfaces: ['cli', 'ui'] },
  ]
}
