// tests/unit/engines/update-engine.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { UpdateEngine } from '../../../src/engines/update-engine.js'

describe('UpdateEngine', () => {
  let updater: UpdateEngine

  beforeEach(() => {
    updater = new UpdateEngine({
      currentVersion: '1.0.0',
      repoOwner: 'test-owner',
      repoName: 'test-repo',
    })
  })

  it('returns current version', () => {
    expect(updater.getCurrentVersion()).toBe('1.0.0')
  })

  it('compares semver versions correctly', () => {
    const compare = (updater as any).compareVersions.bind(updater)
    expect(compare('1.0.1', '1.0.0')).toBe(1)
    expect(compare('1.0.0', '1.0.0')).toBe(0)
    expect(compare('0.9.9', '1.0.0')).toBe(-1)
    expect(compare('2.0.0', '1.9.9')).toBe(1)
  })

  it('generates release URLs', () => {
    const getUrl = (updater as any).getReleaseUrl.bind(updater)
    expect(getUrl()).toBe('https://api.github.com/repos/test-owner/test-repo/releases/latest')
    expect(getUrl('v1.1.0')).toBe(
      'https://api.github.com/repos/test-owner/test-repo/releases/tags/v1.1.0',
    )
  })
})
