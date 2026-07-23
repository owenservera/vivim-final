// tests/unit/engines/db-encryption.test.ts
// DbEncryptionEngine — encrypt/decrypt round-trip, passphrase validation.
import { describe, expect, it } from 'bun:test'
import { DbEncryptionEngine } from '../../../src/engines/db-encryption.js'
import { EngineError } from '../../../src/errors.js'

describe('DbEncryptionEngine', () => {
  it('throws on empty passphrase', () => {
    expect(() => new DbEncryptionEngine('')).toThrow(EngineError)
  })

  it('encrypts and decrypts round-trip', () => {
    const engine = new DbEncryptionEngine('test-passphrase')
    const plain = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const encrypted = engine.encryptBytes(plain)
    expect(encrypted.magic).toBe('VIVIMDB1')
    expect(encrypted.salt).toBeTruthy()
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.authTag).toBeTruthy()
    expect(encrypted.ciphertext).toBeTruthy()

    const decrypted = engine.decryptBytes(encrypted)
    expect(Array.from(decrypted)).toEqual(Array.from(plain))
  })

  it('different passphrases produce different ciphertext', () => {
    const e1 = new DbEncryptionEngine('passphrase-1')
    const e2 = new DbEncryptionEngine('passphrase-2')
    const plain = new Uint8Array([42, 43, 44])
    const enc1 = e1.encryptBytes(plain)
    const enc2 = e2.encryptBytes(plain)
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
  })

  it('decrypt with wrong passphrase throws', () => {
    const engine = new DbEncryptionEngine('correct-passphrase')
    const plain = new Uint8Array([10, 20, 30])
    const encrypted = engine.encryptBytes(plain)
    const wrongEngine = new DbEncryptionEngine('wrong-passphrase')
    expect(() => wrongEngine.decryptBytes(encrypted)).toThrow(EngineError)
  })

  it('decrypt tampered blob throws', () => {
    const engine = new DbEncryptionEngine('passphrase')
    const plain = new Uint8Array([1, 2, 3])
    const encrypted = engine.encryptBytes(plain)
    encrypted.ciphertext = Buffer.from('tampered').toString('base64')
    expect(() => engine.decryptBytes(encrypted)).toThrow(EngineError)
  })

  it('decrypt non-vivim blob throws', () => {
    const engine = new DbEncryptionEngine('passphrase')
    const fakeBlob = { magic: 'NOTVIVIM', salt: '', iv: '', authTag: '', ciphertext: '' }
    expect(() => engine.decryptBytes(fakeBlob)).toThrow(EngineError)
  })

  it('handles empty plaintext', () => {
    const engine = new DbEncryptionEngine('passphrase')
    const plain = new Uint8Array([])
    const encrypted = engine.encryptBytes(plain)
    const decrypted = engine.decryptBytes(encrypted)
    expect(decrypted).toHaveLength(0)
  })

  it('handles large plaintext', () => {
    const engine = new DbEncryptionEngine('passphrase')
    const plain = new Uint8Array(10000).fill(42)
    const encrypted = engine.encryptBytes(plain)
    const decrypted = engine.decryptBytes(encrypted)
    expect(Array.from(decrypted)).toEqual(Array.from(plain))
  })
})
