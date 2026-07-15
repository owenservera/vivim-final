// tests/unit/engines/chrome-setup-wizard.test.ts
// ChromeSetupWizard — URL/policy helpers + needsSetup (no real Chrome launch).

import { describe, expect, it } from 'bun:test'
import { ChromeSetupWizard } from '../../../src/engines/chrome-setup-wizard.js'

function makeDb(findFirst: any = null): any {
  return { prisma: { providerAccount: { findFirst: async () => findFirst } } }
}
function makeAllocator(): any {
  return { allocate: async () => '/tmp/profile' }
}

describe('ChromeSetupWizard', () => {
  it('returns the provider login URL (with fallback)', () => {
    const w = new ChromeSetupWizard(makeDb(), makeAllocator())
    expect(w.getLoginUrl('chatgpt')).toBe('https://chatgpt.com')
    expect(w.getLoginUrl('unknown-slug')).toBe('https://unknown-slug.com')
  })

  it('detects logged-in URLs via provider patterns', () => {
    const w = new ChromeSetupWizard(makeDb(), makeAllocator())
    expect(w.isLoggedInUrl('chatgpt', 'https://chatgpt.com/c/abc')).toBe(true)
    expect(w.isLoggedInUrl('claude', 'https://claude.ai/chat')).toBe(true)
    expect(w.isLoggedInUrl('gemini', 'https://gemini.google.com/app')).toBe(true)
    expect(w.isLoggedInUrl('chatgpt', 'https://evil.example.com')).toBe(false)
    expect(w.isLoggedInUrl('nope', 'https://x.com')).toBe(false)
  })

  it('needsSetup returns true when no account exists', async () => {
    const w = new ChromeSetupWizard(makeDb(null), makeAllocator())
    expect(await w.needsSetup('pid', 'a@b.com')).toBe(true)
  })

  it('needsSetup returns true when the persisted profile dir is missing', async () => {
    const w = new ChromeSetupWizard(
      makeDb({ profileDir: '/nonexistent/path/xyz', loginState: 'logged_in' }),
      makeAllocator(),
    )
    expect(await w.needsSetup('pid', 'a@b.com')).toBe(true)
  })
})
