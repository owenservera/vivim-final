# 09 — Sovereign Data: Encryption, Export, Air-Gap, Sync, Telemetry Audit

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Objective:** 7 (The Sovereign Data Platform)

---

## Current State

- **Database:** SQLite via Prisma (`schema.prisma` line 6)
- **Storage:** Local filesystem for Chrome profiles (`chrome-profiles/`)
- **Encryption:** None
- **WAL mode:** Not configured
- **Export:** None
- **Air-gap:** Not supported (assumes network for provider access)
- **Sync:** None
- **Telemetry audit:** None

---

## Upgrade Design

### EncryptionEngine

Transparent encryption layer wrapping sensitive database columns. Uses AES-256-GCM with PBKDF2 key derivation.

```typescript
// src/engines/encryption.ts

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm'
  keyDerivation: 'pbkdf2'
  iterations: number
  saltLength: number
  ivLength: number
}

export interface EncryptedData {
  ciphertext: string  // base64
  iv: string          // base64
  salt: string        // base64
  authTag: string     // base64
  algorithm: string
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 600_000, // OWASP recommended minimum for PBKDF2-SHA256
  saltLength: 32,
  ivLength: 12,
}

export class EncryptionEngine {
  private key: Buffer | null = null
  private config: EncryptionConfig

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async unlock(passphrase: string): Promise<void> {
    // Derive key from passphrase
    // Salt is stored in SchemaMeta table
    const salt = await this.getOrCreateSalt()
    this.key = pbkdf2Sync(passphrase, salt, this.config.iterations, 32, 'sha256')
  }

  lock(): void {
    this.key = null
  }

  isUnlocked(): boolean {
    return this.key !== null
  }

  encrypt(plaintext: string): EncryptedData {
    if (!this.key) throw new EngineError('EncryptionEngine is locked')
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
    if (!this.key) throw new EngineError('EncryptionEngine is locked')
    const decipher = createDecipheriv(
      encrypted.algorithm,
      this.key,
      Buffer.from(encrypted.iv, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  }

  // Field-level: encrypt → JSON stringify → base64 for transparent column storage
  encryptField(value: string): string {
    const encrypted = this.encrypt(value)
    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  decryptField(encryptedValue: string): string {
    const json = Buffer.from(encryptedValue, 'base64').toString('utf8')
    const encrypted = JSON.parse(json) as EncryptedData
    return this.decrypt(encrypted)
  }

  private saltBuffer: Buffer | null = null

  private async getOrCreateSalt(): Promise<Buffer> {
    if (this.saltBuffer) return this.saltBuffer
    // In production: read from SchemaMeta or generate new
    this.saltBuffer = randomBytes(this.config.saltLength)
    return this.saltBuffer
  }

  private getSaltBase64(): string {
    return (this.saltBuffer ?? Buffer.alloc(0)).toString('base64')
  }
}
```

**Encrypted columns (configurable):**
- `provider_account.email`
- `provider_account.provider_state_json`
- `provider_config.config_value` (where `is_secret = 1`)
- `semantic_memory.object_json` (may contain PII)
- `episodic_memory.input_json`, `output_json`
- `decision_record.decision_text`, `rationale`

### WAL Mode Configuration

```typescript
// src/storage/prisma.ts — add WAL mode

import { PrismaClient } from '@prisma/client'

let client: PrismaClient | null = null

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })

    // Enable WAL mode for better concurrent read performance and crash recovery
    client.$executeRawUnsafe('PRAGMA journal_mode = WAL')
    client.$executeRawUnsafe('PRAGMA synchronous = NORMAL')
    client.$executeRawUnsafe('PRAGMA busy_timeout = 5000')
    client.$executeRawUnsafe('PRAGMA cache_size = -64000') // 64MB cache
    client.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  }
  return client
}
```

### ExportEngine

