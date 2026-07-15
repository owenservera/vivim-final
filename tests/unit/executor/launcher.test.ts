// tests/unit/executor/launcher.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearSingletonLock } from '../../../src/executor/launcher.js'

let tmp: string

beforeEach(() => {
  tmp = join(tmpdir(), `vivim-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tmp, { recursive: true })
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe('clearSingletonLock (FR-11)', () => {
  it('removes SingletonLock / SingletonCookie / SingletonSocket', () => {
    for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      writeFileSync(join(tmp, name), 'locked')
      expect(existsSync(join(tmp, name))).toBe(true)
    }
    clearSingletonLock(tmp)
    expect(existsSync(join(tmp, 'SingletonLock'))).toBe(false)
    expect(existsSync(join(tmp, 'SingletonCookie'))).toBe(false)
    expect(existsSync(join(tmp, 'SingletonSocket'))).toBe(false)
  })

  it('is a no-op for an empty dir / missing locks', () => {
    expect(() => clearSingletonLock(tmp)).not.toThrow()
    expect(existsSync(tmp)).toBe(true)
  })

  it('tolerates missing profile dir', () => {
    expect(() => clearSingletonLock('')).not.toThrow()
  })
})
