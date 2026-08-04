// src/engines/encryption.ts
// EncryptionEngine — AES-256-GCM transparent encryption with PBKDF2 key derivation

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { EngineError } from '../errors.js'
import { safeJsonParse } from '../lib/safe-json.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm'
  keyDerivation: 'pbkdf2'
  iterations: number
  saltLength: number
  ivLength: number
}

export interface EncryptedData {
  ciphertext: string // base64
  iv: string // base64
  salt: string // base64
  authTag: string // base64
  algorithm: string
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 600_000,
  saltLength: 32,
  ivLength: 12,
}

// ── Engine ──────────────────────────────────────────────────────────────

export class EncryptionEngine {
  private key: Buffer | null = null
  private saltBuffer: Buffer | null = null
  private config: EncryptionConfig

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async unlock(passphrase: string): Promise<void> {
    const salt = this.getOrCreateSalt()
    this.key = pbkdf2Sync(passphrase, salt, this.config.iterations, 32, 'sha256')
  }

  lock(): void {
    this.key = null
  }

  isUnlocked(): boolean {
    return this.key !== null
  }

  encrypt(plaintext: string): EncryptedData {
    if (!this.key) throw new EngineError('EncryptionEngine is locked — call unlock() first')
    const iv = randomBytes(this.config.ivLength)
    const cipher = createCipheriv(this.config.algorithm, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      salt: this.getSaltBase64(),
      authTag: authTag.toString('base64'),
      algorithm: this.config.algorithm,
    }
  }

  decrypt(encrypted: EncryptedData): string {
    if (!this.key) throw new EngineError('EncryptionEngine is locked — call unlock() first')
    const decipher = createDecipheriv(
      encrypted.algorithm,
      this.key,
      Buffer.from(encrypted.iv, 'base64'),
    )
    ;(decipher as import('node:crypto').DecipherGCM).setAuthTag(
      Buffer.from(encrypted.authTag, 'base64'),
    )
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  }

  encryptField(value: string): string {
    const encrypted = this.encrypt(value)
    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  decryptField(encryptedValue: string): string {
    const json = Buffer.from(encryptedValue, 'base64').toString('utf8')
    const encrypted = safeJsonParse(json, {} as EncryptedData) as EncryptedData
    return this.decrypt(encrypted)
  }

  private getOrCreateSalt(): Buffer {
    if (this.saltBuffer) return this.saltBuffer
    this.saltBuffer = randomBytes(this.config.saltLength)
    return this.saltBuffer
  }

  private getSaltBase64(): string {
    return (this.saltBuffer ?? Buffer.alloc(0)).toString('base64')
  }
}
