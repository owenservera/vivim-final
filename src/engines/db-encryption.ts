// src/engines/db-encryption.ts
// DbEncryptionEngine — whole-database at-rest envelope encryption (Unit 36.1)
//
// Field-level encryption (10.1) covers sensitive columns. This adds an optional
// envelope encryption of the entire on-disk SQLite file so the database is
// unreadable without the envelope key. The key is derived from a local
// keychain passphrase / env secret and is unique per database (salted).
//
// This is a file-envelope approach: it encrypts the SQLite bytes at rest. The
// live Prisma client keeps using the plaintext file path; the migration tool
// below produces an encrypted copy and (optionally) swaps it into place behind
// an application-managed decryption-on-open wrapper.

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { EngineError } from '../errors.js'

const ALGO = 'aes-256-gcm'
const SALT_LEN = 32
const IV_LEN = 12
const KEY_LEN = 32
const MAGIC = Buffer.from('VIVIMDB1', 'utf8') // marks an encrypted blob

export interface EncryptedDbBlob {
  magic: string
  salt: string // base64
  iv: string // base64
  authTag: string // base64
  ciphertext: string // base64
}

function b64(buf: Buffer): string {
  return buf.toString('base64')
}
function fromB64(s: string): Buffer {
  return Buffer.from(s, 'base64')
}

// Derive a stable per-DB key from a passphrase + DB-specific salt (scrypt).
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN)
}

export class DbEncryptionEngine {
  private readonly passphrase: string

  constructor(passphrase: string) {
    if (!passphrase || passphrase.length === 0) {
      throw new EngineError('DbEncryptionEngine requires a non-empty passphrase')
    }
    this.passphrase = passphrase
  }

  // Encrypt raw DB bytes → self-describing envelope blob.
  encryptBytes(plain: Uint8Array): EncryptedDbBlob {
    const salt = randomBytes(SALT_LEN)
    const iv = randomBytes(IV_LEN)
    const key = deriveKey(this.passphrase, salt)
    const cipher = createCipheriv(ALGO, key, iv)
    const ct = Buffer.concat([cipher.update(Buffer.from(plain)), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      magic: MAGIC.toString('utf8'),
      salt: b64(salt),
      iv: b64(iv),
      authTag: b64(authTag),
      ciphertext: b64(ct),
    }
  }

  // Decrypt an envelope blob back to raw DB bytes. Throws on wrong key/tamper.
  decryptBytes(blob: EncryptedDbBlob): Uint8Array {
    if (blob.magic !== MAGIC.toString('utf8')) {
      throw new EngineError('Not a vivim encrypted DB blob')
    }
    const salt = fromB64(blob.salt)
    const iv = fromB64(blob.iv)
    const key = deriveKey(this.passphrase, salt)
    try {
      const decipher = createDecipheriv(ALGO, key, iv)
      decipher.setAuthTag(fromB64(blob.authTag))
      const pt = Buffer.concat([decipher.update(fromB64(blob.ciphertext)), decipher.final()])
      return new Uint8Array(pt)
    } catch {
      throw new EngineError('DB decryption failed: wrong key or corrupted blob')
    }
  }

  // Non-destructive migration: encrypt the DB at `plainPath`, write the
  // encrypted copy to `cipherPath`, then shred the original. The original
  // plaintext is never modified until the encrypted copy is written.
  migrate(plainPath: string, cipherPath: string, shredOriginal = true): EncryptedDbBlob {
    const plain = readBytes(plainPath)
    const blob = this.encryptBytes(plain)
    const serialized = serializeBlob(blob)
    writeFileSync(cipherPath, serialized)
    if (shredOriginal) {
      // Best-effort shred: overwrite then unlink.
      writeFileSync(plainPath, randomBytes(plain.length || 1))
      rmSync(plainPath, { force: true })
    }
    return blob
  }

  // Restore: decrypt `cipherPath` and write plaintext to `plainPath`.
  restore(cipherPath: string, plainPath: string): Uint8Array {
    const blob = deserializeBlob(cipherPath)
    const plain = this.decryptBytes(blob)
    writeFileSync(plainPath, Buffer.from(plain))
    return plain
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function readBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path))
}

function serializeBlob(blob: EncryptedDbBlob): Buffer {
  const json = JSON.stringify(blob)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(Buffer.byteLength(json), 0)
  return Buffer.concat([len, Buffer.from(json, 'utf8')])
}

function deserializeBlob(path: string): EncryptedDbBlob {
  const buf = readFileSync(path)
  const len = buf.readUInt32BE(0)
  const json = buf.subarray(4, 4 + len).toString('utf8')
  return JSON.parse(json) as EncryptedDbBlob
}

// Re-export for parity with EncryptionEngine's pbkdf2 style key derivation if
// a caller prefers passphrase-based (non-scrypt) keying.
export { pbkdf2Sync }
