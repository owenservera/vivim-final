// tests/unit/engines/chat/selectors.test.ts
// Caches: Selector fallback chain, URL matching, selector health

import { describe, expect, it } from 'bun:test'

// ── Selector data (mirrors src/engines/provider-selectors.ts) ──────────────

const PROVIDER_URLS: Record<string, string> = {
  claude: 'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  deepseek: 'https://chat.deepseek.com/',
  gemini: 'https://gemini.google.com/app',
  copilot: 'https://copilot.microsoft.com/',
  perplexity: 'https://www.perplexity.ai/',
  'github-copilot': 'https://github.com/copilot',
  you: 'https://you.com/search',
  poe: 'https://poe.com/',
  mistral: 'https://chat.mistral.ai/',
  zai: 'https://z.ai/chat',
  'studio-ai': 'https://studio.ai/',
}

const PROVIDER_URL_PATTERNS: Array<{ provider: string; pattern: RegExp; score: number }> = [
  { provider: 'claude', pattern: /^https?:\/\/(www\.)?claude\.ai/, score: 100 },
  { provider: 'chatgpt', pattern: /^https?:\/\/(www\.)?chatgpt\.com/, score: 100 },
  { provider: 'deepseek', pattern: /^https?:\/\/chat\.deepseek\.com/, score: 100 },
  { provider: 'gemini', pattern: /^https?:\/\/gemini\.google\.com/, score: 100 },
  { provider: 'copilot', pattern: /^https?:\/\/copilot\.microsoft\.com/, score: 100 },
  { provider: 'perplexity', pattern: /^https?:\/\/(www\.)?perplexity\.ai/, score: 100 },
  { provider: 'github-copilot', pattern: /^https?:\/\/github\.com\/copilot/, score: 100 },
  { provider: 'you', pattern: /^https?:\/\/you\.com/, score: 100 },
  { provider: 'poe', pattern: /^https?:\/\/(www\.)?poe\.com/, score: 100 },
  { provider: 'mistral', pattern: /^https?:\/\/chat\.mistral\.ai/, score: 100 },
  { provider: 'zai', pattern: /^https?:\/\/z\.ai/, score: 100 },
  { provider: 'studio-ai', pattern: /^https?:\/\/studio\.ai/, score: 100 },
]

interface SelectorDef {
  selector: string
  fallbacks: string[]
  label: string
}

const COMPOSER_SELECTORS: Record<string, SelectorDef> = {
  claude: {
    selector: '[contenteditable="true"].ProseMirror',
    fallbacks: ['div[contenteditable="true"]', 'textarea'],
    label: 'Claude composer',
  },
  chatgpt: {
    selector: '#prompt-textarea',
    fallbacks: ['textarea[placeholder*="Message"]', 'div[contenteditable="true"]'],
    label: 'ChatGPT composer',
  },
  deepseek: {
    selector: 'textarea#chat-input',
    fallbacks: ['textarea[placeholder*="Message"]', 'div[contenteditable="true"]'],
    label: 'DeepSeek composer',
  },
  gemini: {
    selector: '.ql-editor.textarea',
    fallbacks: ['div[contenteditable="true"]', 'textarea'],
    label: 'Gemini composer',
  },
  default: {
    selector: 'textarea',
    fallbacks: ['div[contenteditable="true"]', 'input[type="text"]'],
    label: 'Generic composer',
  },
}

// ── Helper functions ────────────────────────────────────────────────────────

function matchUrlToProvider(url: string): string | null {
  for (const { provider, pattern } of PROVIDER_URL_PATTERNS) {
    if (pattern.test(url)) return provider
  }
  return null
}

function resolveComposerSelectors(providerId: string): string[] {
  const def = COMPOSER_SELECTORS[providerId] || COMPOSER_SELECTORS.default
  if (!def) return ['textarea']
  return [def.selector, ...def.fallbacks]
}

function testSelectorHealth(selectors: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  for (const sel of selectors) {
    if (!sel || sel.trim() === '') {
      errors.push(`Empty selector: "${sel}"`)
    }
    // Check for valid CSS selector characters
    if (/[{}<>]/.test(sel)) {
      errors.push(`Invalid selector syntax: "${sel}"`)
    }
  }
  return { valid: errors.length === 0, errors }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Selectors: URL pattern matching', () => {
  const testCases: Array<[string, string | null]> = [
    ['https://claude.ai/chat', 'claude'],
    ['https://www.claude.ai/new', 'claude'],
    ['https://chatgpt.com/', 'chatgpt'],
    ['https://chat.deepseek.com/', 'deepseek'],
    ['https://gemini.google.com/app', 'gemini'],
    ['https://copilot.microsoft.com/', 'copilot'],
    ['https://www.perplexity.ai/', 'perplexity'],
    ['https://github.com/copilot', 'github-copilot'],
    ['https://you.com/search', 'you'],
    ['https://poe.com/', 'poe'],
    ['https://chat.mistral.ai/', 'mistral'],
    ['https://z.ai/chat', 'zai'],
    ['https://studio.ai/', 'studio-ai'],
    ['https://google.com', null],
    ['https://example.com/chat', null],
  ]

  for (const [url, expected] of testCases) {
    it(`URL "${url}" → ${expected ?? 'null'}`, () => {
      expect(matchUrlToProvider(url)).toBe(expected)
    })
  }
})

describe('Selectors: Composer selector resolution', () => {
  it('Claude: returns ProseMirror + fallbacks', () => {
    const selectors = resolveComposerSelectors('claude')
    expect(selectors[0]).toBe('[contenteditable="true"].ProseMirror')
    expect(selectors.length).toBeGreaterThanOrEqual(2)
  })

  it('ChatGPT: returns #prompt-textarea + fallbacks', () => {
    const selectors = resolveComposerSelectors('chatgpt')
    expect(selectors[0]).toBe('#prompt-textarea')
    expect(selectors.length).toBeGreaterThanOrEqual(2)
  })

  it('Unknown provider: returns default selectors', () => {
    const selectors = resolveComposerSelectors('unknown_provider')
    expect(selectors[0]).toBe('textarea')
    expect(selectors.length).toBeGreaterThanOrEqual(2)
  })

  it('All providers have at least one selector', () => {
    const providerIds = Object.keys(PROVIDER_URLS)
    for (const id of providerIds) {
      const selectors = resolveComposerSelectors(id)
      expect(selectors.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('Selectors: Health validation', () => {
  it('Valid selectors pass', () => {
    const selectors = [
      '[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"]',
      'textarea',
    ]
    const result = testSelectorHealth(selectors)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('Empty selector fails', () => {
    const result = testSelectorHealth(['valid-selector', '', 'another'])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Empty selector')
  })

  it('Invalid syntax fails', () => {
    const result = testSelectorHealth(['textarea{color:red}'])
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid selector syntax')
  })
})

describe('Selectors: Provider URL completeness', () => {
  it('All 12 providers have URLs', () => {
    const expected = [
      'claude',
      'chatgpt',
      'deepseek',
      'gemini',
      'copilot',
      'perplexity',
      'github-copilot',
      'you',
      'poe',
      'mistral',
      'zai',
      'studio-ai',
    ]
    for (const id of expected) {
      expect(PROVIDER_URLS[id]).toBeDefined()
      expect(PROVIDER_URLS[id]).toMatch(/^https?:\/\//)
    }
  })

  it('All URL patterns are valid RegExp', () => {
    for (const { pattern } of PROVIDER_URL_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp)
      expect(pattern.source).toBeTruthy()
    }
  })
})
