// src/engines/providers/plugins/gemini.ts
// Gemini provider plugin.
// Phase 8: Migrated from scattered provider-selectors.ts, composer-typing.ts.

import type { ProviderPlugin } from '../plugin.js'
import { BaseProviderPlugin } from '../plugin.js'

export class GeminiPlugin extends BaseProviderPlugin implements ProviderPlugin {
  id = 'gemini'
  name = 'Gemini'

  urls = {
    login: 'https://gemini.google.com/login',
    app: 'https://gemini.google.com/',
    loggedInPattern: /gemini\.google\.com\/(app|chat)/,
  }

  selectors = {
    composer: [
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      '.input-area [contenteditable="true"]',
    ],
    sendButton: [
      'button[aria-label="Send message"]',
      'button.send-button',
      '.input-area button[type="submit"]',
    ],
    fallback: 'heuristic' as const,
  }

  composerType = 'quill' as const

  typing = {
    type: 'quill' as const,
    options: {
      delayMs: 40,
      humanLike: true,
      clearFirst: true,
    },
  }

  antiDetection = [
    {
      name: 'gemini-override',
      script: `
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      `,
      runAt: 'document_start' as const,
    },
  ]

  capabilities = [
    { id: 'gemini_send', action: 'send_message', surfaces: ['cli', 'ui', 'api'] },
    { id: 'gemini_select_model', action: 'select_model', surfaces: ['cli', 'ui'] },
  ]
}