```typescript
// src/engines/export.ts

export class ExportEngine {
  constructor(private db: CapStoreDb) {}

  async export(options: ExportOptions): Promise<ExportResult> {
    const start = Date.now()
    const tablesToExport = this.getTablesForScope(options.scope)
    const exportedTables: string[] = []
    let totalRows = 0

    if (options.format === 'json') {
      const output: Record<string, unknown[]> = {}

      for (const table of tablesToExport) {
        const rows = await this.db.prisma.$queryRawUnsafe(`SELECT * FROM ${table}`)
        output[table] = rows as unknown[]
        exportedTables.push(table)
        totalRows += (rows as unknown[]).length
      }

      let fileContent = JSON.stringify(output, null, 2)

      if (options.encryptWithPassphrase) {
        const enc = new EncryptionEngine()
        await enc.unlock(options.encryptWithPassphrase)
        fileContent = enc.encryptField(fileContent)
      }

      await writeFile(options.outputPath, fileContent, 'utf-8')

    } else if (options.format === 'csv') {
      // Create directory for CSV files
      const dir = options.outputPath.replace(/\.[^.]+$/, '')
      await mkdir(dir, { recursive: true })

      for (const table of tablesToExport) {
        const rows = await this.db.prisma.$queryRawUnsafe(`SELECT * FROM ${table}`) as Record<string, unknown>[]
        if (rows.length === 0) continue

        const headers = Object.keys(rows[0]!)
        const csvLines = [headers.join(',')]

        for (const row of rows) {
          csvLines.push(
            headers.map(h => this.csvEscape(String(row[h] ?? ''))).join(','),
          )
        }

        await writeFile(join(dir, `${table}.csv`), csvLines.join('\n'), 'utf-8')
        exportedTables.push(table)
        totalRows += rows.length
      }
    }

    const stats = await stat(options.outputPath)

    return {
      filePath: options.outputPath,
      format: options.format,
      scope: options.scope,
      tablesExported: exportedTables,
      totalRows,
      fileSizeBytes: stats.size,
      durationMs: Date.now() - start,
      encrypted: !!options.encryptWithPassphrase,
    }
  }

  async importFromJson(filePath: string): Promise<{ tablesImported: string[]; rowsImported: number }> {
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown[]>

    const tablesImported: string[] = []
    let rowsImported = 0

    for (const [table, rows] of Object.entries(data)) {
      // Clear existing data
      await this.db.prisma.$executeRawUnsafe(`DELETE FROM ${table}`)

      // Insert rows
      for (const row of rows) {
        const columns = Object.keys(row)
        const values = Object.values(row)
        const placeholders = columns.map(() => '?').join(',')
        await this.db.prisma.$executeRawUnsafe(
          `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
          ...values,
        )
        rowsImported++
      }

      tablesImported.push(table)
    }

    return { tablesImported, rowsImported }
  }

  private getTablesForScope(scope: ExportScope): string[] {
    const ALL_TABLES = [
      'provider_definition', 'provider_endpoint', 'provider_parser',
      'provider_capability', 'provider_config', 'provider_model', 'provider_account',
      'conversation', 'conversation_message', 'stream_block',
      'episodic_memory', 'semantic_memory', 'procedural_rule',
      'entity', 'entity_mention', 'decision_record', 'pattern_extract',
      'topic', 'project', 'conversation_topic',
      'config_entry', 'config_audit',
      // ... all tables
    ]

    switch (scope) {
      case 'conversations':
        return ['conversation', 'conversation_message', 'stream_block']
      case 'memory':
        return ['episodic_memory', 'semantic_memory', 'procedural_rule',
                'entity', 'entity_mention', 'decision_record', 'pattern_extract',
                'memory_embedding']
      case 'providers':
        return ['provider_definition', 'provider_endpoint', 'provider_parser',
                'provider_capability', 'provider_config', 'provider_model', 'provider_account']
      case 'config':
        return ['config_entry', 'config_audit']
      case 'full':
      default:
        return ALL_TABLES
    }
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
}
```

### AirGapEngine

```typescript
// src/engines/airgap.ts

export class AirGapEngine {
  private config: AirGapConfig
  private networkStatus: boolean | null = null
  private localModelStatus: boolean | null = null

  constructor(config: AirGapConfig) {
    this.config = config
  }

  async enable(): Promise<void> {
    this.config.enabled = true
    this.eventBus?.emit({ type: 'airgap:enabled' } as never)
  }

  async disable(): Promise<void> {
    this.config.enabled = false
    this.eventBus?.emit({ type: 'airgap:disabled' } as never)
  }

