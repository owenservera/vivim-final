// src/engines/providers/plugins/claude.ts
// Claude provider plugin.
// Phase 8: Migrated from scattered provider-selectors.ts, composer-typing.ts.

import { BaseProviderPlugin } from '../plugin.js'
import type { ProviderPlugin } from '../plugin.js'

export class ClaudePlugin extends BaseProviderPlugin implements ProviderPlugin {
  id = 'claude'
  name = 'Claude'

  urls = {
    login: 'https://claude.ai/login',
    app: 'https://claude.ai/',
    loggedInPattern: /claude\.ai\/(chat|new)/,
  }

  selectors = {
    composer: [
      'div[contenteditable="true"]',
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="composer"]',
    ],
    sendButton: [
      'button[aria-label="Send Message"]',
      'button[data-testid="send-button"]',
      'form button[type="submit"]',
    ],
    fallback: 'heuristic' as const,
  }

  composerType = 'contenteditable' as const

  typing = {
    type: 'contenteditable' as const,
    options: {
      delayMs: 30,
      humanLike: true,
      clearFirst: true,
    },
  }

  antiDetection = [
    {
      name: 'claude-override',
      script: `
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      `,
      runAt: 'document_start' as const,
    },
  ]

  capabilities = [
    { id: 'claude_send', action: 'send_message', surfaces: ['cli', 'ui', 'api'] },
    { id: 'claude_select_model', action: 'select_model', surfaces: ['cli', 'ui'] },
  ]
}
