// tests/unit/message-identity.test.ts
// Tests for message identity deduplication

import { describe, expect, it } from 'bun:test'
import { MessageIdentity } from '../../src/engines/message-identity.js'

describe('MessageIdentity', () => {
  it('should generate consistent hash for same input', () => {
    const input = {
      provider: 'openai',
      account: 'test@example.com',
      convId: 'conv-123',
      role: 'user',
      content: 'Hello world',
    }

    const hash1 = MessageIdentity.generate(input)
    const hash2 = MessageIdentity.generate(input)

    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA256 hex length
  })

  it('should generate different hashes for different content', () => {
    const input1 = {
      provider: 'openai',
      account: 'test@example.com',
      convId: 'conv-123',
      role: 'user',
      content: 'Hello world',
    }

    const input2 = {
      provider: 'openai',
      account: 'test@example.com',
      convId: 'conv-123',
      role: 'user',
      content: 'Different content',
    }

    const hash1 = MessageIdentity.generate(input1)
    const hash2 = MessageIdentity.generate(input2)

    expect(hash1).not.toBe(hash2)
  })

  it('should use provider message ID when available', () => {
    const inputWithId = {
      provider: 'openai',
      account: 'test@example.com',
      convId: 'conv-123',
      role: 'user',
      content: 'Hello world',
      providerMsgId: 'msg-456',
    }

    const inputWithoutId = {
      provider: 'openai',
      account: 'test@example.com',
      convId: 'conv-123',
      role: 'user',
      content: 'Hello world',
    }

    const hashWithId = MessageIdentity.generate(inputWithId)
    const hashWithoutId = MessageIdentity.generate(inputWithoutId)

    expect(hashWithId).not.toBe(hashWithoutId)
  })
})