  async getStatus(): Promise<AirGapStatus> {
    return {
      isAirGapMode: this.config.enabled,
      networkReachable: await this.checkNetwork(),
      localModelAvailable: await this.checkLocalModel(),
      localModelName: this.config.localModelProvider,
      cachedResponses: await this.getCachedResponseCount(),
    }
  }

  async checkNetwork(): Promise<boolean> {
    try {
      await fetch('https://dns.google/resolve?name=google.com', {
        signal: AbortSignal.timeout(3000),
      })
      this.networkStatus = true
      return true
    } catch {
      this.networkStatus = false
      return false
    }
  }

  async checkLocalModel(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.localModelEndpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      this.localModelStatus = response.ok
      return response.ok
    } catch {
      this.localModelStatus = false
      return false
    }
  }

  async routeToLocalModel(message: string): Promise<{ ok: boolean; response: string; error?: string }> {
    if (!this.config.enabled) {
      return { ok: false, response: '', error: 'Air-gap mode not enabled' }
    }

    try {
      // Ollama API format
      const response = await fetch(`${this.config.localModelEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt: message,
          stream: false,
        }),
      })

      if (!response.ok) {
        return { ok: false, response: '', error: `Local model error: ${response.status}` }
      }

      const data = await response.json() as { response?: string }
      return { ok: true, response: data.response ?? '' }
    } catch (err) {
      return {
        ok: false,
        response: '',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private async getCachedResponseCount(): Promise<number> {
    // Count cached responses in episodic_memory
    return 0 // Implementation depends on caching strategy
  }
}
```

### SyncEngine

```typescript
// src/engines/sync.ts

export class SyncEngine {
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private store: SyncStore,
    private config: SyncConfig,
    private encryption: EncryptionEngine,
  ) {}

  async pair(newDeviceId: string, name: string): Promise<{ pairingCode: string }> {
    // Generate 6-digit pairing code
    const pairingCode = String(Math.floor(100000 + Math.random() * 900000))

    await this.store.createPeer({
      id: newId(),
      deviceId: newDeviceId,
      name,
      publicKey: '', // Will be exchanged during confirm
      lastSyncAt: null,
      status: 'pending',
      pairedAt: null,
    })

    return { pairingCode }
  }

  async confirmPair(deviceId: string, pairingCode: string): Promise<void> {
    // In production: verify pairing code, exchange public keys
    await this.store.updatePeer(deviceId, {
      status: 'paired',
      pairedAt: Date.now(),
    })
  }

  async sync(): Promise<{ entriesSynced: number; conflicts: number }> {
    if (!this.config.enabled) return { entriesSynced: 0, conflicts: 0 }

    const peers = await this.store.getPeers()
    const paired = peers.filter(p => p.status === 'paired')
    let totalSynced = 0
    let totalConflicts = 0

    for (const peer of paired) {
      const unsynced = await this.store.getUnsyncedEntries(peer.deviceId, 100)

      if (unsynced.length === 0) continue

      // Encrypt entries with peer's public key
      const encryptedEntries = unsynced.map(entry => ({
        ...entry,
        dataJson: this.encryption.encryptField(entry.dataJson),
      }))

      // POST to relay
      try {
        const response = await fetch(`${this.config.relayUrl}/sync/${peer.deviceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: this.config.deviceId,
            entries: encryptedEntries,
          }),
        })

        if (response.ok) {
          // Mark as synced
          await this.store.markSynced(unsynced.map(e => e.id))
          totalSynced += unsynced.length
        }
      } catch {
        // Relay unreachable — will retry next cycle
      }
    }

    return { entriesSynced: totalSynced, conflicts: totalConflicts }
  }

  async getPendingSync(): Promise<number> {
    const peers = await this.store.getPeers()
    const paired = peers.filter(p => p.status === 'paired')
    let total = 0

    for (const peer of paired) {
      const unsynced = await this.store.getUnsyncedEntries(peer.deviceId, 10_000)
      total += unsynced.length
    }

    return total
  }

  start(): void {
    this.syncTimer = setInterval(() => {
      this.sync().catch(() => {})
    }, this.config.syncIntervalMs)
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async revokePeer(deviceId: string): Promise<void> {
    await this.store.updatePeer(deviceId, { status: 'revoked' })
  }
}
```

### Telemetry Audit (Zero-Cloud Proof)

```typescript
// src/engines/telemetry-audit.ts

