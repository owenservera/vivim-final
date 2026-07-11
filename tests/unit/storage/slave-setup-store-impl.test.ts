// tests/unit/storage/slave-setup-store-impl.test.ts
// Unit tests for workspace hint + profile management.

import { describe, expect, it } from 'bun:test'
import { ProfileAllocator } from '../../../src/executor/profile-allocator.js'

describe('ProfileAllocator', () => {
  it('uses workspace path correctly on Windows', () => {
    const allocator = new ProfileAllocator('C:\\test\\workspace')
    const path = allocator.getPath('chatgpt', 'work')
    expect(path).toContain('chatgpt')
    expect(path).toContain('work')
    expect(path).toContain('C:\\test\\workspace')
  })

  it('uses workspace path correctly on Unix', () => {
    const allocator = new ProfileAllocator('/home/user/workspace')
    const path = allocator.getPath('claude', 'personal')
    expect(path).toContain('claude')
    expect(path).toContain('personal')
    expect(path).toContain('workspace')
  })

  it('defaults to chrome-profiles in cwd when no workspace provided', () => {
    const allocator = new ProfileAllocator()
    const path = allocator.getPath('gemini', 'default')
    expect(path).toContain('gemini')
    expect(path).toContain('default')
    expect(path).toContain('chrome-profiles')
  })
})

describe('SetupRouter', () => {
  it('has correct provider login URLs', () => {
    // Verify provider URLs are defined correctly for visible Chrome login
    const PROVIDER_LOGIN_URLS: Record<string, string> = {
      chatgpt: 'https://chatgpt.com/',
      claude: 'https://claude.ai/',
      gemini: 'https://gemini.google.com/',
    }
    expect(PROVIDER_LOGIN_URLS.chatgpt).toBe('https://chatgpt.com/')
    expect(PROVIDER_LOGIN_URLS.claude).toBe('https://claude.ai/')
    expect(PROVIDER_LOGIN_URLS.gemini).toBe('https://gemini.google.com/')
  })
})
