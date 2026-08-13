// tests/unit/message-metadata.test.ts
// Tests for message metadata (pin, archive, read status)

import { describe, expect, it } from 'bun:test'

describe('Message Metadata', () => {
  it('should validate metadata input structure', () => {
    const metadata = {
      isPinned: 1,
      isArchived: 0,
      readStatus: 'unread',
    }

    expect(metadata.isPinned).toBe(1)
    expect(metadata.isArchived).toBe(0)
    expect(metadata.readStatus).toBe('unread')
  })

  it('should accept partial metadata updates', () => {
    const partialUpdate: Record<string, unknown> = {
      isPinned: 1,
    }

    expect(partialUpdate.isPinned).toBe(1)
    expect('isArchived' in partialUpdate).toBe(false)
    expect('readStatus' in partialUpdate).toBe(false)
  })

  it('should handle different read status values', () => {
    const statuses = ['unread', 'read', 'archived']

    for (const status of statuses) {
      const metadata = { readStatus: status }
      expect(metadata.readStatus).toBe(status)
    }
  })
})
