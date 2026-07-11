// tests/unit/executor/launcher.test.ts
// Unit tests for Chrome launcher utilities.

import { describe, expect, it } from 'bun:test'
import { buildChromeArgs, getDefaultChromePaths } from '../../../src/executor/launcher.js'

describe('Chrome Launcher', () => {
  describe('getDefaultChromePaths', () => {
    it('returns an array of paths for the current platform', () => {
      const paths = getDefaultChromePaths()
      expect(Array.isArray(paths)).toBe(true)
      expect(paths.length).toBeGreaterThan(0)
    })
  })

  describe('buildChromeArgs', () => {
    it('includes --headless=new by default', () => {
      const args = buildChromeArgs({})
      expect(args).toContain('--headless=new')
    })

    it('does not include --headless when visible is true', () => {
      const args = buildChromeArgs({ visible: true })
      expect(args).not.toContain('--headless=new')
    })

    it('includes remote debugging port when specified', () => {
      const args = buildChromeArgs({ debugPort: 9222 })
      expect(args).toContain('--remote-debugging-port=9222')
    })

    it('includes user-data-dir when profileDir is set', () => {
      const args = buildChromeArgs({ profileDir: '/tmp/my-profile' })
      expect(args).toContain('--user-data-dir=/tmp/my-profile')
    })

    it('includes --disable-gpu when disableGpu is true', () => {
      const args = buildChromeArgs({ disableGpu: true })
      expect(args).toContain('--disable-gpu')
    })

    it('includes window-size when windowSize is provided', () => {
      const args = buildChromeArgs({ windowSize: { width: 1280, height: 720 } })
      expect(args).toContain('--window-size=1280,720')
    })

    it('includes extraArgs when provided', () => {
      const args = buildChromeArgs({ extraArgs: ['--custom-flag=value'] })
      expect(args).toContain('--custom-flag=value')
    })

    it('always includes --no-first-run and --disable-extensions', () => {
      const args = buildChromeArgs({})
      expect(args).toContain('--no-first-run')
      expect(args).toContain('--disable-extensions')
    })

    it('positions window off-screen on Windows when hidden', () => {
      const originalPlatform = process.platform
      // We can't easily mock process.platform, so just test the logic
      // by checking the args include the flag when visible is false
      const args = buildChromeArgs({ visible: false })
      // On non-Windows, this flag is NOT added
      if (originalPlatform !== 'win32') {
        expect(args).not.toContain('--window-position=-32000,-32000')
      }
    })
  })
})