export interface NetworkCallRecord {
  id: string
  timestamp: number
  method: string
  url: string
  initiator: string  // which engine made the call
  responseStatus: number | null
  durationMs: number
  isToAiProvider: boolean
}

export interface AuditReport {
  generatedAt: number
  periodFrom: number
  periodTo: number
  totalOutboundCalls: number
  callsToAiProviders: number
  callsToOther: number
  nonProviderCalls: Array<{ url: string; count: number; initiator: string }>
  verdict: 'clean' | 'suspicious' | 'violating'
  details: string[]
}

export class TelemetryAudit {
  private networkCalls: NetworkCallRecord[] = []
  private knownProviderUrls: string[]

  constructor(providerUrls: string[]) {
    this.knownProviderUrls = providerUrls
  }

  recordCall(record: Omit<NetworkCallRecord, 'id'>): void {
    this.networkCalls.push({
      id: newId(),
      ...record,
    })
  }

  generateReport(from: number, to: number): AuditReport {
    const inRange = this.networkCalls.filter(
      c => c.timestamp >= from && c.timestamp <= to,
    )

    const toAiProviders = inRange.filter(c => c.isToAiProvider)
    const toOther = inRange.filter(c => !c.isToAiProvider)

    const nonProviderGroups = new Map<string, { count: number; initiator: string }>()
    for (const call of toOther) {
      const key = this.normalizeUrl(call.url)
      const existing = nonProviderGroups.get(key)
      if (existing) {
        existing.count++
      } else {
        nonProviderGroups.set(key, { count: 1, initiator: call.initiator })
      }
    }

    const details: string[] = []
    let verdict: 'clean' | 'suspicious' | 'violating' = 'clean'

    if (toOther.length > 0) {
      const nonProviderList = [...nonProviderGroups.entries()]
        .map(([url, info]) => `${url} (${info.count} calls from ${info.initiator})`)

      if (toOther.length > 10) {
        verdict = 'violating'
        details.push(`CRITICAL: ${toOther.length} non-provider network calls detected`)
      } else {
        verdict = 'suspicious'
        details.push(`WARNING: ${toOther.length} non-provider network calls:`)
      }
      details.push(...nonProviderList)
    } else {
      details.push('No non-provider network calls detected. All outbound traffic goes to user-configured AI providers.')
    }

    return {
      generatedAt: Date.now(),
      periodFrom: from,
      periodTo: to,
      totalOutboundCalls: inRange.length,
      callsToAiProviders: toAiProviders.length,
      callsToOther: toOther.length,
      nonProviderCalls: [...nonProviderGroups.entries()].map(([url, info]) => ({
        url,
        count: info.count,
        initiator: info.initiator,
      })),
      verdict,
      details,
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      return `${parsed.protocol}//${parsed.hostname}/`
    } catch {
      return url
    }
  }

  private isAiProviderUrl(url: string): boolean {
    return this.knownProviderUrls.some(p => url.includes(p))
  }
}
```

---

## Server API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/export/full` | Export all data as JSON |
| POST | `/api/export/conversations` | Export conversations only |
| POST | `/api/export/memory` | Export memory only |
| POST | `/api/import/json` | Import from JSON |
| GET | `/api/airgap/status` | Get air-gap status |
| POST | `/api/airgap/enable` | Enable air-gap mode |
| POST | `/api/airgap/disable` | Disable air-gap mode |
| GET | `/api/sync/peers` | List sync peers |
| POST | `/api/sync/pair` | Pair new device |
| POST | `/api/sync/confirm` | Confirm pairing |
| POST | `/api/sync/now` | Trigger manual sync |
| DELETE | `/api/sync/peers/:deviceId` | Revoke peer |
| GET | `/api/audit/network` | Network telemetry audit |

---

## CLI Commands

```bash
vivim export full --output backup.json
vivim export conversations --output convs/ --format csv
vivim export memory --output memory.json --encrypt
vivim import backup.json
vivim airgap enable
vivim airgap status
vivim sync pair "My Laptop"
vivim sync now
vivim audit network --from 2026-07-01 --to 2026-07-11
```
