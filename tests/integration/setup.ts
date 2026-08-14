// tests/integration/setup.ts
// Integration test setup - checks for real Chrome availability

import { spawn } from 'node:child_process'

let chromeAvailable: boolean | null = null

export interface ChromeInfo {
  available: boolean
  path: string | null
  version: string | null
}

export function isChromeAvailable(): ChromeInfo {
  if (chromeAvailable !== null) {
    return {
      available: chromeAvailable,
      path: process.env.CHROME_PATH ?? null,
      version: process.env.CHROME_VERSION ?? null,
    }
  }

  // Check for Chrome on PATH or in common locations
  const commonPaths = [
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
    'chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]

  for (const cmd of commonPaths) {
    try {
      const proc = spawn(cmd, ['--version'], { shell: true })
      proc.on('error', () => {})
      proc.on('close', (code) => {
        if (code === 0) {
          chromeAvailable = true
          process.env.CHROME_PATH = cmd
        }
      })
      if (proc.pid) {
        chromeAvailable = true
        process.env.CHROME_PATH = cmd
        return { available: true, path: cmd, version: 'detected' }
      }
    } catch {
      // [audit] log the error with context here
      // Try next Chrome binary
    }
  }

  chromeAvailable = false
  return { available: false, path: null, version: null }
}

export function skipIfNoChrome() {
  const info = isChromeAvailable()
  if (!info.available) {
    // [audit] removed: console.warn('Skipping integration test - Chrome not available')
    return true
  }
  return false
}

export const TEST_PORT_RANGE: [number, number] = [9330, 9350]
