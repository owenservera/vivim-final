// src/storage/impl/slave-setup-store-impl.ts
// SlaveSetupStoreImpl — workspace hint + profile allocation for provider setup.
// Config stored in C:\.config\vivim\setup-config.json (Windows) or /.config/vivim/ (Unix).

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SetupAccount, SlaveSetupStore } from '../contracts/slave-setup-store.js'
import type { CapStoreDb } from '../db.js'

const CONFIG_DIR = process.platform === 'win32' ? 'C:\\.config\\vivim' : '/.config/vivim'
const CONFIG_FILE = join(CONFIG_DIR, 'setup-config.json')

// ── Helpers ─────────────────────────────────────────────────────────────────

async function ensureConfigDir(): Promise<void> {
  try {
    await mkdir(CONFIG_DIR, { recursive: true })
  } catch {
    // Race or exists
  }
}

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    const txt = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(txt)
  } catch {
    return {}
  }
}

async function writeConfig(config: Record<string, unknown>): Promise<void> {
  await ensureConfigDir()
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

// ── SlaveSetupStoreImpl ─────────────────────────────────────────────────────

export class SlaveSetupStoreImpl implements SlaveSetupStore {
  constructor(private db: CapStoreDb) {}

  async getWorkspaceHint(): Promise<string | null> {
    const config = await readConfig()
    return typeof config.workspacePath === 'string' ? config.workspacePath : null
  }

  async setWorkspaceHint(path: string): Promise<void> {
    const config = await readConfig()
    config.workspacePath = path
    config.workspaceSetAt = Date.now()
    await writeConfig(config)
  }

  async upsertAccount(account: SetupAccount): Promise<void> {
    const now = Date.now()
    await this.db.prisma.providerAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        providerId: account.providerId,
        email: account.accountSlug,
        planTier: account.planTier,
        providerStateJson: '{}',
        profileDir: account.profileDir,
        loginState: account.loginState,
        debugPort: account.debugPort,
        createdAt: account.created_at ?? now,
        updatedAt: now,
      },
      update: {
        email: account.accountSlug,
        planTier: account.planTier,
        profileDir: account.profileDir ?? undefined,
        loginState: account.loginState ?? undefined,
        debugPort: account.debugPort ?? undefined,
        updatedAt: now,
      },
    })
  }

  async getAccount(providerId: string, accountId: string): Promise<SetupAccount | null> {
    const row = await this.db.prisma.providerAccount.findFirst({
      where: { providerId, email: accountId },
    })
    if (!row) return null

    return {
      id: row.id,
      providerId: row.providerId,
      accountSlug: row.email,
      displayName: row.email,
      planTier: row.planTier,
      loginState: row.loginState ?? 'unknown',
      profileDir: row.profileDir,
      debugPort: row.debugPort,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  async listAccounts(): Promise<SetupAccount[]> {
    const rows = await this.db.prisma.providerAccount.findMany()
    return rows.map((r) => ({
      id: r.id,
      providerId: r.providerId,
      accountSlug: r.email,
      displayName: r.email,
      planTier: r.planTier ?? 'free',
      loginState: r.loginState ?? 'unknown',
      profileDir: r.profileDir,
      debugPort: r.debugPort,
      created_at: r.createdAt ?? Date.now(),
      updated_at: r.updatedAt ?? Date.now(),
    }))
  }
}
