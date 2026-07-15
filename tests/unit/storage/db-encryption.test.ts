import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DbEncryptionEngine, type EncryptedDbBlob } from '../../../src/engines/db-encryption.js'

describe('db-encryption (36.1)', () => {
  const sample = new TextEncoder().encode('SQLite format 3 -- cap-store payload')

  it('round-trips DB bytes with the correct key', () => {
    const engine = new DbEncryptionEngine('correct horse battery staple')
    const blob = engine.encryptBytes(sample)
    const out = engine.decryptBytes(blob)
    expect(new TextDecoder().decode(out)).toBe('SQLite format 3 -- cap-store payload')
  })

  it('wrong key cannot decrypt (on-disk DB unreadable without key)', () => {
    const good = new DbEncryptionEngine('right-key')
    const blob: EncryptedDbBlob = good.encryptBytes(sample)
    const bad = new DbEncryptionEngine('wrong-key')
    expect(() => bad.decryptBytes(blob)).toThrow()
  })

  it('encrypted blob is not plaintext-readable', () => {
    const engine = new DbEncryptionEngine('key')
    const blob = engine.encryptBytes(sample)
    const serialized = JSON.stringify(blob)
    expect(serialized).not.toContain('SQLite format 3')
  })

  it('migrate path is non-destructive and restores identically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vivim-dbenc-'))
    const plain = join(dir, 'cap-store.sqlite')
    const cipher = join(dir, 'cap-store.sqlite.enc')
    writeFileSync(plain, Buffer.from(sample))

    const engine = new DbEncryptionEngine('migrate-key')
    engine.migrate(plain, cipher, true)
    expect(existsSync(plain)).toBe(false)
    expect(existsSync(cipher)).toBe(true)

    const restored = join(dir, 'cap-store.restored.sqlite')
    const out = engine.restore(cipher, restored)
    expect(new TextDecoder().decode(out)).toBe('SQLite format 3 -- cap-store payload')
    rmSync(dir, { recursive: true, force: true })
  })
})
