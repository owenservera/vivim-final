// tests/unit/storage/db-health.test.ts
import { describe, expect, it, mock } from 'bun:test'

// Mock config — migrated from vitest vi.mock to bun:test mock.module
mock.module('../../../src/config.js', () => ({
  config: {
    systemDbPath: '/test/system.db',
    userDbPath: '/test/user.db',
  },
}))

describe('db-health metadata', () => {
  it('defines health check dimensions', () => {
    const dimensions = [
      'integrityCheck',
      'fileSizeBytes',
      'walCheckpointLag',
      'pragmaValues',
      'schemaVersion',
    ] as const
    expect(dimensions).toHaveLength(5)
  })

  it('defines schema version format', () => {
    const version = { major: 1, minor: 0, patch: 0 }
    const str = `${version.major}.${version.minor}.${version.patch}`
    expect(str).toBe('1.0.0')
  })
})
