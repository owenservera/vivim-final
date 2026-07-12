// tests/unit/engines/encryption.test.ts
// EncryptionEngine — AES-256-GCM + PBKDF2 key derivation tests

import { describe, expect, test } from 'bun:test'
import { EncryptionEngine } from '../../../src/engines/encryption.js'

describe('EncryptionEngine', () => {
  test('unlock/lock lifecycle', async () => {
    const enc = new EncryptionEngine()
    expect(enc.isUnlocked()).toBe(false)
    await enc.unlock('test-passphrase')
    expect(enc.isUnlocked()).toBe(true)
    enc.lock()
    expect(enc.isUnlocked()).toBe(false)
  })

  test('encrypt and decrypt round-trip', async () => {
    const enc = new EncryptionEngine()
    await enc.unlock('my-secret')
    const plaintext = 'Hello, World! This is a test message.'
    const encrypted = enc.encrypt(plaintext)
    expect(encrypted.ciphertext).not.toBe(plaintext)
    expect(encrypted.algorithm).toBe('aes-256-gcm')
    expect(encrypted.iv).toBeTruthy()
    expect(encrypted.salt).toBeTruthy()
    expect(encrypted.authTag).toBeTruthy()
    const decrypted = enc.decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  test('encrypt throws when locked', async () => {
    const enc = new EncryptionEngine()
    expect(() => enc.encrypt('test')).toThrow('locked')
  })

  test('decrypt throws when locked', async () => {
    const enc = new EncryptionEngine()
    await enc.unlock('passphrase')
    const encrypted = enc.encrypt('data')
    enc.lock()
    expect(() => enc.decrypt(encrypted)).toThrow('locked')
  })

  test('encryptField and decryptField round-trip', async () => {
    const enc = new EncryptionEngine()
    await enc.unlock('field-secret')
    const value = 'sensitive-data-123'
    const encryptedField = enc.encryptField(value)
    expect(typeof encryptedField).toBe('string')
    expect(encryptedField).not.toBe(value)
    const decryptedField = enc.decryptField(encryptedField)
    expect(decryptedField).toBe(value)
  })

  test('different passphrases produce different ciphertexts', async () => {
    const enc1 = new EncryptionEngine()
    const enc2 = new EncryptionEngine()
    await enc1.unlock('passphrase-one')
    await enc2.unlock('passphrase-two')
    const encrypted1 = enc1.encrypt('same data')
    const encrypted2 = enc2.encrypt('same data')
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
  })

  test('same passphrase with different salts produces different ciphertexts', async () => {
    const enc1 = new EncryptionEngine()
    const enc2 = new EncryptionEngine()
    await enc1.unlock('same-pass')
    await enc2.unlock('same-pass')
    const e1 = enc1.encrypt('data')
    const e2 = enc2.encrypt('data')
    // Salt and IV are random, so ciphertexts differ
    expect(e1.ciphertext).not.toBe(e2.ciphertext)
  })

  test('custom config overrides defaults', async () => {
    const enc = new EncryptionEngine({ iterations: 100_000 })
    await enc.unlock('fast-pass')
    const encrypted = enc.encrypt('quick test')
    const decrypted = enc.decrypt(encrypted)
    expect(decrypted).toBe('quick test')
  })
})
