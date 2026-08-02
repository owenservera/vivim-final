/**
 * Chain Verifier — Ed25519 Signature Verification
 *
 * Implements the exact algorithm from CRYPTO_SPEC.md §5.
 * Must agree byte-for-byte with:
 * - vivim-page/src/lib/crypto.ts (server signing)
 * - Tauri client verification code
 *
 * Hash chain: sha256_hex( (prevHash ?? "") + "\n" + contentJson )
 * Signature:  Ed25519 over utf8( (prevHash ?? "") + "\n" + entryHash )
 */
import { createHash } from 'node:crypto'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

// Wire SHA-512 into @noble/ed25519 (must be done once at module load)
ed.hashes.sha512 = sha512

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Compute entry hash: sha256_hex( (prevHash ?? "") + "\n" + contentJson )
 *
 * CRITICAL: Hash the stored string, never re-serialize JSON.
 * The hash is computed over the exact UTF-8 bytes of the contentJson
 * string as stored, not over JSON.parse(contentJson) re-stringified.
 */
export function computeEntryHash(prevHash: string | null, contentJson: string): string {
  return createHash('sha256')
    .update(`${prevHash ?? ''}\n${contentJson}`, 'utf8')
    .digest('hex')
}

/**
 * Verify Ed25519 signature over (prevHash, entryHash).
 *
 * message = utf8_bytes( (prevHash ?? "") + "\n" + entryHash )
 * Returns true if signature is valid.
 */
export async function verifyEntrySignature(
  entryHash: string,
  prevHash: string | null,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  const message = new TextEncoder().encode(`${prevHash ?? ''}\n${entryHash}`)
  try {
    return await ed.verifyAsync(hexToBytes(signatureHex), message, hexToBytes(publicKeyHex))
  } catch {
    return false
  }
}

/**
 * Full entry verification (CRYPTO_SPEC.md §5):
 *
 * 1. Chain linkage: entry.prevHash == expectedPrevHash
 * 2. Content hash: recomputedHash == entry.hash
 * 3. Signature: Ed25519_verify(signature, message, publicKey)
 *
 * Returns the entry hash (becomes expectedPrevHash for next entry).
 * Throws on any verification failure with a descriptive error message.
 */
export async function verifyEntry(
  entry: {
    prevHash: string | null
    hash: string
    signature: string
    contentJson: string
  },
  expectedPrevHash: string | null,
  publicKeyHex: string,
): Promise<string> {
  // 1. Chain linkage
  if (entry.prevHash !== expectedPrevHash) {
    throw new Error(
      `chain break: expected prevHash=${expectedPrevHash ?? 'null'}, got ${entry.prevHash ?? 'null'}`,
    )
  }

  // 2. Content hash
  const recomputedHash = computeEntryHash(entry.prevHash, entry.contentJson)
  if (recomputedHash !== entry.hash) {
    throw new Error(`content hash mismatch: expected ${entry.hash}, recomputed ${recomputedHash}`)
  }

  // 3. Signature
  const message = new TextEncoder().encode(`${entry.prevHash ?? ''}\n${entry.hash}`)
  const valid = await ed.verifyAsync(hexToBytes(entry.signature), message, hexToBytes(publicKeyHex))
  if (!valid) {
    throw new Error('invalid Ed25519 signature')
  }

  return entry.hash
}

/**
 * Verify a batch of entries in chain order.
 * Returns verified entries with their computed hashes.
 * Throws on first verification failure.
 */
export async function verifyBatch(
  entries: Array<{
    prevHash: string | null
    hash: string
    signature: string
    contentJson: string
  }>,
  startPrevHash: string | null,
  publicKeyHex: string,
): Promise<{ verified: typeof entries; lastHash: string | null }> {
  let currentPrevHash = startPrevHash
  const verified: typeof entries = []

  for (const entry of entries) {
    const hash = await verifyEntry(entry, currentPrevHash, publicKeyHex)
    verified.push(entry)
    currentPrevHash = hash
  }

  return { verified, lastHash: currentPrevHash }
}
